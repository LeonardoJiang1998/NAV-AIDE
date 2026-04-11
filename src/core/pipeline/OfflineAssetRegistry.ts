import type { OfflineRuntimeAssetContracts } from '../runtime/OfflineRuntimeContracts.js';

export type OfflineAssetKind = 'json' | 'sqlite' | 'mbtiles' | 'directory';

export interface OfflineAssetDefinition {
    key: string;
    relativePath: string;
    kind: OfflineAssetKind;
    generatedBy?: string;
    required: boolean;
}

export const OFFLINE_RUNTIME_ASSET_CONTRACTS: OfflineRuntimeAssetContracts = {
    tubeGraph: { key: 'tube-graph', relativePath: 'assets/tubeGraph.json', kind: 'json', required: true },
    busRoutes: { key: 'bus-routes', relativePath: 'assets/busRoutes.json', kind: 'json', required: true },
    poisDatabase: {
        key: 'pois-db',
        relativePath: 'assets/data/pois.db',
        kind: 'sqlite',
        required: true,
        tables: ['pois'],
        ftsTables: ['pois_fts'],
    },
    locationAliasesDatabase: {
        key: 'location-aliases-db',
        relativePath: 'assets/data/location_aliases.db',
        kind: 'sqlite',
        required: true,
        tables: ['location_aliases'],
        ftsTables: ['location_aliases_fts'],
    },
    disruptionCache: {
        key: 'disruption-cache',
        relativePath: 'assets/cache/disruptions.json',
        kind: 'json',
        required: false,
        freshnessTtlMs: 5 * 60 * 1000,
    },
    walkingRouting: {
        key: 'walking-routing',
        relativePath: 'valhalla_tiles/',
        kind: 'directory',
        required: true,
        provider: 'valhalla',
        profile: 'pedestrian',
    },
};

export const OFFLINE_ASSETS: OfflineAssetDefinition[] = [
    OFFLINE_RUNTIME_ASSET_CONTRACTS.tubeGraph,
    OFFLINE_RUNTIME_ASSET_CONTRACTS.busRoutes,
    { key: 'london-mbtiles', relativePath: 'london.mbtiles', kind: 'mbtiles', required: true },
    OFFLINE_RUNTIME_ASSET_CONTRACTS.walkingRouting,
    OFFLINE_RUNTIME_ASSET_CONTRACTS.poisDatabase,
    OFFLINE_RUNTIME_ASSET_CONTRACTS.locationAliasesDatabase,
    { key: 'station-seed', relativePath: 'scripts/prompt-validation/fixtures/stations.json', kind: 'json', required: true },
];