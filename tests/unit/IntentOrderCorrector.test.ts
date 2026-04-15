import test from 'node:test';
import assert from 'node:assert/strict';

import type { IntentExtraction } from '../../src/core/llm/IntentExtractor.js';
import { correctOriginDestinationOrder } from '../../src/core/llm/IntentOrderCorrector.js';

const base: IntentExtraction = {
    detectedLanguage: 'English',
    intent: 'route',
    origin: null,
    destination: null,
    poiQuery: null,
    requiresDisambiguation: false,
    rawQuery: '',
};

test('leaves non-route intents untouched', () => {
    const input: IntentExtraction = { ...base, intent: 'poi_lookup', origin: 'A', destination: 'B', rawQuery: 'Find the British Museum' };
    assert.deepEqual(correctOriginDestinationOrder(input), input);
});

test('swaps origin and destination when "from X to Y" disagrees', () => {
    const input: IntentExtraction = {
        ...base,
        intent: 'route',
        origin: 'Baker Street',
        destination: 'Waterloo',
        rawQuery: 'How do I get from Waterloo to Baker Street?',
    };

    const corrected = correctOriginDestinationOrder(input);
    assert.equal(corrected.origin, 'Waterloo');
    assert.equal(corrected.destination, 'Baker Street');
});

test('keeps extraction when "from X to Y" already agrees', () => {
    const input: IntentExtraction = {
        ...base,
        intent: 'route',
        origin: 'Waterloo',
        destination: 'Baker Street',
        rawQuery: 'from Waterloo to Baker Street',
    };

    assert.deepEqual(correctOriginDestinationOrder(input), input);
});

test('flips destination-only queries when LLM tagged dest as origin', () => {
    const input: IntentExtraction = {
        ...base,
        intent: 'route',
        origin: 'Waterloo',
        destination: null,
        rawQuery: 'Take me to Waterloo',
    };

    const corrected = correctOriginDestinationOrder(input);
    assert.equal(corrected.origin, null);
    assert.equal(corrected.destination, 'Waterloo');
});

test('falls back to word order when no prepositions match', () => {
    const input: IntentExtraction = {
        ...base,
        intent: 'route',
        origin: 'Baker Street',
        destination: 'Waterloo',
        rawQuery: 'Waterloo, Baker Street',
    };

    const corrected = correctOriginDestinationOrder(input);
    assert.equal(corrected.origin, 'Waterloo');
    assert.equal(corrected.destination, 'Baker Street');
});

test('leaves extraction alone when neither name appears in raw text', () => {
    const input: IntentExtraction = {
        ...base,
        intent: 'route',
        origin: 'A',
        destination: 'B',
        rawQuery: 'completely unrelated text',
    };

    assert.deepEqual(correctOriginDestinationOrder(input), input);
});

test('moves destination to origin and extracts after-to fragment when LLM mistags', () => {
    const input: IntentExtraction = {
        ...base,
        intent: 'route',
        origin: null,
        destination: 'Waterloo',
        rawQuery: 'Waterloo to London Eye',
    };

    const corrected = correctOriginDestinationOrder(input);
    assert.equal(corrected.origin, 'Waterloo');
    assert.equal(corrected.destination, 'London Eye');
});

test('leaves same-station extractions alone', () => {
    const input: IntentExtraction = {
        ...base,
        intent: 'route',
        origin: 'Waterloo',
        destination: 'Waterloo',
        rawQuery: 'Waterloo to Waterloo',
    };

    assert.deepEqual(correctOriginDestinationOrder(input), input);
});
