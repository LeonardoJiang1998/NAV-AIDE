import test from 'node:test';
import assert from 'node:assert/strict';

import cases from './fixtures/query-pipeline-cases.json' with { type: 'json' };
import { DeviceID } from '../../src/analytics/DeviceID.js';
import { EventLogger } from '../../src/analytics/EventLogger.js';
import { IntentExtractor, type IntentExtraction, type StructuredJsonModelClient } from '../../src/core/llm/IntentExtractor.js';
import { ResponseRenderer, type NaturalLanguageRenderClient } from '../../src/core/llm/ResponseRenderer.js';
import { POIService, type POIRecord } from '../../src/core/poi/POIService.js';
import { QueryPipeline } from '../../src/core/pipeline/QueryPipeline.js';
import { EntityResolver, type EntityRecord } from '../../src/core/pipeline/EntityResolver.js';
import { Dijkstra } from '../../src/core/routing/Dijkstra.js';
import { AssetAwareWalkingRouter, ValhallaBridge } from '../../src/core/routing/ValhallaBridge.js';
import { CacheAwareDisruptionService, StaticDisruptionSource } from '../../src/core/services/DisruptionService.js';
import { assertGoldenOutputHasNoHallucinations } from './helpers/hallucinationAssertion.js';
import type { GoldenPipelineCase } from './types.js';

const entities: EntityRecord[] = [
    { id: 'waterloo', canonicalName: 'Waterloo', type: 'station', aliases: [] },
    { id: 'westminster', canonicalName: 'Westminster', type: 'station', aliases: [] },
    { id: 'green-park', canonicalName: 'Green Park', type: 'station', aliases: ['Park'] },
    { id: 'baker-street', canonicalName: 'Baker Street', type: 'station', aliases: [] },
    { id: 'british-museum', canonicalName: 'British Museum', type: 'poi', aliases: ['The British Museum'] },
];

const pois: POIRecord[] = [
    { id: 'british-museum', canonicalName: 'British Museum', category: 'museum', aliases: ['The British Museum'] },
];

const graph = {
    nodes: [
        { id: 'waterloo', name: 'Waterloo' },
        { id: 'westminster', name: 'Westminster' },
        { id: 'green-park', name: 'Green Park' },
        { id: 'baker-street', name: 'Baker Street' },
    ],
    edges: [
        { from: 'waterloo', to: 'westminster', cost: 2 },
        { from: 'westminster', to: 'green-park', cost: 2 },
        { from: 'green-park', to: 'baker-street', cost: 4 },
    ],
};

class StubIntentClient implements StructuredJsonModelClient {
    public async generate<T>(request: { prompt: string }): Promise<T> {
        if (request.prompt.includes('How do I get from Waterloo to Baker Street?')) {
            return {
                detectedLanguage: 'English',
                intent: 'route',
                origin: 'Waterloo',
                destination: 'Baker Street',
                poiQuery: null,
                requiresDisambiguation: false,
                rawQuery: 'How do I get from Waterloo to Baker Street?',
            } as T;
        }

        return {
            detectedLanguage: 'English',
            intent: 'poi_lookup',
            origin: null,
            destination: null,
            poiQuery: 'British Museum',
            requiresDisambiguation: false,
            rawQuery: 'Find the British Museum',
        } as T;
    }
}

class StubRenderClient implements NaturalLanguageRenderClient {
    public async render(request: { prompt: string }) {
        if (request.prompt.includes('Route from Waterloo to Baker Street')) {
            return {
                text: 'Route from Waterloo to Baker Street costs 8 minutes.',
                referencedPlaceNames: ['Waterloo', 'Westminster', 'Green Park', 'Baker Street'],
            };
        }

        return {
            text: 'POI match: British Museum.',
            referencedPlaceNames: ['British Museum'],
        };
    }
}

function createPipeline() {
    return new QueryPipeline({
        intentExtractor: new IntentExtractor(new StubIntentClient()),
        entityResolver: new EntityResolver(entities),
        poiService: new POIService(pois),
        router: new Dijkstra(),
        walkingRouter: new ValhallaBridge(new AssetAwareWalkingRouter(true)),
        responseRenderer: new ResponseRenderer(new StubRenderClient()),
        disruptionService: new CacheAwareDisruptionService(new StaticDisruptionSource([]), () => 0),
        eventLogger: new EventLogger(),
        graph,
    });
}

for (const goldenCase of cases as GoldenPipelineCase[]) {
    test(`golden pipeline case: ${goldenCase.id}`, async () => {
        const pipeline = createPipeline();
        const result = await pipeline.execute(goldenCase.rawQuery, entities.filter((entity) => entity.type === 'station').map((entity) => entity.canonicalName));

        assert.equal(result.status, goldenCase.expectedStatus);
        assert.equal(result.extraction.intent, goldenCase.expectedIntent);
        assert.equal(result.rendered?.text, goldenCase.expectedRenderedText);
        assertGoldenOutputHasNoHallucinations(result.rendered?.referencedPlaceNames ?? [], goldenCase.allowedPlaceNames);
    });
}

test('hallucination assertion helper rejects disallowed place names', () => {
    assert.throws(
        () => assertGoldenOutputHasNoHallucinations(['Waterloo', 'London Bridge'], ['Waterloo']),
        /Hallucinated place names detected/
    );
});

test('device id generation is deterministic for a seed', () => {
    assert.equal(DeviceID.fromSeed('offline-seed'), DeviceID.fromSeed('offline-seed'));
});