import { EventLogger } from '../../analytics/EventLogger.js';
import { IntentExtractor, type IntentExtraction } from '../llm/IntentExtractor.js';
import { ResponseRenderer, type RenderedResponse } from '../llm/ResponseRenderer.js';
import { type POIResult, POIService } from '../poi/POIService.js';
import { Dijkstra, type ShortestPathResult, type WeightedGraph } from '../routing/Dijkstra.js';
import { ValhallaBridge, type WalkingRouteResult } from '../routing/ValhallaBridge.js';
import { CacheAwareDisruptionService, type DisruptionEvent } from '../services/DisruptionService.js';
import { EntityResolver, type EntityRecord, type ResolutionResult } from './EntityResolver.js';

export interface QueryPipelineDependencies {
    intentExtractor: IntentExtractor;
    entityResolver: EntityResolver;
    poiService: POIService;
    router: Dijkstra;
    walkingRouter: ValhallaBridge;
    responseRenderer: ResponseRenderer;
    disruptionService: CacheAwareDisruptionService;
    eventLogger: EventLogger;
    graph: WeightedGraph;
}

export interface QueryPipelineResult {
    status: 'complete' | 'needs_disambiguation' | 'unresolved';
    extraction: IntentExtraction;
    origin?: ResolutionResult;
    destination?: ResolutionResult;
    poiResults?: POIResult[];
    route?: ShortestPathResult | null;
    walking?: WalkingRouteResult;
    disruptions: DisruptionEvent[];
    rendered: RenderedResponse | null;
}

export class QueryPipeline {
    public constructor(private readonly dependencies: QueryPipelineDependencies) { }

    public async execute(rawQuery: string, knownStations: string[]): Promise<QueryPipelineResult> {
        const extraction = await this.dependencies.intentExtractor.extract(rawQuery, knownStations);
        const result = await this.resolveIntent(extraction);

        this.dependencies.eventLogger.log({
            eventName: 'query_pipeline_completed',
            deviceId: 'phase-2-node',
            occurredAt: new Date().toISOString(),
            payload: {
                intent: extraction.intent,
                status: result.status,
            },
        });

        return result;
    }

    private async resolveIntent(extraction: IntentExtraction): Promise<QueryPipelineResult> {
        switch (extraction.intent) {
            case 'route':
            case 'fare':
                return this.handleRouteIntent(extraction);
            case 'poi_lookup':
                return this.handlePoiIntent(extraction);
            case 'nearest_station':
            case 'lost_help':
                return this.handleLocationIntent(extraction);
            default:
                return {
                    status: 'unresolved',
                    extraction,
                    disruptions: [],
                    rendered: null,
                };
        }
    }

    private async handleRouteIntent(extraction: IntentExtraction): Promise<QueryPipelineResult> {
        const origin = extraction.origin ? this.dependencies.entityResolver.resolve(extraction.origin) : undefined;
        const destination = extraction.destination ? this.dependencies.entityResolver.resolve(extraction.destination) : undefined;

        if (!origin?.bestCandidate || !destination?.bestCandidate) {
            return { status: 'unresolved', extraction, origin, destination, disruptions: [], rendered: null };
        }

        if (origin.status !== 'resolved' || destination.status !== 'resolved') {
            return { status: 'needs_disambiguation', extraction, origin, destination, disruptions: [], rendered: null };
        }

        const route = this.dependencies.router.findShortestPath(
            this.dependencies.graph,
            origin.bestCandidate.entity.id,
            destination.bestCandidate.entity.id
        );

        const walking = await this.dependencies.walkingRouter.route({
            originName: origin.bestCandidate.entity.canonicalName,
            destinationName: destination.bestCandidate.entity.canonicalName,
        });

        const allowedPlaceNames = this.collectAllowedPlaceNames([
            origin.bestCandidate.entity,
            destination.bestCandidate.entity,
            ...this.entitiesFromRoute(route),
        ]);

        const disruptions = await this.dependencies.disruptionService.getDisruptions(allowedPlaceNames, {
            key: `route:${origin.bestCandidate.entity.id}:${destination.bestCandidate.entity.id}`,
            maxAgeMs: 5 * 60 * 1000,
        });

        const rendered = await this.dependencies.responseRenderer.render({
            intent: extraction.intent,
            summary: route
                ? `Route from ${origin.bestCandidate.entity.canonicalName} to ${destination.bestCandidate.entity.canonicalName} costs ${route.cost} minutes.`
                : `No route found from ${origin.bestCandidate.entity.canonicalName} to ${destination.bestCandidate.entity.canonicalName}.`,
            allowedPlaceNames,
        });

        return {
            status: route ? 'complete' : 'unresolved',
            extraction,
            origin,
            destination,
            route,
            walking,
            disruptions,
            rendered,
        };
    }

    private async handlePoiIntent(extraction: IntentExtraction): Promise<QueryPipelineResult> {
        const poiResults = extraction.poiQuery ? this.dependencies.poiService.search(extraction.poiQuery) : [];
        if (poiResults.length === 0) {
            return { status: 'unresolved', extraction, poiResults, disruptions: [], rendered: null };
        }

        const allowedPlaceNames = poiResults.map((result) => result.poi.canonicalName);
        const disruptions = await this.dependencies.disruptionService.getDisruptions(allowedPlaceNames, {
            key: `poi:${allowedPlaceNames.join('|')}`,
            maxAgeMs: 5 * 60 * 1000,
        });

        const rendered = await this.dependencies.responseRenderer.render({
            intent: extraction.intent,
            summary: `POI match: ${poiResults[0]?.poi.canonicalName}.`,
            allowedPlaceNames,
        });

        return {
            status: 'complete',
            extraction,
            poiResults,
            disruptions,
            rendered,
        };
    }

    private async handleLocationIntent(extraction: IntentExtraction): Promise<QueryPipelineResult> {
        const targetQuery = extraction.origin ?? extraction.destination ?? extraction.poiQuery;
        const resolution = targetQuery ? this.dependencies.entityResolver.resolve(targetQuery) : undefined;

        if (!resolution?.bestCandidate) {
            return { status: 'unresolved', extraction, origin: resolution, disruptions: [], rendered: null };
        }

        if (resolution.status !== 'resolved') {
            return { status: 'needs_disambiguation', extraction, origin: resolution, disruptions: [], rendered: null };
        }

        const allowedPlaceNames = [resolution.bestCandidate.entity.canonicalName];
        const disruptions = await this.dependencies.disruptionService.getDisruptions(allowedPlaceNames, {
            key: `location:${resolution.bestCandidate.entity.id}`,
            maxAgeMs: 5 * 60 * 1000,
        });

        const rendered = await this.dependencies.responseRenderer.render({
            intent: extraction.intent,
            summary: `${extraction.intent} match at ${resolution.bestCandidate.entity.canonicalName}.`,
            allowedPlaceNames,
        });

        return {
            status: 'complete',
            extraction,
            origin: resolution,
            disruptions,
            rendered,
        };
    }

    private entitiesFromRoute(route: ShortestPathResult | null): EntityRecord[] {
        if (!route) {
            return [];
        }

        return route.path
            .map((nodeId) => this.findEntity(nodeId))
            .filter((entity): entity is EntityRecord => entity !== null);
    }

    private findEntity(id: string): EntityRecord | null {
        const resolver = this.dependencies.entityResolver as EntityResolver & { records?: EntityRecord[] };
        const records = resolver['records'] as EntityRecord[] | undefined;
        return records?.find((record) => record.id === id) ?? null;
    }

    private collectAllowedPlaceNames(entities: EntityRecord[]): string[] {
        return [...new Set(entities.map((entity) => entity.canonicalName))];
    }
}