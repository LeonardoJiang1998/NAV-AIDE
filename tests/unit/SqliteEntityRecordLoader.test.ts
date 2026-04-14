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
    // The canonical name for the combined King's Cross / St Pancras station
    // comes from the TfL Line Sequence API (currently "King's Cross & St Pancras
    // International"). We accept any variant that mentions both, since TfL
    // sometimes changes the canonical string.
    const kingsCross = records.find((record) =>
        /King'?s\s+Cross/i.test(record.canonicalName) && /St\s*Pancras/i.test(record.canonicalName),
    );

    assert.ok(records.length > 0);
    assert.ok(kingsCross, 'expected a King\'s Cross / St Pancras entity record');
    assert.ok(kingsCross.aliases.includes('St Pancras'));
    assert.ok(kingsCross.aliases.includes('Kings Cross'));
});