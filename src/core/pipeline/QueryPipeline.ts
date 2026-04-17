import { EventLogger } from '../../analytics/EventLogger';
import type { DeviceIdProvider } from '../runtime/DeviceIdContracts';
import { IntentExtractor, type IntentExtraction } from '../llm/IntentExtractor';
import { ResponseRenderer, type RenderedResponse } from '../llm/ResponseRenderer';
import { FuzzyMatcher } from '../poi/FuzzyMatcher';
import { type POIResult, POIService } from '../poi/POIService';
import { Dijkstra, type ShortestPathResult, type WeightedGraph } from '../routing/Dijkstra';
import { ValhallaBridge, type WalkingRouteResult } from '../routing/ValhallaBridge';
import { CacheAwareDisruptionService, type DisruptionEvent } from '../services/DisruptionService';
import { buildRouteNarrative } from './RouteNarrative';
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

/**
 * A resolved routing endpoint. `stationEntity` is always the tube station the
 * routing graph uses; `poiName` is set when the user asked to go to a POI
 * rather than a station, so the UI can show the POI label and append a
 * walking leg from the station.
 */
interface RouteEndpoint {
    stationEntity: EntityRecord;
    poiName?: string;
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
        const originResolved = this.resolveRouteEndpoint(extraction.origin);
        const destinationResolved = this.resolveRouteEndpoint(extraction.destination);

        if (extraction.requiresDisambiguation) {
            return {
                status: 'needs_disambiguation',
                extraction,
                fastPathHints,
                origin: originResolved.resolution,
                destination: destinationResolved.resolution,
                disruptions: [],
                rendered: null,
            };
        }

        // "Take me to X" with no origin: if X resolved to a POI, give a
        // destination preview (nearest station + walking leg). The user can
        // re-ask with a starting point to get full tube directions.
        if (
            !originResolved.endpoint &&
            destinationResolved.endpoint &&
            destinationResolved.endpoint.poiName
        ) {
            return this.handleDestinationPreview(extraction, fastPathHints, destinationResolved);
        }

        if (!originResolved.endpoint || !destinationResolved.endpoint) {
            return {
                status: 'unresolved',
                extraction,
                fastPathHints,
                origin: originResolved.resolution,
                destination: destinationResolved.resolution,
                disruptions: [],
                rendered: null,
            };
        }

        if (
            (originResolved.resolution && originResolved.resolution.status !== 'resolved') ||
            (destinationResolved.resolution && destinationResolved.resolution.status !== 'resolved')
        ) {
            return {
                status: 'needs_disambiguation',
                extraction,
                fastPathHints,
                origin: originResolved.resolution,
                destination: destinationResolved.resolution,
                disruptions: [],
                rendered: null,
            };
        }

        const originEndpoint = originResolved.endpoint;
        const destinationEndpoint = destinationResolved.endpoint;

        const route = this.dependencies.router.findShortestPath(
            this.dependencies.graph,
            originEndpoint.stationEntity.id,
            destinationEndpoint.stationEntity.id,
        );

        const tubeSegments = route ? buildTubeSegments(route.path, this.dependencies.graph) : [];

        // Walking leg: from the final station to the POI (if destination is a
        // POI), or the first POI to origin station if origin is a POI. This
        // makes "Take me to the British Museum" a real mixed journey.
        const walking = await this.resolveWalkingLeg(originEndpoint, destinationEndpoint);

        const allowedPlaceNames = this.collectAllowedPlaceNames([
            originEndpoint.stationEntity,
            destinationEndpoint.stationEntity,
            ...this.entitiesFromRoute(route),
        ]);
        // Include POI-derived names so the hallucination guard allows them in
        // the rendered response.
        for (const extra of [originEndpoint.poiName, destinationEndpoint.poiName]) {
            if (extra && !allowedPlaceNames.includes(extra)) allowedPlaceNames.push(extra);
        }

        const disruptions = await this.dependencies.disruptionService.getDisruptions(allowedPlaceNames, {
            key: `route:${originEndpoint.stationEntity.id}:${destinationEndpoint.stationEntity.id}`,
            maxAgeMs: 5 * 60 * 1000,
        });

        const summary = this.buildSummary(route, tubeSegments, originEndpoint, destinationEndpoint, walking);

        const rendered = await this.dependencies.responseRenderer.render({
            intent: extraction.intent,
            summary,
            allowedPlaceNames,
        });

        return {
            status: route ? 'complete' : 'unresolved',
            extraction,
            fastPathHints,
            origin: originResolved.resolution,
            destination: destinationResolved.resolution,
            route,
            tubeSegments,
            walking,
            disruptions,
            rendered,
        };
    }

    /**
     * Resolve a route endpoint (origin or destination) from a raw query
     * fragment. Tries EntityResolver first (which knows stations), then falls
     * back to POI lookup: if the fragment matches a known POI, we use the
     * POI's nearest tube station as the routing endpoint and record the POI
     * name + location so we can produce a walking leg and hallucination-safe
     * rendered text.
     */
    private resolveRouteEndpoint(raw: string | null): {
        resolution: ResolutionResult | undefined;
        endpoint: RouteEndpoint | null;
    } {
        if (!raw) return { resolution: undefined, endpoint: null };

        const resolution = this.dependencies.entityResolver.resolve(raw);

        // Only accept a station entity here — POI entities don't exist on the
        // tube graph and would make Dijkstra return null. For POIs we fall
        // through to poiService.search, which gives us a nearestStation to
        // route to and preserves the POI name for the walking leg.
        if (
            resolution.status === 'resolved' &&
            resolution.bestCandidate &&
            resolution.bestCandidate.entity.type === 'station'
        ) {
            return {
                resolution,
                endpoint: { stationEntity: resolution.bestCandidate.entity },
            };
        }

        // Fall back to POI lookup. Strip leading articles ("the", "a", "an")
        // so "the British Museum" matches "British Museum", and drop a
        // trailing "station" suffix that sometimes appears in voice input.
        const poiQuery = raw
            .trim()
            .replace(/^(the|a|an)\s+/i, '')
            .replace(/\s+station$/i, '');

        // Prefer an exact canonical POI match before falling back to fuzzy
        // search. If the entity resolver already surfaced the POI by name,
        // use its canonical name as the POI query so score is highest.
        const poiByEntity =
            resolution.bestCandidate?.entity.type === 'poi'
                ? resolution.bestCandidate.entity.canonicalName
                : null;
        const poiResults = this.dependencies.poiService.search(poiByEntity ?? poiQuery, 1);

        if (poiResults.length > 0) {
            const poi = poiResults[0].poi;
            const stationName = poi.nearestStation;
            if (stationName) {
                const stationResolution = this.dependencies.entityResolver.resolve(stationName);
                if (stationResolution.bestCandidate) {
                    return {
                        resolution: stationResolution,
                        endpoint: {
                            stationEntity: stationResolution.bestCandidate.entity,
                            poiName: poi.canonicalName,
                        },
                    };
                }
            }
        }

        return { resolution, endpoint: null };
    }

    private async handleDestinationPreview(
        extraction: IntentExtraction,
        fastPathHints: string[],
        destinationResolved: { resolution: ResolutionResult | undefined; endpoint: RouteEndpoint | null },
    ): Promise<QueryPipelineResult> {
        const endpoint = destinationResolved.endpoint!;
        const stationName = endpoint.stationEntity.canonicalName;
        const poiName = endpoint.poiName!;

        const walking = await this.dependencies.walkingRouter.route({
            originName: stationName,
            destinationName: poiName,
        });

        const allowedPlaceNames = [stationName, poiName];
        const disruptions = await this.dependencies.disruptionService.getDisruptions(allowedPlaceNames, {
            key: `destination-preview:${endpoint.stationEntity.id}:${poiName}`,
            maxAgeMs: 5 * 60 * 1000,
        });

        const summary =
            walking.status === 'ok'
                ? `${poiName} is closest to ${stationName} — about ${this.formatMeters(
                    walking.distanceMeters,
                )} (~${walking.durationMinutes} min) walk. Tell me your starting station for full tube directions.`
                : `${poiName} is closest to ${stationName}. Tell me your starting station for full tube directions.`;

        const rendered = await this.dependencies.responseRenderer.render({
            intent: extraction.intent,
            summary,
            allowedPlaceNames,
        });

        return {
            status: 'complete',
            extraction,
            fastPathHints,
            destination: destinationResolved.resolution,
            route: null,
            tubeSegments: [],
            walking,
            disruptions,
            rendered,
        };
    }

    private async resolveWalkingLeg(
        origin: RouteEndpoint,
        destination: RouteEndpoint,
    ): Promise<WalkingRouteResult> {
        // Walk to destination POI if one is attached. Otherwise walk
        // station-to-station (useful as a sanity check for short hops).
        const walkFrom = destination.poiName ? destination.stationEntity.canonicalName : origin.stationEntity.canonicalName;
        const walkTo = destination.poiName
            ? destination.poiName
            : destination.stationEntity.canonicalName;

        return this.dependencies.walkingRouter.route({
            originName: walkFrom,
            destinationName: walkTo,
        });
    }

    private buildSummary(
        route: ShortestPathResult | null,
        tubeSegments: TubeSegment[],
        originEndpoint: RouteEndpoint,
        destinationEndpoint: RouteEndpoint,
        walking: WalkingRouteResult,
    ): string {
        const originLabel = originEndpoint.poiName ?? originEndpoint.stationEntity.canonicalName;
        const destLabel = destinationEndpoint.poiName ?? destinationEndpoint.stationEntity.canonicalName;

        if (!route) {
            return `No tube route was found from ${originLabel} to ${destLabel}.`;
        }

        const sameStation = originEndpoint.stationEntity.id === destinationEndpoint.stationEntity.id;

        // Special case: user's origin and destination share a station, but the
        // destination is a POI. Skip the "You're already here" narrative and
        // only describe the walking leg.
        if (sameStation && destinationEndpoint.poiName && walking.status === 'ok') {
            return `${destinationEndpoint.stationEntity.canonicalName} is the nearest station to ${destinationEndpoint.poiName}. Walk approximately ${this.formatMeters(
                walking.distanceMeters,
            )} (~${walking.durationMinutes} min) from the station to ${destinationEndpoint.poiName}.`;
        }

        const tubeNarrative = buildRouteNarrative(
            originEndpoint.stationEntity.canonicalName,
            destinationEndpoint.stationEntity.canonicalName,
            tubeSegments,
            route.cost,
        );

        // If the destination is a POI, append the final walking leg.
        if (destinationEndpoint.poiName && walking.status === 'ok') {
            return `${tubeNarrative} Then walk approximately ${this.formatMeters(
                walking.distanceMeters,
            )} (~${walking.durationMinutes} min) from ${destinationEndpoint.stationEntity.canonicalName} to ${destinationEndpoint.poiName}.`;
        }

        return tubeNarrative;
    }

    private formatMeters(m: number): string {
        return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
    }

    private async handlePoiIntent(extraction: IntentExtraction, fastPathHints: string[]): Promise<QueryPipelineResult> {
        const poiResults = extraction.poiQuery ? this.dependencies.poiService.search(extraction.poiQuery) : [];
        if (extraction.requiresDisambiguation) {
            return { status: 'needs_disambiguation', extraction, fastPathHints, poiResults, disruptions: [], rendered: null };
        }

        if (poiResults.length === 0) {
            return { status: 'unresolved', extraction, fastPathHints, poiResults, disruptions: [], rendered: null };
        }

        const topPoi = poiResults[0].poi;
        const allowedPlaceNames = poiResults.map((result) => result.poi.canonicalName);

        // If the top POI has a nearestStation, enrich the response with a
        // walking leg from that station. Same shape as the destination preview
        // path — a "Find the British Museum" query should give the user the
        // same useful answer as "Take me to the British Museum".
        let walking: WalkingRouteResult | undefined;
        let stationName: string | undefined;
        if (topPoi.nearestStation) {
            const stationResolution = this.dependencies.entityResolver.resolve(topPoi.nearestStation);
            if (stationResolution.bestCandidate?.entity.type === 'station') {
                stationName = stationResolution.bestCandidate.entity.canonicalName;
                walking = await this.dependencies.walkingRouter.route({
                    originName: stationName,
                    destinationName: topPoi.canonicalName,
                });
                if (!allowedPlaceNames.includes(stationName)) allowedPlaceNames.push(stationName);
            }
        }

        const disruptions = await this.dependencies.disruptionService.getDisruptions(allowedPlaceNames, {
            key: `poi:${allowedPlaceNames.join('|')}`,
            maxAgeMs: 5 * 60 * 1000,
        });

        const summary =
            stationName && walking?.status === 'ok'
                ? `${topPoi.canonicalName} is closest to ${stationName} — about ${this.formatMeters(
                    walking.distanceMeters,
                )} (~${walking.durationMinutes} min) walk. Tell me your starting station for full tube directions.`
                : stationName
                    ? `${topPoi.canonicalName} is closest to ${stationName}. Tell me your starting station for full tube directions.`
                    : `POI match: ${topPoi.canonicalName}.`;

        const rendered = await this.dependencies.responseRenderer.render({
            intent: extraction.intent,
            summary,
            allowedPlaceNames,
        });

        return {
            status: 'complete',
            extraction,
            fastPathHints,
            poiResults,
            walking,
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