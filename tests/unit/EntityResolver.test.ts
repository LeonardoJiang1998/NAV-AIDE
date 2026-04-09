import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ALIAS_MATCH_THRESHOLD,
    DISAMBIGUATION_THRESHOLD,
    EntityResolver,
    FUZZY_RESOLVE_THRESHOLD,
    type EntityRecord,
} from '../../src/core/pipeline/EntityResolver.js';

const records: EntityRecord[] = [
    {
        id: 'station-baker-street',
        canonicalName: 'Baker Street',
        type: 'station',
        aliases: ['Baker St'],
    },
    {
        id: 'station-green-park',
        canonicalName: 'Green Park',
        type: 'station',
        aliases: ['Green Pk'],
    },
    {
        id: 'station-park-royal',
        canonicalName: 'Park Royal',
        type: 'station',
        aliases: ['Park Royal Station'],
    },
    {
        id: 'poi-british-museum',
        canonicalName: 'British Museum',
        type: 'poi',
        aliases: ['The British Museum'],
    },
];

test('EntityResolver resolves exact canonical names without using the LLM', () => {
    const resolver = new EntityResolver(records);
    const result = resolver.resolve('Baker Street');

    assert.equal(result.status, 'resolved');
    assert.equal(result.bestCandidate?.entity.canonicalName, 'Baker Street');
    assert.equal(result.confidence, 1);
});

test('EntityResolver resolves exact aliases at the configured alias threshold', () => {
    const resolver = new EntityResolver(records);
    const result = resolver.resolve('Baker St');

    assert.equal(result.status, 'resolved');
    assert.equal(result.bestCandidate?.entity.canonicalName, 'Baker Street');
    assert.equal(result.confidence, ALIAS_MATCH_THRESHOLD);
});

test('EntityResolver returns disambiguation instead of guessing below the fuzzy resolve threshold', () => {
    const resolver = new EntityResolver(records);
    const result = resolver.resolve('Park');

    assert.equal(result.status, 'disambiguation');
    assert.ok(result.confidence >= DISAMBIGUATION_THRESHOLD);
    assert.ok(result.candidates.length > 1);
    assert.equal(result.candidates[0]?.entity.type, 'station');
});

test('EntityResolver resolves fuzzy POI queries when confidence clears the threshold gap', () => {
    const resolver = new EntityResolver(records);
    const result = resolver.resolve('British Mus');

    assert.equal(result.status, 'resolved');
    assert.equal(result.bestCandidate?.entity.canonicalName, 'British Museum');
    assert.ok((result.bestCandidate?.confidence ?? 0) >= FUZZY_RESOLVE_THRESHOLD);
});

test('EntityResolver returns unresolved when nothing is close enough', () => {
    const resolver = new EntityResolver(records);
    const result = resolver.resolve('Atlantis Central');

    assert.equal(result.status, 'unresolved');
    assert.equal(result.candidates.length, 0);
});