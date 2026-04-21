#!/usr/bin/env node
/**
 * Build an offline MBTiles file for London from public OSM raster tiles.
 *
 * We fetch a tightly-scoped set of OpenStreetMap raster tiles (Greater London
 * overview at z10-13, plus Zone 1-2 detail at z14-15) and pack them into an
 * SQLite MBTiles file per https://github.com/mapbox/mbtiles-spec.
 *
 * This is intended for MVP offline map use — not a general tile scraper. OSM's
 * Tile Usage Policy (https://operations.osmfoundation.org/policies/tiles/)
 * restricts bulk downloads; we keep the total well below their soft limits
 * (~1k tiles, throttled to ~1/sec with a unique User-Agent). Production
 * should point at a self-hosted or commercial tile server.
 *
 * Output: assets/data/london.mbtiles
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const OUTPUT = path.join(ROOT, 'assets', 'data', 'london.mbtiles');
const CACHE_DIR = path.join(__dirname, 'tfl-source', 'osm-tile-cache');

// MVP slice set: overview zooms for context + Zone 1 detail where tourists
// spend the most time. Total stays comfortably under OSM's bulk-download
// guidance. Expand this list in a follow-up once we have a self-hosted tile
// server or a commercial key.
const SLICES = [
    { name: 'Greater London overview', lat: [51.28, 51.69], lon: [-0.51, 0.33], zooms: [10, 11, 12] },
    { name: 'Zone 1 detail', lat: [51.49, 51.53], lon: [-0.18, -0.05], zooms: [13, 14] },
];

const USER_AGENT = 'NAV-AiDE/0.1 (offline assistant MVP; contact: aidemain.hq/placeholder)';
const REQUEST_DELAY_MS = 1100; // ~1 request/sec
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

// --- compute the tile list first so we can estimate total work ---
const allTiles = [];
for (const slice of SLICES) {
    for (const z of slice.zooms) {
        for (const tile of tilesInBounds(z, slice.lat, slice.lon)) {
            allTiles.push({ ...tile, slice: slice.name });
        }
    }
}
console.log(`Total tiles to assemble: ${allTiles.length}`);
console.log('Breakdown:');
const byZoom = new Map();
for (const t of allTiles) byZoom.set(t.z, (byZoom.get(t.z) ?? 0) + 1);
for (const [z, count] of [...byZoom.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  z=${z}: ${count} tiles`);
}

// --- download tiles into cache (skip if already present) ---
let downloaded = 0;
let cached = 0;
let failed = 0;
const startTime = Date.now();

for (let i = 0; i < allTiles.length; i += 1) {
    const tile = allTiles[i];
    const cachePath = path.join(CACHE_DIR, `${tile.z}_${tile.x}_${tile.y}.png`);
    if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
        cached += 1;
        continue;
    }
    const url = TILE_URL.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
    try {
        const buffer = await fetchTile(url);
        fs.writeFileSync(cachePath, buffer);
        downloaded += 1;
    } catch (error) {
        failed += 1;
        console.warn(`  [!] Failed ${tile.z}/${tile.x}/${tile.y}: ${error instanceof Error ? error.message : error}`);
    }
    // Throttle per OSM tile usage policy.
    if (i < allTiles.length - 1) await delay(REQUEST_DELAY_MS);

    if ((i + 1) % 50 === 0 || i === allTiles.length - 1) {
        const pct = (((i + 1) / allTiles.length) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`  progress: ${i + 1}/${allTiles.length} (${pct}%) · ${downloaded} fresh · ${cached} cached · ${failed} failed · ${elapsed}s`);
    }
}

console.log(`Download complete: ${downloaded} fresh, ${cached} already cached, ${failed} failed.`);

// --- assemble the MBTiles SQLite file ---
if (fs.existsSync(OUTPUT)) fs.unlinkSync(OUTPUT);

const schemaSql = `
PRAGMA journal_mode = MEMORY;
PRAGMA synchronous = OFF;
CREATE TABLE metadata (name TEXT PRIMARY KEY, value TEXT);
CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB, PRIMARY KEY (zoom_level, tile_column, tile_row));
`;
execFileSync('sqlite3', [OUTPUT], { input: schemaSql, encoding: 'utf8' });

// Metadata per the MBTiles spec
const bounds = [
    Math.min(...SLICES.map((s) => s.lon[0])),
    Math.min(...SLICES.map((s) => s.lat[0])),
    Math.max(...SLICES.map((s) => s.lon[1])),
    Math.max(...SLICES.map((s) => s.lat[1])),
].join(',');
const minzoom = Math.min(...SLICES.flatMap((s) => s.zooms));
const maxzoom = Math.max(...SLICES.flatMap((s) => s.zooms));
const metadata = {
    name: 'NAV-AiDE London',
    type: 'baselayer',
    version: '1.0.0',
    description: 'OpenStreetMap raster tiles packaged for NAV AiDE offline use. Greater London overview + Zone 1-2 detail.',
    format: 'png',
    attribution: '© OpenStreetMap contributors',
    bounds,
    center: '-0.1276,51.5074,12',
    minzoom: String(minzoom),
    maxzoom: String(maxzoom),
};
const metadataSql = Object.entries(metadata)
    .map(([k, v]) => `INSERT INTO metadata (name, value) VALUES (${sqlLiteral(k)}, ${sqlLiteral(v)});`)
    .join('\n');
execFileSync('sqlite3', [OUTPUT], { input: metadataSql, encoding: 'utf8' });

// Insert tiles in batches. We generate one SQL file so sqlite3 can stream the
// blobs efficiently via `.import` is not an option for BLOBs — hex-encode
// inline INSERT statements into a .sql file and pipe it.
const batchFile = path.join(CACHE_DIR, '_batch.sql');
const sink = fs.createWriteStream(batchFile);
sink.write('BEGIN TRANSACTION;\n');
let written = 0;
for (const tile of allTiles) {
    const cachePath = path.join(CACHE_DIR, `${tile.z}_${tile.x}_${tile.y}.png`);
    if (!fs.existsSync(cachePath)) continue;
    const bytes = fs.readFileSync(cachePath);
    const tmsY = Math.pow(2, tile.z) - 1 - tile.y;
    sink.write(`INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (${tile.z}, ${tile.x}, ${tmsY}, x'${bytes.toString('hex')}');\n`);
    written += 1;
}
sink.write('COMMIT;\n');
sink.end();
await new Promise((resolve, reject) => {
    sink.on('finish', resolve);
    sink.on('error', reject);
});

console.log(`Assembling MBTiles with ${written} tiles ...`);
execFileSync('sqlite3', [OUTPUT], { input: fs.readFileSync(batchFile, 'utf8'), encoding: 'utf8' });
fs.unlinkSync(batchFile);

// Verify
const count = execFileSync('sqlite3', ['-noheader', OUTPUT, 'SELECT COUNT(*) FROM tiles;'], { encoding: 'utf8' }).trim();
const stat = fs.statSync(OUTPUT);
console.log(`\nMBTiles written: ${OUTPUT}`);
console.log(`  tiles: ${count}`);
console.log(`  size:  ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

// -------- helpers --------

function tilesInBounds(zoom, latRange, lonRange) {
    const [latMin, latMax] = latRange;
    const [lonMin, lonMax] = lonRange;
    const [xMin, yMax] = deg2num(latMin, lonMin, zoom);
    const [xMax, yMin] = deg2num(latMax, lonMax, zoom);
    const tiles = [];
    for (let x = Math.min(xMin, xMax); x <= Math.max(xMin, xMax); x += 1) {
        for (let y = Math.min(yMin, yMax); y <= Math.max(yMin, yMax); y += 1) {
            tiles.push({ z: zoom, x, y });
        }
    }
    return tiles;
}

function deg2num(lat, lon, zoom) {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lon + 180) / 360) * n);
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
    return [x, y];
}

async function fetchTile(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            Accept: 'image/png',
        },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buf = await response.arrayBuffer();
    return Buffer.from(buf);
}

function sqlLiteral(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}
