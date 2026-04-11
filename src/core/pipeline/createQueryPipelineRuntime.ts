import { EventLogger } from '../../analytics/EventLogger';
import { IntentExtractor } from '../llm/IntentExtractor';
import { ResponseRenderer } from '../llm/ResponseRenderer';
import { POIService, type POIRecord } from '../poi/POIService';
import { EntityResolver, type EntityRecord } from './EntityResolver';
import { QueryPipeline } from './QueryPipeline';
import { Dijkstra, type WeightedGraph } from '../routing/Dijkstra';
import { AssetAwareWalkingRouter, ValhallaBridge } from '../routing/ValhallaBridge';
import { CacheAwareDisruptionService, StaticDisruptionSource, type DisruptionEvent } from '../services/DisruptionService';
import type { DeviceIdProvider } from '../runtime/DeviceIdContracts';
import type { NaturalLanguageRenderAdapter, StructuredIntentModelAdapter } from '../runtime/ModelAdapterContracts';

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
    deviceIdProvider?: DeviceIdProvider;
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
            deviceIdProvider: fixtures.deviceIdProvider,
        }),
    };
}