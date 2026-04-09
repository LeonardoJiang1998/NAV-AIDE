import { EventLogger } from '../../analytics/EventLogger';
import { IntentExtractor } from '../../core/llm/IntentExtractor';
import { ResponseRenderer } from '../../core/llm/ResponseRenderer';
import { POIService } from '../../core/poi/POIService';
import { EntityResolver } from '../../core/pipeline/EntityResolver';
import { QueryPipeline } from '../../core/pipeline/QueryPipeline';
import { Dijkstra } from '../../core/routing/Dijkstra';
import { AssetAwareWalkingRouter, ValhallaBridge } from '../../core/routing/ValhallaBridge';
import { CacheAwareDisruptionService, StaticDisruptionSource } from '../../core/services/DisruptionService';

import { disruptions, entities, graph, knownStations, pois } from './mobileFixtures';
import { RuleBasedRenderClient, RuleBasedStructuredModelClient } from './RuleBasedModelBridge';

export function createMobilePipeline() {
    const entityResolver = new EntityResolver(entities);

    return {
        knownStations,
        entityResolver,
        queryPipeline: new QueryPipeline({
            intentExtractor: new IntentExtractor(new RuleBasedStructuredModelClient(knownStations)),
            entityResolver,
            poiService: new POIService(pois),
            router: new Dijkstra(),
            walkingRouter: new ValhallaBridge(new AssetAwareWalkingRouter(true)),
            responseRenderer: new ResponseRenderer(new RuleBasedRenderClient()),
            disruptionService: new CacheAwareDisruptionService(new StaticDisruptionSource(disruptions)),
            eventLogger: new EventLogger(),
            graph,
        }),
    };
}