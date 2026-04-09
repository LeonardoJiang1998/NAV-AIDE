import tubeGraph from '../../../assets/tubeGraph.json' with { type: 'json' };
import busRoutes from '../../../assets/busRoutes.json' with { type: 'json' };

export type OfflineAssetKind = 'json' | 'sqlite' | 'mbtiles' | 'directory';

export interface OfflineAssetDefinition {
    key: string;
    relativePath: string;
    kind: OfflineAssetKind;
    generatedBy?: string;
    required: boolean;
}

export const OFFLINE_ASSETS: OfflineAssetDefinition[] = [
    { key: 'tube-graph', relativePath: 'assets/tubeGraph.json', kind: 'json', required: true },
    { key: 'bus-routes', relativePath: 'assets/busRoutes.json', kind: 'json', required: true },
    { key: 'london-mbtiles', relativePath: 'london.mbtiles', kind: 'mbtiles', required: true },
    { key: 'valhalla-tiles', relativePath: 'valhalla_tiles/', kind: 'directory', required: true },
    { key: 'pois-db', relativePath: 'assets/data/pois.db', kind: 'sqlite', generatedBy: 'scripts/data-pipeline/assemble-sqlite-dbs.js', required: true },
    { key: 'location-aliases-db', relativePath: 'assets/data/location_aliases.db', kind: 'sqlite', generatedBy: 'scripts/data-pipeline/assemble-sqlite-dbs.js', required: true },
    { key: 'station-seed', relativePath: 'scripts/prompt-validation/fixtures/stations.json', kind: 'json', required: true },
];

export function loadTubeGraphFixture() {
    return tubeGraph;
}

export function loadBusRoutesFixture() {
    return busRoutes;
}