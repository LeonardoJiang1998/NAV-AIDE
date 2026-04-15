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
    { key: 'pois-db', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'pois-db')!.relativePath, checksum: 'fe013751953d65c68c80a8bdc656f2df59d9df954bcd04a02229bc5c1bf7cc9d' },
    { key: 'location-aliases-db', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'location-aliases-db')!.relativePath, checksum: 'aafdb8f06c55b17c7adbad003dcfe5edefc81fba54dfdaebd5c9617bb1240f5c' },
    { key: 'disruption-cache', path: DEVICE_DEMO_ASSETS.find((entry) => entry.key === 'disruption-cache')!.relativePath, checksum: 'awaiting-asset-disruption-cache', optional: true },
];
