#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetPath = path.join(__dirname, '..', '..', 'assets', 'tubeGraph.json');
const graph = JSON.parse(fs.readFileSync(assetPath, 'utf8'));

if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('tubeGraph.json must include nodes and edges arrays.');
}

process.stdout.write(`${JSON.stringify({ nodes: graph.nodes.length, edges: graph.edges.length }, null, 2)}\n`);