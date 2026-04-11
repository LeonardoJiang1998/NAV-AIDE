import busRoutes from '../../../assets/busRoutes.json' with { type: 'json' };
import tubeGraph from '../../../assets/tubeGraph.json' with { type: 'json' };

import type { OfflineRuntimeAssetLoader, BusRoutesAsset, DisruptionCacheInput, OfflineRuntimeAssetContracts, TubeGraphAsset, WalkingRoutingInput } from '../runtime/OfflineRuntimeContracts';
import { buildWeightedGraphFromTubeAsset, deriveKnownStations } from './TubeGraphTransforms';

const FIXTURE_DISRUPTION_CACHE: DisruptionCacheInput = {
    generatedAt: '2026-04-11T09:10:00.000Z',
    source: 'fixture-static',
    events: [
        {
            id: 'line-jubilee-baker-street',
            summary: 'Minor Jubilee delay at Baker Street',
            affectedPlaceNames: ['Baker Street'],
            updatedAt: '2026-04-11T09:00:00.000Z',
        },
        {
            id: 'poi-british-museum',
            summary: 'Museum entrance queue notice',
            affectedPlaceNames: ['British Museum'],
            updatedAt: '2026-04-11T09:05:00.000Z',
        },
        {
            id: 'station-green-park',
            summary: 'Lift maintenance at Green Park',
            affectedPlaceNames: ['Green Park'],
            updatedAt: '2026-04-11T09:10:00.000Z',
        },
    ],
};

const WALKING_ROUTING_INPUT: WalkingRoutingInput = {
    provider: 'valhalla',
    profile: 'pedestrian',
    relativePath: 'valhalla_tiles/',
    assetsAvailable: true,
};

export function createNodeFixtureAssetLoader(contracts: OfflineRuntimeAssetContracts): OfflineRuntimeAssetLoader {
    return {
        contracts,
        loadTubeGraph: () => tubeGraph as TubeGraphAsset,
        loadBusRoutes: () => busRoutes as BusRoutesAsset,
        getPoisDatabase: () => contracts.poisDatabase,
        getLocationAliasesDatabase: () => contracts.locationAliasesDatabase,
        loadDisruptionCache: () => FIXTURE_DISRUPTION_CACHE,
        getWalkingRoutingInput: () => WALKING_ROUTING_INPUT,
    };
}

export { buildWeightedGraphFromTubeAsset, deriveKnownStations };