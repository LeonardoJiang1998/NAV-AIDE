import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

import { buildMapStyle } from './buildMapStyle';
import { colors } from '../theme';

export interface OfflineMapSurfaceProps {
    mbtilesPath: string;
    mapAvailable: boolean;
    showTube: boolean;
    showBus: boolean;
    showWalking: boolean;
    selectedLabel?: string | null;
    selectedCoordinate?: [number, number] | null;
    /**
     * Absolute `file://` prefix where the extracted raster tiles live. If
     * unset or null, the map falls back to OSM raster over HTTPS (which works
     * online but doesn't satisfy the "airplane mode" promise).
     */
    localTilesPrefix?: string | null;
}

const DEFAULT_CENTER: [number, number] = [-0.1276, 51.5072];

export function OfflineMapSurface({
    mbtilesPath,
    mapAvailable,
    showTube,
    showBus,
    showWalking,
    selectedLabel = null,
    selectedCoordinate = null,
    localTilesPrefix = null,
}: OfflineMapSurfaceProps): React.JSX.Element {
    const [centerCoordinate, setCenterCoordinate] = useState<[number, number]>(DEFAULT_CENTER);
    const [zoomLevel, setZoomLevel] = useState(11);
    const [lastPressedCoordinate, setLastPressedCoordinate] = useState<[number, number] | null>(null);

    // Build the style JSON once per localTilesPrefix change. MapLibre's
    // `styleJSON` prop accepts a stringified style and re-evaluates when it
    // changes, so flipping on/off tiles at runtime works without a full map
    // tear-down.
    const styleJSON = useMemo(
        () => JSON.stringify(buildMapStyle({ localTilesPrefix })),
        [localTilesPrefix],
    );

    useEffect(() => {
        if (selectedCoordinate) {
            setCenterCoordinate(selectedCoordinate);
            setZoomLevel(13);
        }
    }, [selectedCoordinate]);

    const visibleLayers = useMemo(() => [
        showTube ? 'Tube' : null,
        showBus ? 'Bus' : null,
        showWalking ? 'Walking' : null,
    ].filter(Boolean).join(', ') || 'None', [showBus, showTube, showWalking]);

    return (
        <View style={styles.frame}>
            <Text style={styles.heading}>Offline Map Surface</Text>
            <Text style={styles.copy}>MBTiles path: {mbtilesPath}</Text>
            <Text style={styles.copy}>{mapAvailable ? 'Offline map asset detected.' : 'Offline map asset not found on device. Rendering shell map with static style path only.'}</Text>
            <Text style={styles.copy}>Visible layers: {visibleLayers}</Text>
            <View style={styles.mapShell}>
                <MapLibreGL.MapView
                    style={StyleSheet.absoluteFill}
                    mapStyle={styleJSON}
                    onPress={(event: { geometry?: { coordinates?: [number, number] } }) => {
                        if (event.geometry?.coordinates) {
                            setLastPressedCoordinate(event.geometry.coordinates);
                        }
                    }}
                >
                    <MapLibreGL.Camera zoomLevel={zoomLevel} centerCoordinate={centerCoordinate} />
                </MapLibreGL.MapView>
                <View style={styles.overlay} pointerEvents="box-none">
                    <View style={styles.controlRow}>
                        <Pressable onPress={() => setZoomLevel((current) => Math.min(current + 1, 18))} style={styles.controlButton}>
                            <Text style={styles.controlText}>Zoom +</Text>
                        </Pressable>
                        <Pressable onPress={() => setZoomLevel((current) => Math.max(current - 1, 8))} style={styles.controlButton}>
                            <Text style={styles.controlText}>Zoom -</Text>
                        </Pressable>
                        <Pressable onPress={() => {
                            setCenterCoordinate(DEFAULT_CENTER);
                            setZoomLevel(11);
                        }} style={styles.controlButton}>
                            <Text style={styles.controlText}>Recenter</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
            <Text style={styles.copy}>Center: {centerCoordinate[1].toFixed(4)}, {centerCoordinate[0].toFixed(4)} at zoom {zoomLevel}</Text>
            {selectedLabel ? <Text style={styles.copy}>Focused destination: {selectedLabel}</Text> : null}
            {lastPressedCoordinate ? <Text style={styles.copy}>Last map press: {lastPressedCoordinate[1].toFixed(4)}, {lastPressedCoordinate[0].toFixed(4)}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    frame: {
        gap: 12,
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
        backgroundColor: '#dbe6e0',
        borderColor: colors.line,
        borderRadius: 20,
        borderWidth: 1,
        height: 320,
        overflow: 'hidden',
    },
    overlay: {
        alignItems: 'flex-start',
        padding: 12,
        position: 'absolute',
        width: '100%',
    },
    controlRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    controlButton: {
        backgroundColor: 'rgba(17, 33, 29, 0.82)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    controlText: {
        color: '#fffaf1',
        fontSize: 12,
        fontWeight: '700',
    },
});