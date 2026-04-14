#!/usr/bin/env node
/**
 * Generate schema + seed SQL for the location_aliases database.
 *
 * Canonical names come from assets/tubeGraph.json (the deployed, validated
 * tube graph) so the alias index always covers exactly the stations the
 * routing layer knows about. For each canonical name we generate a set of
 * aliases covering common user phrasings (e.g. "St" for "Street").
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tubeGraphPath = path.join(__dirname, '..', '..', 'assets', 'tubeGraph.json');
const outputDir = path.join(__dirname, 'generated', 'location-aliases');
const schemaPath = path.join(outputDir, 'location_aliases.schema.sql');
const seedSqlPath = path.join(outputDir, 'location_aliases.seed.sql');
const manifestPath = path.join(outputDir, 'location_aliases.manifest.json');

const tubeGraph = JSON.parse(fs.readFileSync(tubeGraphPath, 'utf8'));
const stationNames = (tubeGraph.nodes || [])
    .map((n) => n.name)
    .filter((n) => typeof n === 'string' && n.length > 0);

if (stationNames.length === 0) {
    throw new Error('tubeGraph.json has no station nodes — rebuild the graph first.');
}

fs.mkdirSync(outputDir, { recursive: true });

const aliasRows = expandAliases(stationNames);

const schemaSql = `-- Stage 2 scaffold for location_aliases.db
CREATE TABLE IF NOT EXISTS location_aliases (
  alias TEXT PRIMARY KEY,
  normalized_alias TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  source TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_location_aliases_normalized ON location_aliases(normalized_alias);
`;

// Chunk inserts so we avoid a single huge VALUES list, which is friendlier
// to sqlite3's CLI buffer and keeps diffs reviewable.
const CHUNK = 200;
const insertChunks = [];
for (let i = 0; i < aliasRows.length; i += CHUNK) {
    const chunk = aliasRows.slice(i, i + CHUNK);
    const valuesSql = chunk
        .map((row) =>
            `  (${[row.alias, row.normalizedAlias, row.canonicalName, row.entityType, row.source]
                .map(formatSqlValue)
                .join(', ')})`,
        )
        .join(',\n');
    insertChunks.push(
        `INSERT INTO location_aliases (alias, normalized_alias, canonical_name, entity_type, source) VALUES\n${valuesSql};`,
    );
}

const seedSql = `-- Stage 2 seed scaffold for location_aliases.db\n${insertChunks.join('\n\n')}\n`;

const manifest = {
    targetDatabase: 'location_aliases.db',
    schemaPath: relativeToRepo(schemaPath),
    seedPath: relativeToRepo(seedSqlPath),
    seedCount: aliasRows.length,
    canonicalCount: stationNames.length,
    sourceFixture: relativeToRepo(tubeGraphPath),
    artifactPath: 'assets/data/location_aliases.db',
    assemblyCommand: 'npm run stage2:assemble',
    assemblyHint: 'Run the SQLite assembly step to create the location_aliases.db artifact with FTS tables.',
};

fs.writeFileSync(schemaPath, `${schemaSql}\n`);
fs.writeFileSync(seedSqlPath, `${seedSql}\n`);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

// --- helpers ---

function expandAliases(names) {
    const rowsByNormalized = new Map();

    for (const station of names) {
        const aliasSet = new Set();

        // Canonical name
        aliasSet.add(station);

        // Drop trailing "Station" (rare now, but defensive)
        aliasSet.add(station.replace(/\s+Station$/i, '').trim());

        // Street / Saint abbreviations
        if (station.includes('Street')) aliasSet.add(station.replace(/Street/g, 'St'));
        if (station.includes('Saint')) aliasSet.add(station.replace(/Saint/g, 'St'));

        // Ampersand / "and" variants — TfL uses both in the wild
        if (station.includes(' & ')) {
            aliasSet.add(station.replace(/ & /g, ' and '));
            aliasSet.add(station.replace(/ & /g, ' '));
        } else if (station.includes(' and ')) {
            aliasSet.add(station.replace(/ and /g, ' & '));
        }

        // "Road" / "Rd", "Park" -> no change (kept long form). Avoid over-aliasing.

        // King's Cross St Pancras — keep wide coverage.
        if (/King'?s\s+Cross/i.test(station)) {
            aliasSet.add("King's Cross");
            aliasSet.add('Kings Cross');
            if (/St\s*Pancras/i.test(station)) aliasSet.add('St Pancras');
        }

        // Apostrophe-stripped variant for typo tolerance ("St Pauls", "Shepherds Bush").
        if (station.includes("'")) aliasSet.add(station.replace(/'/g, ''));

        // Empty/whitespace-only guard
        for (const raw of aliasSet) {
            const alias = raw.trim();
            if (!alias) continue;
            const normalizedAlias = normalizeAlias(alias);
            if (!normalizedAlias) continue;

            // Dedupe on normalized_alias (UNIQUE constraint). Keep the first
            // canonical-seed we see; generated-alias rows can share normalized
            // keys across stations but that should be rare with our alias set.
            const existing = rowsByNormalized.get(normalizedAlias);
            const isCanonical = alias === station;
            const source = isCanonical ? 'canonical-seed' : 'generated-alias';

            if (!existing) {
                rowsByNormalized.set(normalizedAlias, {
                    alias,
                    normalizedAlias,
                    canonicalName: station,
                    entityType: 'station',
                    source,
                });
            } else if (isCanonical && existing.source !== 'canonical-seed') {
                // Upgrade to canonical if this pass has the real name.
                rowsByNormalized.set(normalizedAlias, {
                    alias,
                    normalizedAlias,
                    canonicalName: station,
                    entityType: 'station',
                    source,
                });
            }
        }
    }

    return [...rowsByNormalized.values()].sort((a, b) =>
        a.normalizedAlias.localeCompare(b.normalizedAlias),
    );
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
