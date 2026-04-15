import { EventLogger } from '../../analytics/EventLogger';
import { IntentExtractor } from '../llm/IntentExtractor';
import { ResponseRenderer } from '../llm/ResponseRenderer';
import { POIService, type POIRecord } from '../poi/POIService';
import { EntityResolver, type EntityRecord } from './EntityResolver';
import { QueryPipeline } from './QueryPipeline';
import { Dijkstra, type WeightedGraph } from '../routing/Dijkstra';
import { ValhallaBridge } from '../routing/ValhallaBridge';
import { HaversineWalkingRouter, type GeoPoint, type PlaceCoordinateProvider } from '../routing/HaversineWalkingRouter';
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
    /** Optional station coordinates keyed by canonical name. */
    stationCoordinates?: Map<string, GeoPoint>;
    now?: () => number;
    eventLogger?: EventLogger;
    deviceIdProvider?: DeviceIdProvider;
}

class CompositeCoordinateProvider implements PlaceCoordinateProvider {
    public constructor(
        private readonly stationCoords: Map<string, GeoPoint>,
        private readonly pois: POIRecord[],
    ) {}

    public findCoordinate(name: string): GeoPoint | null {
        const normalized = name.trim();
        const direct = this.stationCoords.get(normalized);
        if (direct) return direct;

        // Case-insensitive fallback
        const lower = normalized.toLowerCase();
        for (const [stationName, point] of this.stationCoords) {
            if (stationName.toLowerCase() === lower) return point;
        }

        const poi = this.pois.find(
            (p) => p.canonicalName === normalized || p.canonicalName.toLowerCase() === lower,
        );
        if (poi?.latitude !== undefined && poi.longitude !== undefined) {
            return { lat: poi.latitude, lon: poi.longitude };
        }

        return null;
    }
}

export function createQueryPipelineRuntime(adapters: QueryPipelineRuntimeAdapters, fixtures: QueryPipelineRuntimeFixtures) {
    const entityResolver = new EntityResolver(fixtures.entities);
    const eventLogger = fixtures.eventLogger ?? new EventLogger();

    const stationCoords = fixtures.stationCoordinates ?? new Map<string, GeoPoint>();
    const coordinateProvider = new CompositeCoordinateProvider(stationCoords, fixtures.pois);
    const walkingRouter = new ValhallaBridge(new HaversineWalkingRouter(coordinateProvider));

    return {
        knownStations: fixtures.knownStations,
        entityResolver,
        eventLogger,
        poiService: new POIService(fixtures.pois),
        coordinateProvider,
        queryPipeline: new QueryPipeline({
            intentExtractor: new IntentExtractor(adapters.intentModel),
            entityResolver,
            poiService: new POIService(fixtures.pois),
            router: new Dijkstra(),
            walkingRouter,
            responseRenderer: new ResponseRenderer(adapters.responseModel),
            disruptionService: new CacheAwareDisruptionService(new StaticDisruptionSource(fixtures.disruptions), fixtures.now),
            eventLogger,
            graph: fixtures.graph,
            deviceIdProvider: fixtures.deviceIdProvider,
        }),
    };
}