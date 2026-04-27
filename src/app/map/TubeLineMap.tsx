import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import RNFS from 'react-native-fs';

import tubeGraphAsset from '../../../assets/tubeGraph.json';
import { buildMapStyle } from './buildMapStyle';
import { colors, getTubeLineStyle, TUBE_LINE_STYLES } from '../theme';

interface TubeGraphNode {
    id: string;
    name: string;
    lat?: number;
    lon?: number;
    zone?: number;
    lines?: string[];
}

interface TubeGraphEdge {
    from: string;
    to: string;
    lineId: string;
    travelMinutes?: number;
}

interface TubeGraphShape {
    nodes: TubeGraphNode[];
    edges: TubeGraphEdge[];
}

const DEFAULT_CENTER: [number, number] = [-0.1276, 51.5072];

export function TubeLineMap({
    highlightedRoute,
    onStationPress,
}: {
    highlightedRoute?: string[];
    onStationPress?: (stationName: string) => void;
}): React.JSX.Element {
    const graph = tubeGraphAsset as unknown as TubeGraphShape;
    const [zoomLevel, setZoomLevel] = useState(11);
    const [centerCoordinate, setCenterCoordinate] = useState<[number, number]>(DEFAULT_CENTER);
    const [localTilesPrefix, setLocalTilesPrefix] = useState<string | null>(null);

    // Use the same offline tile probe as OfflineMapSurface — when the bundled
    // tiles are present, MapLibre paints street context behind the tube lines.
    // Without it the lines float on a flat background, which is hard to read.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const tilesRoot = `${RNFS.DocumentDirectoryPath}/map-tiles`;
            const sentinel = `${tilesRoot}/13/4093/2723.png`;
            try {
                const present = await RNFS.exists(sentinel);
                if (!cancelled) setLocalTilesPrefix(present ? `file://${tilesRoot}` : null);
            } catch {
                if (!cancelled) setLocalTilesPrefix(null);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const mapStyle = useMemo(
        () => JSON.stringify(buildMapStyle({ localTilesPrefix })),
        [localTilesPrefix],
    );

    // Build node lookup
    const nodeById = useMemo(() => {
        const map = new Map<string, TubeGraphNode>();
        for (const node of graph.nodes) {
            if (typeof node.lat === 'number' && typeof node.lon === 'number') {
                map.set(node.id, node);
            }
        }
        return map;
    }, [graph]);

    // Group edges by line so we can layer with per-line colours.
    const lineFeatureCollections = useMemo(() => {
        const byLine = new Map<string, GeoJSON.Feature[]>();
        for (const edge of graph.edges) {
            const a = nodeById.get(edge.from);
            const b = nodeById.get(edge.to);
            if (!a || !b) continue;
            const feat: GeoJSON.Feature = {
                type: 'Feature',
                properties: { lineId: edge.lineId },
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [a.lon as number, a.lat as number],
                        [b.lon as number, b.lat as number],
                    ],
                },
            };
            const existing = byLine.get(edge.lineId) ?? [];
            existing.push(feat);
            byLine.set(edge.lineId, existing);
        }

        const result: Array<{ lineId: string; fc: GeoJSON.FeatureCollection }> = [];
        for (const [lineId, features] of byLine.entries()) {
            result.push({ lineId, fc: { type: 'FeatureCollection', features } });
        }
        // Paint walking-transfer first so real lines draw on top.
        result.sort((a, b) => (a.lineId === 'walking-transfer' ? -1 : b.lineId === 'walking-transfer' ? 1 : 0));
        return result;
    }, [graph, nodeById]);

    const stationFeatureCollection = useMemo<GeoJSON.FeatureCollection>(() => {
        const features: GeoJSON.Feature[] = [];
        for (const node of graph.nodes) {
            if (typeof node.lat !== 'number' || typeof node.lon !== 'number') continue;
            const isInterchange = (node.lines?.length ?? 0) > 1;
            features.push({
                type: 'Feature',
                properties: { name: node.name, isInterchange: isInterchange ? 1 : 0 },
                geometry: { type: 'Point', coordinates: [node.lon, node.lat] },
            });
        }
        return { type: 'FeatureCollection', features };
    }, [graph]);

    const highlightFeatureCollection = useMemo<GeoJSON.FeatureCollection>(() => {
        if (!highlightedRoute || highlightedRoute.length < 2) {
            return { type: 'FeatureCollection', features: [] };
        }
        const coords: Array<[number, number]> = [];
        for (const id of highlightedRoute) {
            const node = nodeById.get(id);
            if (!node) continue;
            coords.push([node.lon as number, node.lat as number]);
        }
        if (coords.length < 2) return { type: 'FeatureCollection', features: [] };
        return {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: coords },
            }],
        };
    }, [highlightedRoute, nodeById]);

    // When a route is highlighted, fit the camera to its bounding box so the
    // user sees the whole journey instead of having to pan around. Centers
    // mid-route + picks a zoom that comfortably contains the bounds.
    useEffect(() => {
        if (!highlightedRoute || highlightedRoute.length < 2) return;
        const points: Array<{ lat: number; lon: number }> = [];
        for (const id of highlightedRoute) {
            const node = nodeById.get(id);
            if (node && typeof node.lat === 'number' && typeof node.lon === 'number') {
                points.push({ lat: node.lat, lon: node.lon });
            }
        }
        if (points.length < 2) return;
        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
        for (const p of points) {
            if (p.lat < minLat) minLat = p.lat;
            if (p.lat > maxLat) maxLat = p.lat;
            if (p.lon < minLon) minLon = p.lon;
            if (p.lon > maxLon) maxLon = p.lon;
        }
        const center: [number, number] = [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
        const span = Math.max(maxLat - minLat, (maxLon - minLon) / Math.cos((center[1] * Math.PI) / 180));
        // Empirical mapping from lat-degree span → zoom level for our 520 px map frame.
        // ~0.7° spans Greater London, fits at zoom 9.5.
        const zoom = span > 0.5 ? 9 : span > 0.2 ? 11 : span > 0.05 ? 12 : 13;
        setCenterCoordinate(center);
        setZoomLevel(zoom);
    }, [highlightedRoute, nodeById]);

    const stationCount = stationFeatureCollection.features.length;
    const edgeCount = graph.edges.length;
    const lineCount = lineFeatureCollections.length;

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Tube Line Map</Text>
            <Text style={styles.copy}>
                {stationCount} stations · {edgeCount} segments · {lineCount} lines (TfL Open Data).
            </Text>
            <View style={styles.mapShell}>
                <MapLibreGL.MapView
                    style={StyleSheet.absoluteFill}
                    mapStyle={mapStyle}
                    onPress={(event: { geometry?: { coordinates?: [number, number] } }) => {
                        const coords = event.geometry?.coordinates;
                        if (!coords) return;
                        // Find nearest station within ~1 km
                        const [lon, lat] = coords;
                        let best: TubeGraphNode | null = null;
                        let bestDist = Infinity;
                        for (const node of nodeById.values()) {
                            const dx = (node.lon as number) - lon;
                            const dy = (node.lat as number) - lat;
                            const d = dx * dx + dy * dy;
                            if (d < bestDist) {
                                bestDist = d;
                                best = node;
                            }
                        }
                        if (best && onStationPress) onStationPress(best.name);
                    }}
                >
                    <MapLibreGL.Camera zoomLevel={zoomLevel} centerCoordinate={centerCoordinate} />
                    {lineFeatureCollections.map(({ lineId, fc }) => {
                        const style = getTubeLineStyle(lineId);
                        return (
                            <MapLibreGL.ShapeSource key={lineId} id={`line-${lineId}`} shape={fc as never}>
                                <MapLibreGL.LineLayer
                                    id={`line-${lineId}-layer`}
                                    style={{
                                        lineColor: style.hex,
                                        // Zoom-interpolated width: thinner at the
                                        // overview zoom so lines don't blob
                                        // together, thicker when zoomed in.
                                        lineWidth: [
                                            'interpolate',
                                            ['linear'],
                                            ['zoom'],
                                            9, lineId === 'walking-transfer' ? 1 : 2,
                                            12, lineId === 'walking-transfer' ? 1.5 : 3.5,
                                            15, lineId === 'walking-transfer' ? 2 : 5,
                                        ] as never,
                                        lineCap: 'round',
                                        lineJoin: 'round',
                                        lineOpacity: lineId === 'walking-transfer' ? 0.5 : 0.92,
                                    }}
                                />
                            </MapLibreGL.ShapeSource>
                        );
                    })}
                    <MapLibreGL.ShapeSource id="stations" shape={stationFeatureCollection as never}>
                        <MapLibreGL.CircleLayer
                            id="stations-layer"
                            // Hide stations at the very lowest zooms so the
                            // map isn't a soup of dots; let interchanges show
                            // first, then everything as you zoom in.
                            minZoomLevel={9}
                            style={{
                                circleColor: '#ffffff',
                                circleStrokeColor: colors.ink,
                                circleStrokeWidth: 1.4,
                                circleRadius: [
                                    'interpolate',
                                    ['linear'],
                                    ['zoom'],
                                    9, ['case', ['==', ['get', 'isInterchange'], 1], 2.5, 1.4],
                                    12, ['case', ['==', ['get', 'isInterchange'], 1], 4.5, 2.8],
                                    15, ['case', ['==', ['get', 'isInterchange'], 1], 7, 4.5],
                                ] as never,
                            }}
                        />
                    </MapLibreGL.ShapeSource>
                    {highlightFeatureCollection.features.length > 0 ? (
                        <MapLibreGL.ShapeSource id="highlight-route" shape={highlightFeatureCollection as never}>
                            <MapLibreGL.LineLayer
                                id="highlight-route-layer"
                                style={{
                                    lineColor: colors.accent,
                                    lineWidth: 6,
                                    lineOpacity: 0.7,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                }}
                            />
                        </MapLibreGL.ShapeSource>
                    ) : null}
                </MapLibreGL.MapView>
                <View style={styles.overlay} pointerEvents="box-none">
                    <View style={styles.controlRow}>
                        <Pressable
                            onPress={() => setZoomLevel((c) => Math.min(c + 1, 18))}
                            style={styles.controlButton}
                        >
                            <Text style={styles.controlText}>+</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setZoomLevel((c) => Math.max(c - 1, 8))}
                            style={styles.controlButton}
                        >
                            <Text style={styles.controlText}>−</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => {
                                setCenterCoordinate(DEFAULT_CENTER);
                                setZoomLevel(11);
                            }}
                            style={styles.controlButton}
                        >
                            <Text style={styles.controlText}>Reset</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
            <TubeLineLegend />
        </View>
    );
}

function TubeLineLegend(): React.JSX.Element {
    // Only show the TfL-branded lines, skip "unknown" and walking-transfer
    const entries = Object.entries(TUBE_LINE_STYLES).filter(
        ([id]) => id !== 'unknown' && id !== 'walking-transfer',
    );
    return (
        <View style={styles.legend}>
            <Text style={styles.legendHeader}>Lines</Text>
            <View style={styles.legendRow}>
                {entries.map(([id, style]) => (
                    <View key={id} style={styles.legendItem}>
                        <View style={[styles.legendSwatch, { backgroundColor: style.hex }]} />
                        <Text style={styles.legendText}>{style.displayName}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 10,
    },
    heading: {
        color: colors.ink,
        fontSize: 18,
        fontWeight: '700',
    },
    copy: {
        color: colors.rail,
        fontSize: 13,
    },
    mapShell: {
        backgroundColor: '#e9edea',
        borderColor: colors.line,
        borderRadius: 20,
        borderWidth: 1,
        height: 520,
        overflow: 'hidden',
    },
    overlay: {
        padding: 12,
        position: 'absolute',
        right: 0,
        top: 0,
    },
    controlRow: {
        flexDirection: 'column',
        gap: 6,
    },
    controlButton: {
        backgroundColor: 'rgba(17, 33, 29, 0.82)',
        borderRadius: 999,
        minWidth: 40,
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    controlText: {
        color: '#fffaf1',
        fontSize: 14,
        fontWeight: '700',
    },
    legend: {
        backgroundColor: colors.paperSunken,
        borderRadius: 14,
        padding: 10,
        gap: 6,
    },
    legendHeader: {
        color: colors.inkMuted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    legendRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendSwatch: {
        width: 16,
        height: 4,
        borderRadius: 2,
    },
    legendText: {
        color: colors.ink,
        fontSize: 11,
        fontWeight: '600',
    },
});
