import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEntityResolverFromSqlite, loadEntityRecordsFromSqlite } from '../../src/core/pipeline/SqliteEntityRecordLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');
const aliasesDbPath = path.join(repoRoot, 'assets', 'data', 'location_aliases.db');

function ensureAssembledDatabases() {
    execFileSync('node', ['scripts/data-pipeline/generate-location-aliases-db.js'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    execFileSync('node', ['scripts/data-pipeline/assemble-sqlite-dbs.js'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
    });
}

test('EntityResolver can read records from the assembled local SQLite data path', () => {
    ensureAssembledDatabases();

    const resolver = createEntityResolverFromSqlite(aliasesDbPath);
    const result = resolver.resolve('Baker St');

    assert.equal(result.status, 'resolved');
    assert.equal(result.bestCandidate?.entity.canonicalName, 'Baker Street');
});

test('loadEntityRecordsFromSqlite returns local entity records with aliases', () => {
    ensureAssembledDatabases();

    const records = loadEntityRecordsFromSqlite(aliasesDbPath);
    const kingsCross = records.find((record) => record.canonicalName === "King's Cross St Pancras");

    assert.ok(records.length > 0);
    assert.ok(kingsCross);
    assert.ok(kingsCross.aliases.includes('St Pancras'));
    assert.ok(kingsCross.aliases.includes('Kings Cross'));
});