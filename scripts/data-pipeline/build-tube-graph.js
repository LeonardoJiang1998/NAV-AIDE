#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, 'seeds', 'tubeGraph.seed.json');
const assetPath = path.join(__dirname, '..', '..', 'assets', 'tubeGraph.json');
const graph = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('tubeGraph.json must include nodes and edges arrays.');
}

for (const node of graph.nodes) {
    if (!node.id || !node.name) {
        throw new Error('Each tube graph node must include id and name.');
    }
}

for (const edge of graph.edges) {
    if (!edge.from || !edge.to || typeof edge.travelMinutes !== 'number' || edge.travelMinutes <= 0) {
        throw new Error('Each tube graph edge must include from, to, and a positive travelMinutes value.');
    }
}

fs.writeFileSync(assetPath, `${JSON.stringify(graph, null, 4)}\n`);

process.stdout.write(`${JSON.stringify({ assetPath, nodes: graph.nodes.length, edges: graph.edges.length }, null, 2)}\n`);