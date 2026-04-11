export interface OfflineAssetManifestEntry {
    key: string;
    path: string;
    checksum: string;
    optional?: boolean;
}

export const assetManifest: OfflineAssetManifestEntry[] = [
    { key: 'model', path: 'models/gemma4-e2b.gguf', checksum: 'phase-3-model-checksum' },
    { key: 'map-mbtiles', path: 'maps/london.mbtiles', checksum: 'phase-3-map-checksum' },
    { key: 'valhalla-tiles', path: 'routing/valhalla_tiles', checksum: 'phase-3-routing-checksum' },
    { key: 'pois-db', path: 'data/pois.db', checksum: 'phase-3-poi-checksum' },
    { key: 'location-aliases-db', path: 'data/location_aliases.db', checksum: 'phase-3-alias-checksum' },
    { key: 'disruption-cache', path: 'cache/disruptions.json', checksum: 'phase-3-disruption-cache-checksum', optional: true },
];