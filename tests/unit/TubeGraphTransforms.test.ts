import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTubeSegments, buildWeightedGraphFromTubeAsset, deriveKnownStations } from '../../src/core/pipeline/TubeGraphTransforms.js';
import type { WeightedGraph } from '../../src/core/routing/Dijkstra.js';

const graph: WeightedGraph = {
    nodes: [
        { id: 'waterloo', name: 'Waterloo' },
        { id: 'westminster', name: 'Westminster' },
        { id: 'green-park', name: 'Green Park' },
        { id: 'baker-street', name: 'Baker Street' },
        { id: 'oxford-circus', name: 'Oxford Circus' },
    ],
    edges: [
        { from: 'waterloo', to: 'westminster', cost: 2, lineId: 'jubilee' },
        { from: 'westminster', to: 'green-park', cost: 2, lineId: 'jubilee' },
        { from: 'green-park', to: 'baker-street', cost: 4, lineId: 'metropolitan' },
        { from: 'green-park', to: 'oxford-circus', cost: 2, lineId: 'victoria' },
    ],
};

test('buildTubeSegments produces a single segment for a single-line path', () => {
    const segments = buildTubeSegments(['waterloo', 'westminster', 'green-park'], graph);

    assert.equal(segments.length, 1);
    assert.equal(segments[0].lineId, 'jubilee');
    assert.deepEqual(segments[0].stations, ['Waterloo', 'Westminster', 'Green Park']);
});

test('buildTubeSegments splits segments at line changes', () => {
    const segments = buildTubeSegments(['waterloo', 'westminster', 'green-park', 'baker-street'], graph);

    assert.equal(segments.length, 2);
    assert.equal(segments[0].lineId, 'jubilee');
    assert.deepEqual(segments[0].stations, ['Waterloo', 'Westminster', 'Green Park']);
    assert.equal(segments[1].lineId, 'metropolitan');
    assert.deepEqual(segments[1].stations, ['Green Park', 'Baker Street']);
});

test('buildTubeSegments returns empty array for path with fewer than 2 nodes', () => {
    assert.deepEqual(buildTubeSegments([], graph), []);
    assert.deepEqual(buildTubeSegments(['waterloo'], graph), []);
});

test('buildTubeSegments uses unknown lineId for edges not in the graph', () => {
    const segments = buildTubeSegments(['waterloo', 'baker-street'], graph);

    assert.equal(segments.length, 1);
    assert.equal(segments[0].lineId, 'unknown');
    assert.deepEqual(segments[0].stations, ['Waterloo', 'Baker Street']);
});

test('buildTubeSegments resolves node names from graph', () => {
    const segments = buildTubeSegments(['green-park', 'oxford-circus'], graph);

    assert.equal(segments.length, 1);
    assert.equal(segments[0].lineId, 'victoria');
    assert.deepEqual(segments[0].stations, ['Green Park', 'Oxford Circus']);
});

test('buildWeightedGraphFromTubeAsset converts tube asset to weighted graph', () => {
    const asset = {
        schemaVersion: 1,
        assetType: 'tube-graph' as const,
        nodes: [
            { id: 'waterloo', name: 'Waterloo', zone: 1 },
            { id: 'westminster', name: 'Westminster', zone: 1 },
        ],
        edges: [
            { from: 'waterloo', to: 'westminster', lineId: 'jubilee', travelMinutes: 2 },
        ],
    };

    const result = buildWeightedGraphFromTubeAsset(asset);

    assert.equal(result.nodes.length, 2);
    assert.equal(result.edges.length, 1);
    assert.equal(result.edges[0].cost, 2);
    assert.equal(result.edges[0].lineId, 'jubilee');
});

test('deriveKnownStations returns station names from asset', () => {
    const asset = {
        schemaVersion: 1,
        assetType: 'tube-graph' as const,
        nodes: [
            { id: 'waterloo', name: 'Waterloo', zone: 1 },
            { id: 'westminster', name: 'Westminster', zone: 1 },
        ],
        edges: [],
    };

    const stations = deriveKnownStations(asset);
    assert.deepEqual(stations, ['Waterloo', 'Westminster']);
});
