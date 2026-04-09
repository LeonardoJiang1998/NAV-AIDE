#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, '..', '..', 'assets', 'data');

const databases = [
    {
        name: 'pois.db',
        schemaPath: path.join(__dirname, 'generated', 'pois', 'pois.schema.sql'),
        seedPath: path.join(__dirname, 'generated', 'pois', 'pois.seed.sql'),
        artifactPath: path.join(outputDir, 'pois.db'),
        ftsSql: `
CREATE VIRTUAL TABLE IF NOT EXISTS pois_fts USING fts5(
    canonical_name,
    category,
    search_terms,
    content='pois',
    content_rowid='rowid'
);
INSERT INTO pois_fts(rowid, canonical_name, category, search_terms)
SELECT rowid, canonical_name, category, search_terms
FROM pois;
`,
    },
    {
        name: 'location_aliases.db',
        schemaPath: path.join(__dirname, 'generated', 'location-aliases', 'location_aliases.schema.sql'),
        seedPath: path.join(__dirname, 'generated', 'location-aliases', 'location_aliases.seed.sql'),
        artifactPath: path.join(outputDir, 'location_aliases.db'),
        ftsSql: `
CREATE VIRTUAL TABLE IF NOT EXISTS location_aliases_fts USING fts5(
    alias,
    canonical_name,
    normalized_alias,
    content='location_aliases',
    content_rowid='rowid'
);
INSERT INTO location_aliases_fts(rowid, alias, canonical_name, normalized_alias)
SELECT rowid, alias, canonical_name, normalized_alias
FROM location_aliases;
`,
    },
];

fs.mkdirSync(outputDir, { recursive: true });

const summary = databases.map(assembleDatabase);
process.stdout.write(`${JSON.stringify({ outputDir, databases: summary }, null, 2)}\n`);

function assembleDatabase(database) {
    assertFile(database.schemaPath, `${database.name} schema SQL`);
    assertFile(database.seedPath, `${database.name} seed SQL`);

    fs.rmSync(database.artifactPath, { force: true });

    const sql = [
        'PRAGMA journal_mode = DELETE;',
        fs.readFileSync(database.schemaPath, 'utf8'),
        fs.readFileSync(database.seedPath, 'utf8'),
        database.ftsSql,
        'VACUUM;',
    ].join('\n');

    execFileSync('sqlite3', [database.artifactPath], {
        cwd: path.join(__dirname, '..', '..'),
        input: sql,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
        name: database.name,
        artifactPath: path.relative(path.join(__dirname, '..', '..'), database.artifactPath),
        sizeBytes: fs.statSync(database.artifactPath).size,
    };
}

function assertFile(filePath, label) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`${label} is missing at ${filePath}. Run npm run stage2:sql first.`);
    }
}