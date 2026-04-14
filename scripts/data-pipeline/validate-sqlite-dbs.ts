import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEntityResolverFromSqlite } from '../../src/core/pipeline/SqliteEntityRecordLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');
const dataDir = path.join(repoRoot, 'assets', 'data');
const poisDbPath = path.join(dataDir, 'pois.db');
const aliasesDbPath = path.join(dataDir, 'location_aliases.db');

assert.ok(fs.existsSync(poisDbPath), 'pois.db is missing. Run npm run stage2:assemble first.');
assert.ok(fs.existsSync(aliasesDbPath), 'location_aliases.db is missing. Run npm run stage2:assemble first.');

const summary = {
    pois: validatePoisDatabase(poisDbPath),
    locationAliases: validateLocationAliasesDatabase(aliasesDbPath),
    entityResolver: validateEntityResolver(aliasesDbPath),
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

function validatePoisDatabase(dbPath: string) {
    assert.equal(queryCount(dbPath, "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='pois';"), 1, 'pois table is missing');
    assert.equal(queryCount(dbPath, "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='pois_fts';"), 1, 'pois_fts table is missing');

    const rowCount = queryCount(dbPath, 'SELECT COUNT(*) FROM pois;');
    const ftsRowCount = queryCount(dbPath, 'SELECT COUNT(*) FROM pois_fts;');

    assert.ok(rowCount > 0, 'pois seed rows are missing');
    assert.equal(ftsRowCount, rowCount, 'pois_fts row count does not match pois row count');

    return {
        dbPath: relativeToRepo(dbPath),
        tables: ['pois', 'pois_fts'],
        rowCount,
        ftsRowCount,
    };
}

function validateLocationAliasesDatabase(dbPath: string) {
    assert.equal(queryCount(dbPath, "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='location_aliases';"), 1, 'location_aliases table is missing');
    assert.equal(queryCount(dbPath, "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='location_aliases_fts';"), 1, 'location_aliases_fts table is missing');

    const rowCount = queryCount(dbPath, 'SELECT COUNT(*) FROM location_aliases;');
    const ftsRowCount = queryCount(dbPath, 'SELECT COUNT(*) FROM location_aliases_fts;');
    const sampleCanonical = queryValue(dbPath, "SELECT canonical_name FROM location_aliases WHERE alias = 'Baker St' LIMIT 1;");

    assert.ok(rowCount > 0, 'location_aliases seed rows are missing');
    assert.equal(ftsRowCount, rowCount, 'location_aliases_fts row count does not match location_aliases row count');
    assert.equal(sampleCanonical, 'Baker Street', 'expected Baker St alias seed row is missing');

    return {
        dbPath: relativeToRepo(dbPath),
        tables: ['location_aliases', 'location_aliases_fts'],
        rowCount,
        ftsRowCount,
        sampleCanonical,
    };
}

function validateEntityResolver(dbPath: string) {
    const resolver = createEntityResolverFromSqlite(dbPath);
    const result = resolver.resolve('St Pancras');

    assert.equal(result.status, 'resolved', 'EntityResolver did not resolve from the assembled local DB path');
    // The canonical name for the combined King's Cross / St Pancras station comes
    // from TfL's Line Sequence API (e.g. "King's Cross & St Pancras International").
    // We just require that "St Pancras" resolves to *some* King's Cross variant,
    // since TfL occasionally tweaks the canonical string.
    const resolved = result.bestCandidate?.entity.canonicalName ?? '';
    assert.ok(
        /King'?s\s+Cross/.test(resolved) && /St\s*Pancras/i.test(resolved),
        `EntityResolver resolved the wrong canonical station: ${resolved}`,
    );

    return {
        dbPath: relativeToRepo(dbPath),
        query: 'St Pancras',
        resolvedCanonicalName: result.bestCandidate?.entity.canonicalName,
    };
}

function queryCount(dbPath: string, sql: string) {
    return Number.parseInt(queryValue(dbPath, sql), 10);
}

function queryValue(dbPath: string, sql: string) {
    return execFileSync('sqlite3', ['-noheader', dbPath, sql], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
}

function relativeToRepo(filePath: string) {
    return path.relative(repoRoot, filePath);
}