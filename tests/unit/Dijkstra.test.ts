import test from 'node:test';
import assert from 'node:assert/strict';

import { Dijkstra, type WeightedGraph } from '../../src/core/routing/Dijkstra.js';

const graph: WeightedGraph = {
    nodes: [
        { id: 'waterloo', name: 'Waterloo' },
        { id: 'westminster', name: 'Westminster' },
        { id: 'green-park', name: 'Green Park' },
        { id: 'baker-street', name: 'Baker Street' },
        { id: 'paddington', name: 'Paddington' },
    ],
    edges: [
        { from: 'waterloo', to: 'westminster', cost: 2 },
        { from: 'westminster', to: 'green-park', cost: 2 },
        { from: 'green-park', to: 'baker-street', cost: 4 },
        { from: 'waterloo', to: 'paddington', cost: 10 },
        { from: 'paddington', to: 'baker-street', cost: 10 },
    ],
};

test('Dijkstra finds the lowest-cost path through the graph', () => {
    const router = new Dijkstra();
    const result = router.findShortestPath(graph, 'waterloo', 'baker-street');

    assert.ok(result);
    assert.equal(result.cost, 8);
    assert.deepEqual(result.path, ['waterloo', 'westminster', 'green-park', 'baker-street']);
});

test('Dijkstra returns null when no route exists', () => {
    const router = new Dijkstra();
    const disconnectedGraph: WeightedGraph = {
        nodes: [...graph.nodes, { id: 'euston', name: 'Euston' }],
        edges: graph.edges,
    };

    const result = router.findShortestPath(disconnectedGraph, 'waterloo', 'euston');
    assert.equal(result, null);
});