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
    { key: 'pois-db', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'pois-db')!.relativePath, checksum: '48c2da8ecc437fe04bac6ce1cf2265aa7f2ed755ff9c56e65b8ea83003c5030b' },
    { key: 'location-aliases-db', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'location-aliases-db')!.relativePath, checksum: '0976cf028eeab5a54d08a7f7aa0295df303cc9a1995a3a2af169f91ea7de8647' },
    { key: 'disruption-cache', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'disruption-cache')!.relativePath, checksum: 'awaiting-asset-disruption-cache', optional: true },
];