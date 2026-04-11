import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { SectionCard } from '../components/SectionCard';
import { StatusChip } from '../components/StatusChip';
import { SystemAlertsCard } from '../components/SystemAlertsCard';
import { OfflineMapSurface } from '../map/OfflineMapSurface';
import { sampleDestinationPins } from '../pipeline/mobileFixtures';
import { useAppShell } from '../state/AppShellContext';
import { colors } from '../theme';
import { shellStyles } from './shared';

export function MapsScreen(): React.JSX.Element {
    const { assetStatus, deviceInfo, runtimeState, stagedDestination, stageDestination } = useAppShell();
    const [showTube, setShowTube] = useState(true);
    const [showBus, setShowBus] = useState(true);
    const [showWalking, setShowWalking] = useState(false);
    const [selectedDestination, setSelectedDestination] = useState<string | null>(null);

    const selectedCoordinate = selectedDestination
        ? ([sampleDestinationPins[selectedDestination].longitude, sampleDestinationPins[selectedDestination].latitude] as [number, number])
        : null;

    return (
        <ScrollView contentContainerStyle={shellStyles.screen}>
            <Text style={shellStyles.title}>Maps</Text>
            <Text style={shellStyles.copy}>Toggle map layers, inspect the offline surface, and stage a navigate-here destination for the GO flow.</Text>
            <SystemAlertsCard />
            <OfflineMapSurface
                mbtilesPath={assetStatus?.resolvedPaths.mapMbtiles.resolvedPath ?? 'maps/london.mbtiles'}
                mapAvailable={assetStatus?.resolvedPaths.mapMbtiles.exists ?? false}
                showTube={showTube}
                showBus={showBus}
                showWalking={showWalking}
                selectedLabel={selectedDestination}
                selectedCoordinate={selectedCoordinate}
            />
            <SectionCard>
                <Text style={styles.sectionTitle}>Layer toggles</Text>
                <View style={styles.toggleRow}><Text style={shellStyles.copy}>Tube</Text><Switch value={showTube} onValueChange={setShowTube} /></View>
                <View style={styles.toggleRow}><Text style={shellStyles.copy}>Bus</Text><Switch value={showBus} onValueChange={setShowBus} /></View>
                <View style={styles.toggleRow}><Text style={shellStyles.copy}>Walking</Text><Switch value={showWalking} onValueChange={setShowWalking} /></View>
                <Text style={shellStyles.copy}>Runtime source: {runtimeState.source}. Map asset: {assetStatus?.resolvedPaths.mapMbtiles.exists ? 'present' : 'missing'}.</Text>
            </SectionCard>
            <SectionCard>
                <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>Navigate here</Text>
                    {stagedDestination ? <StatusChip label={`GO target: ${stagedDestination}`} tone="good" /> : null}
                </View>
                <View style={styles.destinationRow}>
                    {deviceInfo.sampleDestinations.map((destination) => (
                        <Pressable key={destination} onPress={() => setSelectedDestination(destination)} style={[styles.destinationPill, selectedDestination === destination ? styles.destinationPillActive : null]}>
                            <Text style={selectedDestination === destination ? styles.destinationTextActive : styles.destinationText}>{destination}</Text>
                        </Pressable>
                    ))}
                </View>
                <View style={styles.buttonRow}>
                    <Pressable disabled={!selectedDestination} onPress={() => selectedDestination ? stageDestination(selectedDestination) : null} style={[styles.primaryButton, !selectedDestination ? styles.primaryButtonDisabled : null]}>
                        <Text style={styles.primaryButtonText}>Navigate in GO</Text>
                    </Pressable>
                </View>
                <Text style={shellStyles.copy}>{selectedDestination ? `Destination ready: ${selectedDestination}. Send it to GO to run the route search.` : 'Pick a saved destination to stage the next journey.'}</Text>
            </SectionCard>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    rowBetween: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        color: colors.ink,
        fontSize: 18,
        fontWeight: '700',
    },
    toggleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    destinationRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    buttonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    destinationPill: {
        backgroundColor: '#ece4d7',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    destinationPillActive: {
        backgroundColor: colors.accent,
    },
    destinationText: {
        color: colors.ink,
        fontWeight: '600',
    },
    destinationTextActive: {
        color: '#fffaf1',
        fontWeight: '700',
    },
    primaryButton: {
        backgroundColor: colors.accent,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    primaryButtonDisabled: {
        opacity: 0.45,
    },
    primaryButtonText: {
        color: '#fffaf1',
        fontWeight: '700',
    },
});