import test from 'node:test';
import assert from 'node:assert/strict';

import {
    HaversineWalkingRouter,
    type GeoPoint,
    type PlaceCoordinateProvider,
} from '../../src/core/routing/HaversineWalkingRouter.js';

class StubCoords implements PlaceCoordinateProvider {
    public constructor(private readonly points: Map<string, GeoPoint>) {}
    public findCoordinate(name: string): GeoPoint | null {
        return this.points.get(name) ?? null;
    }
}

test('HaversineWalkingRouter returns asset-unavailable when either coord is missing', async () => {
    const router = new HaversineWalkingRouter(new StubCoords(new Map()));
    const result = await router.route({ originName: 'Nowhere', destinationName: 'Baker Street' });

    assert.equal(result.status, 'asset-unavailable');
    assert.equal(result.distanceMeters, 0);
    assert.ok(result.instructions[0].includes('Walking estimate unavailable'));
});

test('HaversineWalkingRouter computes distance and walking time for real coordinates', async () => {
    const coords = new Map<string, GeoPoint>([
        ['Waterloo', { lat: 51.5032, lon: -0.1115 }],
        ['Baker Street', { lat: 51.5226, lon: -0.1571 }],
    ]);
    const router = new HaversineWalkingRouter(new StubCoords(coords));
    const result = await router.route({ originName: 'Waterloo', destinationName: 'Baker Street' });

    assert.equal(result.status, 'ok');
    // Waterloo ↔ Baker Street is ~3.7 km as the crow flies; with 20% padding
    // we expect ~4.4 km. Allow a generous margin to keep the test robust.
    assert.ok(result.distanceMeters > 3500 && result.distanceMeters < 6000);
    assert.ok(result.durationMinutes >= 40 && result.durationMinutes <= 80);
    assert.ok(result.instructions[0].includes('Walk approximately'));
    // Bearing phrasing should be present
    assert.ok(result.instructions.some((line) => /(north|south|east|west)/.test(line)));
    // Long-walk suggestion should kick in
    assert.ok(result.instructions.some((line) => line.includes('tube') || line.includes('bus')));
});

test('HaversineWalkingRouter handles very short walks without suggesting tube', async () => {
    const coords = new Map<string, GeoPoint>([
        // ~100m apart
        ['A', { lat: 51.5032, lon: -0.1115 }],
        ['B', { lat: 51.5041, lon: -0.1115 }],
    ]);
    const router = new HaversineWalkingRouter(new StubCoords(coords));
    const result = await router.route({ originName: 'A', destinationName: 'B' });

    assert.equal(result.status, 'ok');
    assert.ok(result.distanceMeters < 200);
    assert.ok(!result.instructions.some((line) => line.includes('consider taking the tube')));
});
