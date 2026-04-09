#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, 'seeds', 'busRoutes.seed.json');
const assetPath = path.join(__dirname, '..', '..', 'assets', 'busRoutes.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

if (!Array.isArray(seed.routes) || seed.routes.length === 0) {
    throw new Error('busRoutes.seed.json must include a non-empty routes array.');
}

for (const route of seed.routes) {
    if (!route.routeId || !route.displayName || !Array.isArray(route.stops) || route.stops.length < 2) {
        throw new Error('Each bus route must include routeId, displayName, and at least two stops.');
    }
}

fs.writeFileSync(assetPath, `${JSON.stringify(seed, null, 4)}\n`);

process.stdout.write(`${JSON.stringify({ assetPath, routeCount: seed.routes.length }, null, 2)}\n`);