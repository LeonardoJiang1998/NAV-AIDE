#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stationsPath = path.join(__dirname, '..', 'prompt-validation', 'fixtures', 'stations.json');
const outputDir = path.join(__dirname, 'generated', 'location-aliases');
const schemaPath = path.join(outputDir, 'location_aliases.schema.sql');
const seedSqlPath = path.join(outputDir, 'location_aliases.seed.sql');
const manifestPath = path.join(outputDir, 'location_aliases.manifest.json');
const stations = JSON.parse(fs.readFileSync(stationsPath, 'utf8')).stations;

if (!Array.isArray(stations) || stations.length === 0) {
    throw new Error('stations.json must include a non-empty stations array.');
}

fs.mkdirSync(outputDir, { recursive: true });

const aliasRows = expandAliases(stations);
const schemaSql = `-- Stage 2 scaffold for location_aliases.db\nCREATE TABLE IF NOT EXISTS location_aliases (\n  alias TEXT PRIMARY KEY,\n  normalized_alias TEXT NOT NULL,\n  canonical_name TEXT NOT NULL,\n  entity_type TEXT NOT NULL,\n  source TEXT NOT NULL\n);\n\nCREATE UNIQUE INDEX IF NOT EXISTS idx_location_aliases_normalized ON location_aliases(normalized_alias);\n`;

const seedSql = `-- Stage 2 seed scaffold for location_aliases.db\nINSERT INTO location_aliases (alias, normalized_alias, canonical_name, entity_type, source) VALUES\n${aliasRows
    .map((row) => `  (${[row.alias, row.normalizedAlias, row.canonicalName, row.entityType, row.source].map(formatSqlValue).join(', ')})`)
    .join(',\n')};\n`;

const manifest = {
    targetDatabase: 'location_aliases.db',
    schemaPath: relativeToRepo(schemaPath),
    seedPath: relativeToRepo(seedSqlPath),
    seedCount: aliasRows.length,
    sourceFixture: relativeToRepo(stationsPath),
    artifactPath: 'assets/data/location_aliases.db',
    assemblyCommand: 'npm run stage2:assemble',
    assemblyHint: 'Run the SQLite assembly step to create a local fixture-based location_aliases.db artifact with FTS tables.',
};

fs.writeFileSync(schemaPath, `${schemaSql}\n`);
fs.writeFileSync(seedSqlPath, `${seedSql}\n`);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

function expandAliases(stationNames) {
    const rows = [];

    for (const station of stationNames) {
        const aliasSet = new Set([station, station.replace(/Station$/i, '').trim()]);

        if (station.includes('Street')) {
            aliasSet.add(station.replace('Street', 'St'));
        }

        if (station.includes('Saint')) {
            aliasSet.add(station.replace('Saint', 'St'));
        }

        if (station.includes('King\'s Cross St Pancras')) {
            aliasSet.add('Kings Cross');
            aliasSet.add('King\'s Cross');
            aliasSet.add('St Pancras');
        }

        for (const alias of aliasSet) {
            rows.push({
                alias,
                normalizedAlias: normalizeAlias(alias),
                canonicalName: station,
                entityType: 'station',
                source: alias === station ? 'canonical-seed' : 'generated-alias',
            });
        }
    }

    return rows.sort((left, right) => left.normalizedAlias.localeCompare(right.normalizedAlias));
}

function normalizeAlias(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function formatSqlValue(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}

function relativeToRepo(filePath) {
    return path.relative(path.join(__dirname, '..', '..'), filePath);
}