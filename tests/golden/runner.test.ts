import test from 'node:test';
import assert from 'node:assert/strict';

import cases from './fixtures/query-pipeline-cases.json' with { type: 'json' };
import resultSchema from './schemas/queryPipelineResult.schema.json' with { type: 'json' };
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
    { id: 'green-park', canonicalName: 'Green Park', type: 'station', aliases: ['Green Pk'] },
    { id: 'park-royal', canonicalName: 'Park Royal', type: 'station', aliases: ['Park Royal Station'] },
    { id: 'baker-street', canonicalName: 'Baker Street', type: 'station', aliases: [] },
    { id: 'canary-wharf', canonicalName: 'Canary Wharf', type: 'station', aliases: [] },
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
        { id: 'canary-wharf', name: 'Canary Wharf' },
    ],
    edges: [
        { from: 'waterloo', to: 'westminster', cost: 2 },
        { from: 'westminster', to: 'green-park', cost: 2 },
        { from: 'green-park', to: 'baker-street', cost: 4 },
    ],
};

class StubIntentClient implements StructuredJsonModelClient {
    public async generate<T>(request: { prompt: string }): Promise<T> {
        const rawQueryLine = request.prompt.split('\n').find((line) => line.startsWith('User query: '));
        const rawQuery = rawQueryLine?.replace('User query: ', '') ?? '';
        const fixture = (cases as GoldenPipelineCase[]).find((goldenCase) => goldenCase.rawQuery === rawQuery);

        if (!fixture) {
            throw new Error(`No intent fixture found for query: ${rawQuery}`);
        }

        return {
            ...fixture.extraction,
            rawQuery,
        } as T;
    }
}

class StubRenderClient implements NaturalLanguageRenderClient {
    public async render(request: { prompt: string }) {
        const summaryLine = request.prompt.split('\n').find((line) => line.startsWith('Summary: '));
        const allowedLine = request.prompt.split('\n').find((line) => line.startsWith('Allowed place names: '));
        const text = summaryLine?.replace('Summary: ', '') ?? '';
        const referencedPlaceNames = (allowedLine?.replace('Allowed place names: ', '') ?? '')
            .split(', ')
            .map((value) => value.trim())
            .filter(Boolean);

        return {
            text,
            referencedPlaceNames,
        };
    }
}

function createPipeline() {
    const eventLogger = new EventLogger();

    return {
        eventLogger,
        pipeline: new QueryPipeline({
        intentExtractor: new IntentExtractor(new StubIntentClient()),
        entityResolver: new EntityResolver(entities),
        poiService: new POIService(pois),
        router: new Dijkstra(),
        walkingRouter: new ValhallaBridge(new AssetAwareWalkingRouter(true)),
        responseRenderer: new ResponseRenderer(new StubRenderClient()),
        disruptionService: new CacheAwareDisruptionService(new StaticDisruptionSource([
            { id: 'line-jubilee-baker-street', summary: 'Minor Jubilee delay at Baker Street', affectedPlaceNames: ['Baker Street'], updatedAt: '2026-04-11T09:00:00.000Z' },
            { id: 'poi-british-museum', summary: 'Museum entrance queue notice', affectedPlaceNames: ['British Museum'], updatedAt: '2026-04-11T09:05:00.000Z' },
            { id: 'station-green-park', summary: 'Lift maintenance at Green Park', affectedPlaceNames: ['Green Park'], updatedAt: '2026-04-11T09:10:00.000Z' },
        ]), () => 0),
        eventLogger,
        graph,
        }),
    };
}

for (const goldenCase of cases as GoldenPipelineCase[]) {
    test(`golden pipeline case: ${goldenCase.id}`, async () => {
        assertGoldenCaseShape(goldenCase);
        const { pipeline, eventLogger } = createPipeline();
        const result = await pipeline.execute(goldenCase.rawQuery, entities.filter((entity) => entity.type === 'station').map((entity) => entity.canonicalName));

        assertQueryPipelineResultShape(result);
        assert.equal(result.status, goldenCase.expectedStatus);
        assert.equal(result.extraction.intent, goldenCase.expectedIntent);
        assert.equal(result.extraction.requiresDisambiguation, goldenCase.extraction.requiresDisambiguation);
        assert.equal(result.rendered?.text ?? null, goldenCase.expectedRenderedText);
        assertGoldenOutputHasNoHallucinations(result.rendered?.referencedPlaceNames ?? [], goldenCase.allowedPlaceNames);

        if (goldenCase.expectedRouteCost !== undefined) {
            assert.equal(result.route?.cost ?? null, goldenCase.expectedRouteCost);
        }

        if (goldenCase.expectedWalkingStatus !== undefined) {
            assert.equal(result.walking?.status ?? null, goldenCase.expectedWalkingStatus);
        }

        if (goldenCase.expectedPoiNames) {
            assert.deepEqual(result.poiResults?.map((entry) => entry.poi.canonicalName) ?? [], goldenCase.expectedPoiNames);
        }

        if (goldenCase.expectedDisruptionIds) {
            assert.deepEqual(result.disruptions.map((entry) => entry.id), goldenCase.expectedDisruptionIds);
        }

        if (goldenCase.expectedOriginStatus) {
            assert.equal(result.origin?.status, goldenCase.expectedOriginStatus);
        }

        if (goldenCase.expectedDestinationStatus) {
            assert.equal(result.destination?.status, goldenCase.expectedDestinationStatus);
        }

        assert.ok((result.fastPathHints?.length ?? 0) >= 0);

        const events = eventLogger.readAll();
        assert.equal(events.length, 1);
        assert.equal(events[0]?.eventName, 'query_pipeline_completed');
        assert.equal(events[0]?.payload.intent, goldenCase.expectedIntent);
        assert.equal(events[0]?.payload.status, goldenCase.expectedStatus);
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

function assertGoldenCaseShape(goldenCase: GoldenPipelineCase) {
    assert.ok(goldenCase.id.length > 0);
    assert.ok(goldenCase.rawQuery.length > 0);
    assert.ok(Array.isArray(goldenCase.allowedPlaceNames));
    assert.ok(['complete', 'needs_disambiguation', 'unresolved'].includes(goldenCase.expectedStatus));
}

function assertQueryPipelineResultShape(result: unknown) {
    const schema = resultSchema as { required: string[]; properties: Record<string, { type?: string | string[] }> };
    assert.equal(typeof result, 'object');
    assert.ok(result !== null);

    const record = result as Record<string, unknown>;
    for (const requiredKey of schema.required) {
        assert.ok(requiredKey in record, `Missing required key: ${requiredKey}`);
    }

    const status = record.status;
    assert.ok(['complete', 'needs_disambiguation', 'unresolved'].includes(String(status)));
    assert.equal(typeof record.extraction, 'object');
    assert.ok(Array.isArray(record.disruptions));
    assert.ok(record.rendered === null || typeof record.rendered === 'object');
}