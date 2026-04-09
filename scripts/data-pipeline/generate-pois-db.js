#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, 'seeds', 'pois.seed.json');
const outputDir = path.join(__dirname, 'generated', 'pois');
const schemaPath = path.join(outputDir, 'pois.schema.sql');
const seedSqlPath = path.join(outputDir, 'pois.seed.sql');
const manifestPath = path.join(outputDir, 'pois.manifest.json');
const seeds = JSON.parse(fs.readFileSync(seedPath, 'utf8')).pois;

if (!Array.isArray(seeds) || seeds.length === 0) {
    throw new Error('pois.seed.json must include a non-empty pois array.');
}

fs.mkdirSync(outputDir, { recursive: true });

const schemaSql = `-- Stage 2 scaffold for pois.db\nCREATE TABLE IF NOT EXISTS pois (\n  id TEXT PRIMARY KEY,\n  canonical_name TEXT NOT NULL,\n  category TEXT NOT NULL,\n  latitude REAL NOT NULL,\n  longitude REAL NOT NULL,\n  zone INTEGER,\n  search_terms TEXT NOT NULL\n);\n\nCREATE INDEX IF NOT EXISTS idx_pois_category ON pois(category);\nCREATE INDEX IF NOT EXISTS idx_pois_zone ON pois(zone);\n-- Future native assembly step: project search_terms into an SQLite FTS5 table without changing the Node-first schema contract.\n`;

const seedValues = seeds.map((poi) => {
    const values = [
        poi.id,
        poi.canonicalName,
        poi.category,
        poi.latitude,
        poi.longitude,
        poi.zone,
        poi.searchTerms.join(' '),
    ];

    return `  (${values.map(formatSqlValue).join(', ')})`;
});

const seedSql = `-- Stage 2 seed scaffold for pois.db\nINSERT INTO pois (id, canonical_name, category, latitude, longitude, zone, search_terms) VALUES\n${seedValues.join(',\n')};\n`;

const manifest = {
    targetDatabase: 'pois.db',
    schemaPath: relativeToRepo(schemaPath),
    seedPath: relativeToRepo(seedSqlPath),
    seedCount: seeds.length,
    assemblyHint: 'Use a later SQLite assembly step to execute pois.schema.sql and pois.seed.sql into a binary pois.db artifact.',
};

fs.writeFileSync(schemaPath, `${schemaSql}\n`);
fs.writeFileSync(seedSqlPath, `${seedSql}\n`);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

function formatSqlValue(value) {
    if (value === null || value === undefined) {
        return 'NULL';
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? String(value) : 'NULL';
    }

    return `'${String(value).replace(/'/g, "''")}'`;
}

function relativeToRepo(filePath) {
    return path.relative(path.join(__dirname, '..', '..'), filePath);
}