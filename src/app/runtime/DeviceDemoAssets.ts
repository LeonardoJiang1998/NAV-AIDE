export type DeviceDemoAssetKey = 'model' | 'map-mbtiles' | 'pois-db' | 'location-aliases-db' | 'valhalla-tiles' | 'disruption-cache';

export interface DeviceDemoAssetDefinition {
    key: DeviceDemoAssetKey;
    label: string;
    relativePath: string;
    required: boolean;
    kind: 'file' | 'directory';
    demoPurpose: string;
}

export const DEVICE_DEMO_ASSETS: DeviceDemoAssetDefinition[] = [
    {
        key: 'model',
        label: 'Gemma GGUF model',
        relativePath: 'models/gemma4-e2b.gguf',
        required: true,
        kind: 'file',
        demoPurpose: 'llama.rn structured intent extraction and natural-language rendering',
    },
    {
        key: 'pois-db',
        label: 'POI SQLite database',
        relativePath: 'data/pois.db',
        required: true,
        kind: 'file',
        demoPurpose: 'offline POI lookup and FTS-backed matching',
    },
    {
        key: 'location-aliases-db',
        label: 'Location alias SQLite database',
        relativePath: 'data/location_aliases.db',
        required: true,
        kind: 'file',
        demoPurpose: 'offline entity resolution and disambiguation',
    },
    {
        key: 'map-mbtiles',
        label: 'London MBTiles bundle',
        relativePath: 'maps/london.mbtiles',
        required: true,
        kind: 'file',
        demoPurpose: 'offline map rendering in the Maps tab',
    },
    {
        key: 'valhalla-tiles',
        label: 'Valhalla walking tiles',
        relativePath: 'routing/valhalla_tiles',
        required: true,
        kind: 'directory',
        demoPurpose: 'offline walking route availability',
    },
    {
        key: 'disruption-cache',
        label: 'Disruption cache JSON',
        relativePath: 'cache/disruptions.json',
        required: false,
        kind: 'file',
        demoPurpose: 'optional device-side disruption cache instead of fixture static alerts',
    },
];

export function getDeviceDemoAssetDefinition(key: DeviceDemoAssetKey): DeviceDemoAssetDefinition {
    const definition = DEVICE_DEMO_ASSETS.find((entry) => entry.key === key);
    if (!definition) {
        throw new Error(`Unknown device demo asset key: ${key}`);
    }

    return definition;
}