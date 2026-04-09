#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, 'pois.seed.sql');
const sql = `-- Phase 1 scaffold for pois.db\nCREATE TABLE IF NOT EXISTS pois (\n  id TEXT PRIMARY KEY,\n  canonical_name TEXT NOT NULL,\n  category TEXT NOT NULL,\n  latitude REAL,\n  longitude REAL\n);\n\nINSERT INTO pois (id, canonical_name, category, latitude, longitude) VALUES\n  ('british-museum', 'British Museum', 'museum', 51.5194, -0.1269),\n  ('london-eye', 'London Eye', 'attraction', 51.5033, -0.1196);\n`;

fs.writeFileSync(outPath, sql);
process.stdout.write(`${outPath}\n`);