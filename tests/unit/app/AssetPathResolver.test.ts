import test from 'node:test';
import assert from 'node:assert/strict';

import { buildResolvedAssetCandidates, normalizeManagedRelativePath } from '../../../src/app/runtime/AssetPathResolver.js';

test('normalizeManagedRelativePath strips the assets prefix for managed runtime assets', () => {
    assert.equal(normalizeManagedRelativePath('assets/data/pois.db'), 'data/pois.db');
    assert.equal(normalizeManagedRelativePath('routing/valhalla_tiles'), 'routing/valhalla_tiles');
});

test('buildResolvedAssetCandidates yields ordered runtime search paths', () => {
    const candidates = buildResolvedAssetCandidates('assets/data/location_aliases.db', {
        documentDirectoryPath: '/documents',
        libraryDirectoryPath: '/library',
        cachesDirectoryPath: '/cache',
        mainBundlePath: '/bundle',
    });

    assert.deepEqual(candidates, [
        { source: 'document', path: '/documents/data/location_aliases.db' },
        { source: 'library', path: '/library/data/location_aliases.db' },
        { source: 'cache', path: '/cache/data/location_aliases.db' },
        { source: 'bundle', path: '/bundle/data/location_aliases.db' },
    ]);
});