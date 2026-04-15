import test from 'node:test';
import assert from 'node:assert/strict';

import type { AssetStatus } from '../../../src/app/assets/AssetManager.js';
import type { LocalModelStatus } from '../../../src/app/model/LocalModelManager.js';
import type { MobilePipelineRuntimeState } from '../../../src/app/pipeline/createMobilePipeline.js';
import { deriveDemoReadiness } from '../../../src/app/state/readiness.js';
import type { VoiceRuntimeStatus } from '../../../src/app/voice/VoiceServices.js';

test('deriveDemoReadiness falls back when device assets exist but fail checksum validation', () => {
    const readiness = deriveDemoReadiness({
        assetStatus: buildAssetStatus([
            { key: 'map-mbtiles', exists: true, checksumMatches: false },
            { key: 'valhalla-tiles', exists: true, checksumMatches: false },
        ]),
        modelStatus: buildModelStatus(),
        runtimeState: buildRuntimeState(),
        voiceCapabilities: buildVoiceStatus(),
    });

    assert.equal(readiness.mode, 'fixture-fallback-mode');
    assert.equal(readiness.readyForInternalDemo, false);
    assert.ok(readiness.blockers.includes('MBTiles asset failed checksum validation.'));
    assert.ok(readiness.blockers.includes('Valhalla walking tiles failed checksum validation.'));
    assert.ok(readiness.warnings.includes('map-mbtiles failed checksum validation.'));
    assert.ok(readiness.warnings.includes('valhalla-tiles failed checksum validation.'));
    assert.ok(readiness.fallback.includes('Map tab asset exists but failed checksum validation, so offline map rendering is not trusted.'));
});

function buildAssetStatus(checks: AssetStatus['checks']): AssetStatus {
    return {
        ready: false,
        checks,
        resolvedPaths: {
            model: buildResolution('model', '/assets/model.gguf'),
            mapMbtiles: buildResolution('map-mbtiles', '/assets/maps/london.mbtiles'),
            poisDb: buildResolution('pois-db', '/assets/data/pois.db'),
            locationAliasesDb: buildResolution('location-aliases-db', '/assets/data/location_aliases.db'),
            walkingRouting: buildResolution('valhalla-tiles', '/assets/routing/valhalla_tiles'),
            disruptionCache: buildResolution('disruption-cache', '/assets/cache/disruptions.json'),
        },
    };
}

function buildRuntimeState(): MobilePipelineRuntimeState {
    return {
        source: 'sqlite-runtime',
        entitySource: 'sqlite',
        poiSource: 'sqlite',
        disruptionSource: 'fixture-static',
        walkingAssetsAvailable: true,
        reasons: [],
        entityCount: 10,
        poiCount: 10,
        probe: null,
        initializedAt: null,
    };
}

function buildModelStatus(): LocalModelStatus {
    return {
        loaded: true,
        modelPath: '/assets/model.gguf',
        backend: 'llama.rn',
    };
}

function buildVoiceStatus(): VoiceRuntimeStatus {
    return {
        stt: true,
        tts: true,
        microphonePermission: 'granted',
        locationPermission: 'granted',
        validationMode: 'device-check',
        notes: [],
    };
}

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
