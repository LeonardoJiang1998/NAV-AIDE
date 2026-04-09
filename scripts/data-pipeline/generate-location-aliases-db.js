#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stationsPath = path.join(__dirname, '..', 'prompt-validation', 'fixtures', 'stations.json');
const outPath = path.join(__dirname, 'location_aliases.seed.sql');
const stations = JSON.parse(fs.readFileSync(stationsPath, 'utf8')).stations;

const rows = stations
    .map((station) => {
        const normalized = station.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        return `('${normalized.replace(/'/g, "''")}', '${station.replace(/'/g, "''")}')`;
    })
    .join(',\n  ');

const sql = `-- Phase 1 scaffold for location_aliases.db\nCREATE TABLE IF NOT EXISTS location_aliases (\n  alias TEXT PRIMARY KEY,\n  canonical_name TEXT NOT NULL\n);\n\nINSERT INTO location_aliases (alias, canonical_name) VALUES\n  ${rows};\n`;

fs.writeFileSync(outPath, sql);
process.stdout.write(`${outPath}\n`);