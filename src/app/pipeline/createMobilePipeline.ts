import { createQueryPipelineRuntime } from '../../core/pipeline/createQueryPipelineRuntime';

import { disruptions, entities, graph, knownStations, pois } from './mobileFixtures';
import { RuleBasedRenderClient, RuleBasedStructuredModelClient } from './RuleBasedModelBridge';

export function createMobilePipeline() {
    return createQueryPipelineRuntime(
        {
            intentModel: new RuleBasedStructuredModelClient(knownStations),
            responseModel: new RuleBasedRenderClient(),
        },
        {
            knownStations,
            entities,
            pois,
            graph,
            disruptions,
            walkingAssetsAvailable: true,
        }
    );
}