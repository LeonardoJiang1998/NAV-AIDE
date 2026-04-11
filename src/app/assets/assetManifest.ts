import { DEVICE_DEMO_ASSETS } from '../runtime/DeviceDemoAssets';

export interface OfflineAssetManifestEntry {
    key: string;
    path: string;
    checksum: string;
    optional?: boolean;
}

export const assetManifest: OfflineAssetManifestEntry[] = [
    { key: 'model', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'model')!.relativePath, checksum: 'phase-3-model-checksum' },
    { key: 'map-mbtiles', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'map-mbtiles')!.relativePath, checksum: 'phase-3-map-checksum' },
    { key: 'valhalla-tiles', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'valhalla-tiles')!.relativePath, checksum: 'phase-3-routing-checksum' },
    { key: 'pois-db', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'pois-db')!.relativePath, checksum: 'phase-3-poi-checksum' },
    { key: 'location-aliases-db', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'location-aliases-db')!.relativePath, checksum: 'phase-3-alias-checksum' },
    { key: 'disruption-cache', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'disruption-cache')!.relativePath, checksum: 'phase-3-disruption-cache-checksum', optional: true },
];