#!/usr/bin/env node
/**
 * Extract an MBTiles SQLite file into a flat {z}/{x}/{y}.png directory tree.
 *
 * MapLibre on iOS can load raster tiles from `file://` URL templates, but
 * reading directly out of an MBTiles SQLite file at runtime would require a
 * custom native source. Extracting once at build time side-steps that: we
 * get a directory of PNGs that we can ship as iOS bundle resources, and the
 * offline-style.json references them via `file://<bundle>/maps/{z}/{x}/{y}.png`.
 *
 * Note: MBTiles uses TMS y-axis (flipped). We convert back to OSM slippy
 * map coordinates on extraction so the tiles live at paths the tile URL
 * template understands without further math.
 *
 * Usage: node extract-mbtiles-to-dir.mjs <mbtiles-path> <output-dir>
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [, , mbtilesPath, outputDir] = process.argv;
if (!mbtilesPath || !outputDir) {
    console.error('Usage: node extract-mbtiles-to-dir.mjs <mbtiles-path> <output-dir>');
    process.exit(1);
}

if (!fs.existsSync(mbtilesPath)) {
    console.error(`MBTiles file not found: ${mbtilesPath}`);
    process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

// Query all tiles. We emit <z>|<col>|<row>\t<hex> and stream-parse to avoid
// loading every blob into memory at once.
const sql = 'SELECT zoom_level || "|" || tile_column || "|" || tile_row || char(9) || hex(tile_data) FROM tiles;';
const stdout = execFileSync('sqlite3', ['-noheader', mbtilesPath, sql], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512,
});

let extracted = 0;
let total = 0;
for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    total += 1;
    const [key, hex] = line.split('\t');
    if (!key || !hex) continue;
    const [zStr, colStr, rowStr] = key.split('|');
    const z = Number(zStr);
    const x = Number(colStr);
    const tmsY = Number(rowStr);
    const osmY = Math.pow(2, z) - 1 - tmsY; // convert TMS → slippy-map
    const dir = path.join(outputDir, String(z), String(x));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${osmY}.png`), Buffer.from(hex, 'hex'));
    extracted += 1;
}

console.log(JSON.stringify({ input: mbtilesPath, output: outputDir, tilesExtracted: extracted, tilesTotal: total }, null, 2));
