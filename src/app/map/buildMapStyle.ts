/**
 * Build a MapLibre style JSON at runtime, choosing a local tile source when
 * the bundled tiles are present and falling back to OSM-over-HTTPS otherwise.
 *
 * The original static style (asset://styles/offline-style.json) hard-coded
 * OSM raster over HTTPS, which defeats the point of the offline app. This
 * helper inspects the app's resolved tile root (bundled Resources/maps or the
 * Documents container's maps/) and picks the right tiles URL template.
 *
 * Returning a fresh object per call keeps MapLibre from re-using a cached
 * style when the asset availability flips at runtime.
 */

import type { StyleJSON } from '../../core/map/StyleTypes';

export interface BuildMapStyleInput {
    /**
     * Absolute `file://` prefix where bundled tiles live. If non-null, tiles
     * are expected at `<localTilesPrefix>/{z}/{x}/{y}.png`. When null (the
     * common simulator case until native bundling lands), we use OSM raster
     * tiles over HTTPS so the map isn't completely blank.
     */
    localTilesPrefix: string | null;
    /** Inclusive zoom range for the bundled tile set (read from metadata). */
    minZoom?: number;
    maxZoom?: number;
}

export function buildMapStyle({
    localTilesPrefix,
    minZoom = 10,
    maxZoom = 14,
}: BuildMapStyleInput): StyleJSON {
    const useLocal = Boolean(localTilesPrefix);
    const tiles = useLocal
        ? [`${localTilesPrefix}/{z}/{x}/{y}.png`]
        : ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];

    return {
        version: 8,
        name: 'NAV-AiDE Base Map',
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
            'osm-raster': {
                type: 'raster',
                tiles,
                tileSize: 256,
                attribution: '© OpenStreetMap contributors',
                minzoom: useLocal ? minZoom : 0,
                maxzoom: useLocal ? maxZoom : 19,
            },
        },
        layers: [
            {
                id: 'background',
                type: 'background',
                paint: { 'background-color': '#f0ede6' },
            },
            {
                id: 'osm-tiles',
                type: 'raster',
                source: 'osm-raster',
                minzoom: useLocal ? minZoom : 0,
                maxzoom: useLocal ? maxZoom : 19,
                paint: {
                    'raster-opacity': 0.85,
                    'raster-contrast': 0,
                    'raster-saturation': -0.15,
                },
            },
        ],
        center: [-0.1276, 51.5074],
        zoom: 11,
    };
}
