import type { DisruptionEvent } from '../services/DisruptionService.js';

export interface TubeGraphNodeAsset {
    id: string;
    name: string;
    zone?: number;
}

export interface TubeGraphEdgeAsset {
    from: string;
    to: string;
    lineId: string;
    travelMinutes: number;
}

export interface TubeGraphAsset {
    schemaVersion: number;
    assetType: 'tube-graph';
    generatedBy?: string;
    nodes: TubeGraphNodeAsset[];
    edges: TubeGraphEdgeAsset[];
}

export interface BusRouteAsset {
    routeId: string;
    displayName: string;
    stops: string[];
}

export interface BusRoutesAsset {
    schemaVersion: number;
    assetType: 'bus-routes';
    generatedBy?: string;
    routes: BusRouteAsset[];
}

export interface JsonAssetContract {
    key: 'tube-graph' | 'bus-routes';
    relativePath: string;
    kind: 'json';
    required: boolean;
}

export interface SqliteAssetContract {
    key: 'pois-db' | 'location-aliases-db';
    relativePath: string;
    kind: 'sqlite';
    required: boolean;
    tables: string[];
    ftsTables: string[];
}

export interface DisruptionCacheInputContract {
    key: 'disruption-cache';
    relativePath: string;
    kind: 'json';
    required: boolean;
    freshnessTtlMs: number;
}

export interface DisruptionCacheInput {
    generatedAt: string;
    source: string;
    events: DisruptionEvent[];
}

export interface WalkingRoutingInputContract {
    key: 'walking-routing';
    relativePath: string;
    kind: 'directory';
    required: boolean;
    provider: 'valhalla';
    profile: 'pedestrian';
}

export interface WalkingRoutingInput {
    provider: 'valhalla';
    profile: 'pedestrian';
    relativePath: string;
    assetsAvailable: boolean;
}

export interface OfflineRuntimeAssetContracts {
    tubeGraph: JsonAssetContract;
    busRoutes: JsonAssetContract;
    poisDatabase: SqliteAssetContract;
    locationAliasesDatabase: SqliteAssetContract;
    disruptionCache: DisruptionCacheInputContract;
    walkingRouting: WalkingRoutingInputContract;
}

export interface OfflineRuntimeAssetLoader {
    readonly contracts: OfflineRuntimeAssetContracts;
    loadTubeGraph(): TubeGraphAsset;
    loadBusRoutes(): BusRoutesAsset;
    getPoisDatabase(): SqliteAssetContract;
    getLocationAliasesDatabase(): SqliteAssetContract;
    loadDisruptionCache(): DisruptionCacheInput;
    getWalkingRoutingInput(): WalkingRoutingInput;
}