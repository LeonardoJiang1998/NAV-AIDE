import { DEVICE_DEMO_ASSETS } from '../runtime/DeviceDemoAssets';

export interface OfflineAssetManifestEntry {
    key: string;
    path: string;
    checksum: string;
    optional?: boolean;
}

export const assetManifest: OfflineAssetManifestEntry[] = [
    { key: 'model', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'model')!.relativePath, checksum: 'awaiting-asset-model' },
    { key: 'map-mbtiles', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'map-mbtiles')!.relativePath, checksum: 'awaiting-asset-map-mbtiles' },
    { key: 'valhalla-tiles', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'valhalla-tiles')!.relativePath, checksum: 'awaiting-asset-valhalla-tiles' },
    { key: 'pois-db', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'pois-db')!.relativePath, checksum: '84576f1863322fca8603311a958ba687a384a34d6a66198f42b443f4db7c7d5a' },
    { key: 'location-aliases-db', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'location-aliases-db')!.relativePath, checksum: '924e95c5b94cf29fc03883d8c05636b0825053ca92ad382c480595169c6df877' },
    { key: 'disruption-cache', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'disruption-cache')!.relativePath, checksum: 'awaiting-asset-disruption-cache', optional: true },
];