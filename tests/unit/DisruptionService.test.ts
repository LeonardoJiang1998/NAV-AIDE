import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CacheAwareDisruptionService,
    StaticDisruptionSource,
    type DisruptionEvent,
    type CachePolicy,
} from '../../src/core/services/DisruptionService.js';

const events: DisruptionEvent[] = [
    { id: 'jubilee-delay', summary: 'Jubilee line delay', affectedPlaceNames: ['Baker Street', 'Green Park'], updatedAt: '2026-04-11T09:00:00Z' },
    { id: 'northern-closure', summary: 'Northern line closure', affectedPlaceNames: ['Bank', 'London Bridge'], updatedAt: '2026-04-11T10:00:00Z' },
    { id: 'central-signal', summary: 'Central line signal failure', affectedPlaceNames: ['Oxford Circus'], updatedAt: '2026-04-11T11:00:00Z' },
];

const policy: CachePolicy = { key: 'test-cache', maxAgeMs: 60_000 };

// --- StaticDisruptionSource ---

test('StaticDisruptionSource filters events by affected place names', async () => {
    const source = new StaticDisruptionSource(events);
    const result = await source.fetch(['Baker Street']);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'jubilee-delay');
});

test('StaticDisruptionSource returns multiple events when place names overlap', async () => {
    const source = new StaticDisruptionSource(events);
    const result = await source.fetch(['Baker Street', 'Bank']);

    assert.equal(result.length, 2);
    const ids = result.map((e) => e.id);
    assert.ok(ids.includes('jubilee-delay'));
    assert.ok(ids.includes('northern-closure'));
});

test('StaticDisruptionSource returns empty array when no places match', async () => {
    const source = new StaticDisruptionSource(events);
    const result = await source.fetch(['Paddington']);

    assert.equal(result.length, 0);
});

test('StaticDisruptionSource returns empty for empty place names', async () => {
    const source = new StaticDisruptionSource(events);
    const result = await source.fetch([]);

    assert.equal(result.length, 0);
});

// --- CacheAwareDisruptionService ---

test('CacheAwareDisruptionService returns fresh data on first call', async () => {
    let currentTime = 1000;
    const source = new StaticDisruptionSource(events);
    const service = new CacheAwareDisruptionService(source, () => currentTime);

    const result = await service.getDisruptions(['Baker Street'], policy);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'jubilee-delay');
});

test('CacheAwareDisruptionService returns cached data within TTL', async () => {
    let currentTime = 1000;
    let fetchCount = 0;
    const countingSource: StaticDisruptionSource & { fetch: (names: string[]) => Promise<DisruptionEvent[]> } = {
        async fetch(placeNames: string[]) {
            fetchCount += 1;
            return events.filter((e) => e.affectedPlaceNames.some((n) => placeNames.includes(n)));
        },
    };
    const service = new CacheAwareDisruptionService(countingSource, () => currentTime);

    await service.getDisruptions(['Baker Street'], policy);
    assert.equal(fetchCount, 1);

    // Advance time within TTL
    currentTime += 30_000;
    await service.getDisruptions(['Baker Street'], policy);
    assert.equal(fetchCount, 1, 'Should use cache, not re-fetch');
});

test('CacheAwareDisruptionService re-fetches after TTL expires', async () => {
    let currentTime = 1000;
    let fetchCount = 0;
    const countingSource = {
        async fetch(placeNames: string[]) {
            fetchCount += 1;
            return events.filter((e) => e.affectedPlaceNames.some((n) => placeNames.includes(n)));
        },
    };
    const service = new CacheAwareDisruptionService(countingSource, () => currentTime);

    await service.getDisruptions(['Baker Street'], policy);
    assert.equal(fetchCount, 1);

    // Advance time past TTL
    currentTime += 70_000;
    await service.getDisruptions(['Baker Street'], policy);
    assert.equal(fetchCount, 2, 'Should re-fetch after TTL expiry');
});

test('CacheAwareDisruptionService uses separate caches for different policy keys', async () => {
    let currentTime = 1000;
    const source = new StaticDisruptionSource(events);
    const service = new CacheAwareDisruptionService(source, () => currentTime);

    const policyA: CachePolicy = { key: 'cache-a', maxAgeMs: 60_000 };
    const policyB: CachePolicy = { key: 'cache-b', maxAgeMs: 60_000 };

    const resultA = await service.getDisruptions(['Baker Street'], policyA);
    const resultB = await service.getDisruptions(['Oxford Circus'], policyB);

    assert.equal(resultA.length, 1);
    assert.equal(resultA[0].id, 'jubilee-delay');
    assert.equal(resultB.length, 1);
    assert.equal(resultB[0].id, 'central-signal');
});
