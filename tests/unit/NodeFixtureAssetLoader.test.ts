import test from 'node:test';
import assert from 'node:assert/strict';

import { createNodeFixtureAssetLoader, buildWeightedGraphFromTubeAsset, deriveKnownStations } from '../../src/core/pipeline/NodeFixtureAssetLoader.js';
import { OFFLINE_RUNTIME_ASSET_CONTRACTS } from '../../src/core/pipeline/OfflineAssetRegistry.js';

test('Node fixture asset loader exposes stable offline runtime contracts', () => {
    const loader = createNodeFixtureAssetLoader(OFFLINE_RUNTIME_ASSET_CONTRACTS);

    assert.equal(loader.contracts.tubeGraph.relativePath, 'assets/tubeGraph.json');
    assert.deepEqual(loader.getPoisDatabase().ftsTables, ['pois_fts']);
    assert.deepEqual(loader.getLocationAliasesDatabase().ftsTables, ['location_aliases_fts']);
    assert.equal(loader.getWalkingRoutingInput().provider, 'valhalla');
    assert.equal(loader.loadDisruptionCache().source, 'fixture-static');
});

test('Node fixture asset loader converts tube assets into graph-ready runtime data', () => {
    const loader = createNodeFixtureAssetLoader(OFFLINE_RUNTIME_ASSET_CONTRACTS);
    const tubeAsset = loader.loadTubeGraph();
    const graph = buildWeightedGraphFromTubeAsset(tubeAsset);
    const knownStations = deriveKnownStations(tubeAsset);

    assert.ok(graph.nodes.length > 0);
    assert.ok(graph.edges.length > 0);
    assert.ok(knownStations.includes('Waterloo'));
});