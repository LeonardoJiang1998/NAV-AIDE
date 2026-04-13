import test from 'node:test';
import assert from 'node:assert/strict';

import { ValhallaBridge, AssetAwareWalkingRouter, type WalkingRouteRequest } from '../../src/core/routing/ValhallaBridge.js';

const request: WalkingRouteRequest = {
    originName: 'Waterloo',
    destinationName: 'Westminster',
};

test('AssetAwareWalkingRouter returns ok status when assets are available', async () => {
    const router = new AssetAwareWalkingRouter(true);
    const result = await router.route(request);

    assert.equal(result.status, 'ok');
    assert.equal(result.distanceMeters, 500);
    assert.equal(result.durationMinutes, 7);
    assert.ok(result.instructions.length > 0);
    assert.ok(result.instructions[0].includes('Waterloo'));
    assert.ok(result.instructions[0].includes('Westminster'));
});

test('AssetAwareWalkingRouter returns asset-unavailable when assets are missing', async () => {
    const router = new AssetAwareWalkingRouter(false);
    const result = await router.route(request);

    assert.equal(result.status, 'asset-unavailable');
    assert.equal(result.distanceMeters, 0);
    assert.equal(result.durationMinutes, 0);
    assert.ok(result.instructions.length > 0);
    assert.ok(result.instructions[0].includes('unavailable'));
});

test('ValhallaBridge delegates to the injected router', async () => {
    const inner = new AssetAwareWalkingRouter(true);
    const bridge = new ValhallaBridge(inner);
    const result = await bridge.route(request);

    assert.equal(result.status, 'ok');
    assert.equal(result.distanceMeters, 500);
});

test('ValhallaBridge propagates asset-unavailable from inner router', async () => {
    const inner = new AssetAwareWalkingRouter(false);
    const bridge = new ValhallaBridge(inner);
    const result = await bridge.route(request);

    assert.equal(result.status, 'asset-unavailable');
});

test('AssetAwareWalkingRouter includes origin and destination in instructions', async () => {
    const router = new AssetAwareWalkingRouter(true);
    const customRequest: WalkingRouteRequest = {
        originName: 'Baker Street',
        destinationName: 'Green Park',
    };
    const result = await router.route(customRequest);

    assert.ok(result.instructions[0].includes('Baker Street'));
    assert.ok(result.instructions[0].includes('Green Park'));
});
