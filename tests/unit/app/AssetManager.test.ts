import test from 'node:test';
import assert from 'node:assert/strict';

import { AssetManager } from '../../../src/app/assets/AssetManager.js';
import type { OfflineAssetManifestEntry } from '../../../src/app/assets/assetManifest.js';
import type { RuntimeAssetPathReport } from '../../../src/app/runtime/ReactNativeOfflineAssetLoader.js';

const resolvedPaths: RuntimeAssetPathReport = {
    model: buildResolution('model', '/assets/model.gguf'),
    mapMbtiles: buildResolution('map-mbtiles', '/assets/maps/london.mbtiles'),
    poisDb: buildResolution('pois-db', '/assets/data/pois.db'),
    locationAliasesDb: buildResolution('location-aliases-db', '/assets/data/location_aliases.db'),
    walkingRouting: buildResolution('valhalla-tiles', '/assets/routing/valhalla_tiles'),
    disruptionCache: buildResolution('disruption-cache', '/assets/cache/disruptions.json'),
};

test('AssetManager.getStatus returns ready=false when a required asset checksum mismatches', async () => {
    const manifest: OfflineAssetManifestEntry[] = [
        { key: 'model', path: 'models/model.gguf', checksum: 'ok-model' },
        { key: 'map-mbtiles', path: 'maps/london.mbtiles', checksum: 'ok-map' },
    ];
    const manager = new AssetManager(
        { getAssetPathReport: async () => resolvedPaths },
        {
            hash: async (path: string) => path === '/assets/maps/london.mbtiles' ? 'bad-map' : 'ok-model',
        },
        manifest,
    );

    const status = await manager.getStatus();

    assert.equal(status.ready, false);
    assert.deepEqual(status.checks, [
        { key: 'model', exists: true, checksumMatches: true },
        { key: 'map-mbtiles', exists: true, checksumMatches: false },
    ]);
});

test('AssetManager.getStatus ignores optional checksum mismatches for overall readiness', async () => {
    const manifest: OfflineAssetManifestEntry[] = [
        { key: 'pois-db', path: 'data/pois.db', checksum: 'ok-pois' },
        { key: 'disruption-cache', path: 'cache/disruptions.json', checksum: 'ok-cache', optional: true },
    ];
    const manager = new AssetManager(
        { getAssetPathReport: async () => resolvedPaths },
        {
            hash: async (path: string) => path === '/assets/cache/disruptions.json' ? 'bad-cache' : 'ok-pois',
        },
        manifest,
    );

    const status = await manager.getStatus();

    assert.equal(status.ready, true);
    assert.deepEqual(status.checks, [
        { key: 'pois-db', exists: true, checksumMatches: true },
        { key: 'disruption-cache', exists: true, checksumMatches: false },
    ]);
});

function buildResolution(key: string, resolvedPath: string) {
    return {
        key,
        relativePath: resolvedPath,
        resolvedPath,
        exists: true,
        source: 'document' as const,
        candidates: [{ source: 'document' as const, path: resolvedPath }],
    };
}
