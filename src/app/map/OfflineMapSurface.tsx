import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

import { colors } from '../theme';

export interface OfflineMapSurfaceProps {
    mbtilesPath: string;
}

export function OfflineMapSurface({ mbtilesPath }: OfflineMapSurfaceProps): React.JSX.Element {
    return (
        <View style={styles.frame}>
            <Text style={styles.heading}>Offline Map Layer Hook</Text>
            <Text style={styles.copy}>MBTiles path: {mbtilesPath}</Text>
            <View style={styles.mapShell}>
                <MapLibreGL.MapView style={StyleSheet.absoluteFill} styleURL="asset://styles/offline-style.json">
                    <MapLibreGL.Camera zoomLevel={11} centerCoordinate={[-0.1276, 51.5072]} />
                </MapLibreGL.MapView>
            </View>
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
});