import { EventLogger } from '../../analytics/EventLogger';
import type { DeviceIdProvider } from '../runtime/DeviceIdContracts';
import { IntentExtractor, type IntentExtraction } from '../llm/IntentExtractor';
import { ResponseRenderer, type RenderedResponse } from '../llm/ResponseRenderer';
import { FuzzyMatcher } from '../poi/FuzzyMatcher';
import { type POIResult, POIService } from '../poi/POIService';
import { Dijkstra, type ShortestPathResult, type WeightedGraph } from '../routing/Dijkstra';
import { ValhallaBridge, type WalkingRouteResult } from '../routing/ValhallaBridge';
import { CacheAwareDisruptionService, type DisruptionEvent } from '../services/DisruptionService';
import { buildTubeSegments, type TubeSegment } from './TubeGraphTransforms';
import { EntityResolver, type EntityRecord, type ResolutionResult } from './EntityResolver';

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
    fuzzyMatcher?: FuzzyMatcher;
    deviceIdProvider?: DeviceIdProvider;
}

export interface QueryPipelineResult {
    status: 'complete' | 'needs_disambiguation' | 'unresolved';
    extraction: IntentExtraction;
    fastPathHints?: string[];
    origin?: ResolutionResult;
    destination?: ResolutionResult;
    poiResults?: POIResult[];
    route?: ShortestPathResult | null;
    tubeSegments?: TubeSegment[];
    walking?: WalkingRouteResult;
    disruptions: DisruptionEvent[];
    rendered: RenderedResponse | null;
}

export class QueryPipeline {
    public constructor(private readonly dependencies: QueryPipelineDependencies) { }

    public async execute(rawQuery: string, knownStations: string[]): Promise<QueryPipelineResult> {
        const fastPathHints = this.buildFastPathHints(rawQuery);
        const extraction = await this.dependencies.intentExtractor.extract(rawQuery, knownStations, { fastPathHints });
        const result = await this.resolveIntent(extraction, fastPathHints);
        const deviceId = await this.resolveDeviceId();

        this.dependencies.eventLogger.log({
            eventName: 'query_pipeline_completed',
            deviceId,
            occurredAt: new Date().toISOString(),
            payload: {
                intent: extraction.intent,
                status: result.status,
                fastPathHints,
            },
        });

        return result;
    }

    private async resolveDeviceId(): Promise<string> {
        if (!this.dependencies.deviceIdProvider) {
            return 'phase-2-node';
        }

        return this.dependencies.deviceIdProvider.getDeviceId();
    }

    private async resolveIntent(extraction: IntentExtraction, fastPathHints: string[]): Promise<QueryPipelineResult> {
        switch (extraction.intent) {
            case 'route':
            case 'fare':
                return this.handleRouteIntent(extraction, fastPathHints);
            case 'poi_lookup':
                return this.handlePoiIntent(extraction, fastPathHints);
            case 'nearest_station':
            case 'lost_help':
                return this.handleLocationIntent(extraction, fastPathHints);
            default:
                return {
                    status: 'unresolved',
                    extraction,
                    fastPathHints,
                    disruptions: [],
                    rendered: null,
                };
        }
    }

    private async handleRouteIntent(extraction: IntentExtraction, fastPathHints: string[]): Promise<QueryPipelineResult> {
        const origin = extraction.origin ? this.dependencies.entityResolver.resolve(extraction.origin) : undefined;
        const destination = extraction.destination ? this.dependencies.entityResolver.resolve(extraction.destination) : undefined;

        if (extraction.requiresDisambiguation) {
            return { status: 'needs_disambiguation', extraction, fastPathHints, origin, destination, disruptions: [], rendered: null };
        }

        if (!origin?.bestCandidate || !destination?.bestCandidate) {
            return { status: 'unresolved', extraction, fastPathHints, origin, destination, disruptions: [], rendered: null };
        }

        if (origin.status !== 'resolved' || destination.status !== 'resolved') {
            return { status: 'needs_disambiguation', extraction, fastPathHints, origin, destination, disruptions: [], rendered: null };
        }

        const route = this.dependencies.router.findShortestPath(
            this.dependencies.graph,
            origin.bestCandidate.entity.id,
            destination.bestCandidate.entity.id
        );

        const tubeSegments = route ? buildTubeSegments(route.path, this.dependencies.graph) : [];

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
            fastPathHints,
            origin,
            destination,
            route,
            tubeSegments,
            walking,
            disruptions,
            rendered,
        };
    }

    private async handlePoiIntent(extraction: IntentExtraction, fastPathHints: string[]): Promise<QueryPipelineResult> {
        const poiResults = extraction.poiQuery ? this.dependencies.poiService.search(extraction.poiQuery) : [];
        if (extraction.requiresDisambiguation) {
            return { status: 'needs_disambiguation', extraction, fastPathHints, poiResults, disruptions: [], rendered: null };
        }

        if (poiResults.length === 0) {
            return { status: 'unresolved', extraction, fastPathHints, poiResults, disruptions: [], rendered: null };
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
            fastPathHints,
            poiResults,
            disruptions,
            rendered,
        };
    }

    private async handleLocationIntent(extraction: IntentExtraction, fastPathHints: string[]): Promise<QueryPipelineResult> {
        const targetQuery = extraction.origin ?? extraction.destination ?? extraction.poiQuery;
        const resolution = targetQuery ? this.dependencies.entityResolver.resolve(targetQuery) : undefined;

        if (extraction.requiresDisambiguation) {
            return { status: 'needs_disambiguation', extraction, fastPathHints, origin: resolution, disruptions: [], rendered: null };
        }

        if (!resolution?.bestCandidate) {
            return { status: 'unresolved', extraction, fastPathHints, origin: resolution, disruptions: [], rendered: null };
        }

        if (resolution.status !== 'resolved') {
            return { status: 'needs_disambiguation', extraction, fastPathHints, origin: resolution, disruptions: [], rendered: null };
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
            fastPathHints,
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
        return this.dependencies.entityResolver.findById(id);
    }

    private collectAllowedPlaceNames(entities: EntityRecord[]): string[] {
        return [...new Set(entities.map((entity) => entity.canonicalName))];
    }

    private buildFastPathHints(rawQuery: string): string[] {
        const matcher = this.dependencies.fuzzyMatcher ?? new FuzzyMatcher();
        const normalizedQuery = matcher.normalize(rawQuery);

        if (!normalizedQuery) {
            return [];
        }

        const ranked = this.dependencies.entityResolver
            .allRecords()
            .map((record) => {
                const values = [record.canonicalName, ...record.aliases];
                const score = Math.max(
                    ...values.map((value) => {
                        const normalizedValue = matcher.normalize(value);
                        if (normalizedValue && normalizedQuery.includes(normalizedValue)) {
                            return 0.97;
                        }

                        return matcher.score(rawQuery, value);
                    })
                );

                return { canonicalName: record.canonicalName, score };
            })
            .filter((candidate) => candidate.score >= 0.88)
            .sort((left, right) => right.score - left.score)
            .slice(0, 3);

        return [...new Set(ranked.map((candidate) => candidate.canonicalName))];
    }
}