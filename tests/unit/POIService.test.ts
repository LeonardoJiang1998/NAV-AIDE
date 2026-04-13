import test from 'node:test';
import assert from 'node:assert/strict';

import { POIService, type POIRecord } from '../../src/core/poi/POIService.js';

const pois: POIRecord[] = [
    { id: 'british-museum', canonicalName: 'British Museum', category: 'museum', aliases: ['The British Museum'] },
    { id: 'natural-history-museum', canonicalName: 'Natural History Museum', category: 'museum', aliases: ['NHM'] },
    { id: 'tower-of-london', canonicalName: 'Tower of London', category: 'landmark', aliases: ['The Tower'] },
    { id: 'buckingham-palace', canonicalName: 'Buckingham Palace', category: 'landmark', aliases: ['The Palace'] },
    { id: 'hyde-park', canonicalName: 'Hyde Park', category: 'park', aliases: [] },
];

test('POIService returns matching results ranked by confidence', () => {
    const service = new POIService(pois);
    const results = service.search('British Museum');

    assert.ok(results.length > 0, 'Expected at least one result');
    assert.equal(results[0].poi.id, 'british-museum');
    assert.equal(results[0].confidence, 1);
});

test('POIService matches via alias', () => {
    const service = new POIService(pois);
    const results = service.search('The Tower');

    assert.ok(results.length > 0, 'Expected at least one result');
    assert.equal(results[0].poi.id, 'tower-of-london');
});

test('POIService returns empty array when no match clears the 0.7 threshold', () => {
    const service = new POIService(pois);
    const results = service.search('Atlantis Underwater Museum');

    assert.equal(results.length, 0);
});

test('POIService respects the default limit of 3 results', () => {
    const service = new POIService(pois);
    const results = service.search('Museum');

    assert.ok(results.length <= 3, `Expected at most 3 results, got ${results.length}`);
});

test('POIService respects a custom limit', () => {
    const service = new POIService(pois);
    const results = service.search('Museum', 1);

    assert.ok(results.length <= 1, `Expected at most 1 result, got ${results.length}`);
});

test('POIService returns empty array when no POIs are loaded', () => {
    const service = new POIService([]);
    const results = service.search('British Museum');

    assert.equal(results.length, 0);
});

test('POIService results have confidence scores at or above 0.7', () => {
    const service = new POIService(pois);
    const results = service.search('Hyde Park');

    for (const result of results) {
        assert.ok(result.confidence >= 0.7, `Confidence ${result.confidence} below threshold`);
    }
});
