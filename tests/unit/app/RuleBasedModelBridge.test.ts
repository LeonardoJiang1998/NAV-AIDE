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

test('RuleBasedStructuredModelClient extracts destination-only POI without origin', async () => {
    const client = new RuleBasedStructuredModelClient(['Waterloo', 'Baker Street', 'Green Park']);
    const result = await client.generateStructured<any>({ prompt: 'User query: Take me to the British Museum', schema: {} });

    assert.equal(result.intent, 'route');
    assert.equal(result.origin, null);
    assert.equal(result.destination, 'the British Museum');
    assert.equal(result.requiresDisambiguation, false);
});

test('RuleBasedStructuredModelClient assigns single station to origin for "From X" queries', async () => {
    const client = new RuleBasedStructuredModelClient(['Waterloo', 'Baker Street', 'Green Park']);
    const result = await client.generateStructured<any>({ prompt: 'User query: From Waterloo', schema: {} });

    assert.equal(result.intent, 'route');
    assert.equal(result.origin, 'Waterloo');
    assert.equal(result.destination, null);
});

test('RuleBasedStructuredModelClient assigns single station to destination for "Take me to X" queries', async () => {
    const client = new RuleBasedStructuredModelClient(['Waterloo', 'Baker Street', 'Green Park']);
    const result = await client.generateStructured<any>({ prompt: 'User query: Take me to Baker Street', schema: {} });

    assert.equal(result.intent, 'route');
    assert.equal(result.origin, null);
    assert.equal(result.destination, 'Baker Street');
});