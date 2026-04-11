import { EventLogger } from '../../analytics/EventLogger.js';
import { IntentExtractor } from '../llm/IntentExtractor.js';
import { ResponseRenderer } from '../llm/ResponseRenderer.js';
import { POIService, type POIRecord } from '../poi/POIService.js';
import { EntityResolver, type EntityRecord } from './EntityResolver.js';
import { QueryPipeline } from './QueryPipeline.js';
import { Dijkstra, type WeightedGraph } from '../routing/Dijkstra.js';
import { AssetAwareWalkingRouter, ValhallaBridge } from '../routing/ValhallaBridge.js';
import { CacheAwareDisruptionService, StaticDisruptionSource, type DisruptionEvent } from '../services/DisruptionService.js';
import type { NaturalLanguageRenderAdapter, StructuredIntentModelAdapter } from '../runtime/ModelAdapterContracts.js';

export interface QueryPipelineRuntimeAdapters {
    intentModel: StructuredIntentModelAdapter;
    responseModel: NaturalLanguageRenderAdapter;
}

export interface QueryPipelineRuntimeFixtures {
    knownStations: string[];
    entities: EntityRecord[];
    pois: POIRecord[];
    graph: WeightedGraph;
    disruptions: DisruptionEvent[];
    walkingAssetsAvailable: boolean;
    now?: () => number;
    eventLogger?: EventLogger;
}

export function createQueryPipelineRuntime(adapters: QueryPipelineRuntimeAdapters, fixtures: QueryPipelineRuntimeFixtures) {
    const entityResolver = new EntityResolver(fixtures.entities);
    const eventLogger = fixtures.eventLogger ?? new EventLogger();

    return {
        knownStations: fixtures.knownStations,
        entityResolver,
        eventLogger,
        queryPipeline: new QueryPipeline({
            intentExtractor: new IntentExtractor(adapters.intentModel),
            entityResolver,
            poiService: new POIService(fixtures.pois),
            router: new Dijkstra(),
            walkingRouter: new ValhallaBridge(new AssetAwareWalkingRouter(fixtures.walkingAssetsAvailable)),
            responseRenderer: new ResponseRenderer(adapters.responseModel),
            disruptionService: new CacheAwareDisruptionService(new StaticDisruptionSource(fixtures.disruptions), fixtures.now),
            eventLogger,
            graph: fixtures.graph,
        }),
    };
}