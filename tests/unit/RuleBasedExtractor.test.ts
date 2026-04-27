import test from 'node:test';
import assert from 'node:assert/strict';

import { RuleBasedStructuredModelClient } from '../../src/app/pipeline/RuleBasedModelBridge.js';

const knownStations = ['Bank', 'Westminster', 'Waterloo', 'Baker Street', 'Stratford'];

async function extract(prompt: string) {
    const client = new RuleBasedStructuredModelClient(knownStations);
    return client.generateStructured<{
        intent: string;
        origin: string | null;
        destination: string | null;
        poiQuery: string | null;
    }>({
        prompt: `User query: ${prompt}`,
        schema: {},
    });
}

test('does not split "Tower" mid-word when extracting destination', async () => {
    const r = await extract('Show me the route to Tower of London');
    assert.equal(r.intent, 'route');
    assert.equal(r.destination, 'Tower of London', 'previously yielded "wer of London" because /to/ matched mid-word');
});

test('strips trailing punctuation from extracted destination', async () => {
    const r = await extract('How do I get to Buckingham Palace?');
    assert.equal(r.destination, 'Buckingham Palace');
});

test('preserves origin/destination via word-boundary split', async () => {
    const r = await extract('I want to go from Bank to Westminster');
    assert.equal(r.origin, 'Bank');
    assert.equal(r.destination, 'Westminster');
});

test('handles "X to Y" with both stations matched', async () => {
    const r = await extract('Stratford to Westminster');
    assert.equal(r.intent, 'route');
    assert.ok(r.origin && r.destination);
});
