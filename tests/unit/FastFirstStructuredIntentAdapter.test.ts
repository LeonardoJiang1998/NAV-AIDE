import test from 'node:test';
import assert from 'node:assert/strict';

import { FastFirstStructuredIntentAdapter } from '../../src/app/model/LlamaBackedAdapters.js';
import type { StructuredIntentModelAdapter } from '../../src/core/runtime/ModelAdapterContracts.js';

interface FakeIntent {
    intent: string;
    origin: string | null;
    destination: string | null;
    poiQuery: string | null;
}

class StubAdapter implements StructuredIntentModelAdapter {
    public callCount = 0;
    public constructor(private readonly response: FakeIntent | Error) {}
    public async generateStructured<T>(): Promise<T> {
        this.callCount += 1;
        if (this.response instanceof Error) throw this.response;
        return this.response as unknown as T;
    }
}

const route = (origin: string | null, destination: string | null): FakeIntent => ({
    intent: 'route',
    origin,
    destination,
    poiQuery: null,
});

test('FastFirstStructuredIntentAdapter returns rule-based result when confident (route with origin+destination)', async () => {
    const fast = new StubAdapter(route('Waterloo', 'Baker Street'));
    const slow = new StubAdapter(new Error('LLM should not run'));
    const adapter = new FastFirstStructuredIntentAdapter(fast, slow);

    const result = await adapter.generateStructured<FakeIntent>({ prompt: 'Waterloo to Baker Street', schema: {} });

    assert.equal(result.origin, 'Waterloo');
    assert.equal(result.destination, 'Baker Street');
    assert.equal(slow.callCount, 0, 'LLM should not be invoked when rule extractor is confident');
});

test('FastFirstStructuredIntentAdapter returns rule-based result when only destination is set (Take me to X)', async () => {
    const fast = new StubAdapter(route(null, 'Waterloo'));
    const slow = new StubAdapter(new Error('LLM should not run'));
    const adapter = new FastFirstStructuredIntentAdapter(fast, slow);

    const result = await adapter.generateStructured<FakeIntent>({ prompt: 'Take me to Waterloo', schema: {} });

    assert.equal(result.destination, 'Waterloo');
    assert.equal(slow.callCount, 0);
});

test('FastFirstStructuredIntentAdapter falls back to LLM when rule extractor returns intent="unknown"', async () => {
    const fast = new StubAdapter({ intent: 'unknown', origin: null, destination: null, poiQuery: null });
    const slow = new StubAdapter(route('Bank', 'Liverpool Street'));
    const adapter = new FastFirstStructuredIntentAdapter(fast, slow);

    const result = await adapter.generateStructured<FakeIntent>({ prompt: 'gibberish', schema: {} });

    assert.equal(slow.callCount, 1, 'LLM should be invoked on unknown intent');
    assert.equal(result.origin, 'Bank');
});

test('FastFirstStructuredIntentAdapter falls back to LLM for route with neither endpoint', async () => {
    const fast = new StubAdapter(route(null, null));
    const slow = new StubAdapter(route('Bank', 'Liverpool Street'));
    const adapter = new FastFirstStructuredIntentAdapter(fast, slow);

    await adapter.generateStructured<FakeIntent>({ prompt: 'just curious', schema: {} });
    assert.equal(slow.callCount, 1);
});

test('FastFirstStructuredIntentAdapter keeps rule-based answer if LLM throws', async () => {
    const fast = new StubAdapter({ intent: 'unknown', origin: null, destination: null, poiQuery: null });
    const slow = new StubAdapter(new Error('llama crashed'));
    const adapter = new FastFirstStructuredIntentAdapter(fast, slow);

    const result = await adapter.generateStructured<FakeIntent>({ prompt: 'whatever', schema: {} });

    assert.equal(result.intent, 'unknown');
});

test('FastFirstStructuredIntentAdapter falls back to LLM for poi_lookup with no query', async () => {
    const fast = new StubAdapter({ intent: 'poi_lookup', origin: null, destination: null, poiQuery: null });
    const slow = new StubAdapter({ intent: 'poi_lookup', origin: null, destination: null, poiQuery: 'British Museum' });
    const adapter = new FastFirstStructuredIntentAdapter(fast, slow);

    const result = await adapter.generateStructured<FakeIntent>({ prompt: 'find a museum', schema: {} });
    assert.equal(slow.callCount, 1);
    assert.equal(result.poiQuery, 'British Museum');
});
