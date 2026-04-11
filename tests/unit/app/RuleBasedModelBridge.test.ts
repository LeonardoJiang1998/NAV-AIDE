import test from 'node:test';
import assert from 'node:assert/strict';

import { RuleBasedStructuredModelClient } from '../../../src/app/pipeline/RuleBasedModelBridge';

test('RuleBasedStructuredModelClient extracts a route query into structured intent', async () => {
    const client = new RuleBasedStructuredModelClient(['Waterloo', 'Baker Street', 'Green Park']);
    const result = await client.generateStructured<any>({ prompt: 'User query: How do I get from Waterloo to Baker Street?', schema: {} });

    assert.equal(result.intent, 'route');
    assert.equal(result.origin, 'Waterloo');
    assert.equal(result.destination, 'Baker Street');
});

test('RuleBasedStructuredModelClient keeps Park ambiguous', async () => {
    const client = new RuleBasedStructuredModelClient(['Green Park', 'Baker Street']);
    const result = await client.generateStructured<any>({ prompt: 'User query: Take me to Park', schema: {} });

    assert.equal(result.intent, 'route');
    assert.equal(result.destination, 'Park');
    assert.equal(result.requiresDisambiguation, true);
});