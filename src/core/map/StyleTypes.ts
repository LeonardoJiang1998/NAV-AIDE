/**
 * Minimal typed view of the MapLibre style spec we actually author.
 * Not exhaustive — just what `buildMapStyle` produces.
 */

export interface RasterSource {
    type: 'raster';
    tiles: string[];
    tileSize: number;
    attribution?: string;
    minzoom?: number;
    maxzoom?: number;
}

export interface BackgroundLayer {
    id: string;
    type: 'background';
    paint: Record<string, unknown>;
}

export interface RasterLayer {
    id: string;
    type: 'raster';
    source: string;
    minzoom?: number;
    maxzoom?: number;
    paint?: Record<string, unknown>;
}

export interface StyleJSON {
    version: 8;
    name: string;
    glyphs?: string;
    sources: Record<string, RasterSource>;
    layers: Array<BackgroundLayer | RasterLayer>;
    center?: [number, number];
    zoom?: number;
}
