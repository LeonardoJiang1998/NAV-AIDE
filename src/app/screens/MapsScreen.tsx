import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { CollapsibleCard } from '../components/CollapsibleCard';
import { SectionCard } from '../components/SectionCard';
import { StatusChip } from '../components/StatusChip';
import { SystemAlertsCard } from '../components/SystemAlertsCard';
import { OfflineMapSurface } from '../map/OfflineMapSurface';
import { TubeLineMap } from '../map/TubeLineMap';
import { sampleDestinationPins } from '../pipeline/mobileFixtures';
import { useAppShell } from '../state/AppShellContext';
import { colors } from '../theme';
import { shellStyles } from './shared';

export function MapsScreen(): React.JSX.Element {
    const { assetStatus, demoReadiness, deviceInfo, runtimeState, stagedDestination, stageDestination, lastRoute } = useAppShell();
    const [showTube, setShowTube] = useState(true);
    const [showBus, setShowBus] = useState(false);
    const [showWalking, setShowWalking] = useState(false);
    const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
    const [activeMap, setActiveMap] = useState<'tube' | 'city'>('tube');

    const selectedCoordinate = selectedDestination
        ? ([sampleDestinationPins[selectedDestination].longitude, sampleDestinationPins[selectedDestination].latitude] as [number, number])
        : null;

    return (
        <ScrollView contentContainerStyle={shellStyles.screen}>
            <View style={styles.heroHeader}>
                <Text style={shellStyles.title}>Maps</Text>
                {stagedDestination ? (
                    <StatusChip label={`Staged: ${stagedDestination}`} tone="good" />
                ) : null}
            </View>
            <Text style={[shellStyles.copy, styles.heroCopy]}>
                Tube network map in TfL colours, plus an OSM city map. Tap any station to stage it for GO.
            </Text>

            {/* Segmented toggle for which map to show */}
            <View style={styles.segmentControl}>
                <Pressable
                    onPress={() => setActiveMap('tube')}
                    style={[styles.segmentButton, activeMap === 'tube' ? styles.segmentButtonActive : null]}
                >
                    <Text style={activeMap === 'tube' ? styles.segmentTextActive : styles.segmentText}>
                        Tube lines
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setActiveMap('city')}
                    style={[styles.segmentButton, activeMap === 'city' ? styles.segmentButtonActive : null]}
                >
                    <Text style={activeMap === 'city' ? styles.segmentTextActive : styles.segmentText}>
                        London city
                    </Text>
                </Pressable>
            </View>

            {activeMap === 'tube' ? (
                <SectionCard>
                    <TubeLineMap
                        highlightedRoute={lastRoute?.path}
                        onStationPress={(name) => {
                            setSelectedDestination(name);
                            stageDestination(name);
                        }}
                    />
                    {lastRoute ? (
                        <View style={styles.highlightBanner}>
                            <Text style={styles.highlightText}>
                                {lastRoute.originName} → {lastRoute.destinationName}
                            </Text>
                            <Text style={styles.highlightSubtext}>{lastRoute.cost} min · highlighted below</Text>
                        </View>
                    ) : null}
                </SectionCard>
            ) : (
                <SectionCard>
                    <OfflineMapSurface
                        mbtilesPath={assetStatus?.resolvedPaths.mapMbtiles.resolvedPath ?? 'maps/london.mbtiles'}
                        mapAvailable={assetStatus?.resolvedPaths.mapMbtiles.exists ?? false}
                        showTube={showTube}
                        showBus={showBus}
                        showWalking={showWalking}
                        selectedLabel={selectedDestination}
                        selectedCoordinate={selectedCoordinate}
                    />
                </SectionCard>
            )}

            {/* Destination staging */}
            <SectionCard>
                <Text style={styles.sectionTitle}>Quick destinations</Text>
                <Text style={shellStyles.copy}>
                    Pick a nearby tourist hub and we'll pre-fill the GO search.
                </Text>
                <View style={styles.destinationRow}>
                    {deviceInfo.sampleDestinations.map((destination) => (
                        <Pressable
                            key={destination}
                            onPress={() => {
                                setSelectedDestination(destination);
                                stageDestination(destination);
                            }}
                            style={[
                                styles.destinationPill,
                                selectedDestination === destination ? styles.destinationPillActive : null,
                            ]}
                        >
                            <Text
                                style={
                                    selectedDestination === destination
                                        ? styles.destinationTextActive
                                        : styles.destinationText
                                }
                            >
                                {destination}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </SectionCard>

            {/* Layer toggles (only meaningful on city map) */}
            {activeMap === 'city' ? (
                <SectionCard>
                    <Text style={styles.sectionTitle}>Layers</Text>
                    <View style={styles.toggleRow}>
                        <Text style={shellStyles.copy}>Tube</Text>
                        <Switch value={showTube} onValueChange={setShowTube} />
                    </View>
                    <View style={styles.toggleRow}>
                        <Text style={shellStyles.copy}>Bus</Text>
                        <Switch value={showBus} onValueChange={setShowBus} />
                    </View>
                    <View style={styles.toggleRow}>
                        <Text style={shellStyles.copy}>Walking</Text>
                        <Switch value={showWalking} onValueChange={setShowWalking} />
                    </View>
                </SectionCard>
            ) : null}

            {/* Collapsed diagnostics */}
            <CollapsibleCard
                title="Diagnostics"
                subtitle={`Map asset: ${assetStatus?.resolvedPaths.mapMbtiles.exists ? 'present' : 'missing'} · Runtime: ${runtimeState.source}`}
            >
                <Text style={shellStyles.copy}>Demo mode: {demoReadiness.mode}</Text>
                <SystemAlertsCard />
            </CollapsibleCard>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    heroHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    heroCopy: {
        color: colors.inkMuted,
    },
    segmentControl: {
        backgroundColor: colors.paperSunken,
        borderRadius: 12,
        flexDirection: 'row',
        padding: 4,
    },
    segmentButton: {
        alignItems: 'center',
        borderRadius: 10,
        flex: 1,
        paddingVertical: 10,
    },
    segmentButtonActive: {
        backgroundColor: colors.paperRaised,
    },
    segmentText: {
        color: colors.inkMuted,
        fontSize: 13,
        fontWeight: '600',
    },
    segmentTextActive: {
        color: colors.ink,
        fontSize: 13,
        fontWeight: '700',
    },
    sectionTitle: {
        color: colors.ink,
        fontSize: 16,
        fontWeight: '700',
    },
    highlightBanner: {
        backgroundColor: colors.accentSoft,
        borderRadius: 12,
        padding: 10,
        marginTop: 8,
    },
    highlightText: {
        color: colors.rail,
        fontSize: 14,
        fontWeight: '700',
    },
    highlightSubtext: {
        color: colors.rail,
        fontSize: 12,
        marginTop: 2,
    },
    destinationRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    destinationPill: {
        backgroundColor: colors.paperSunken,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    destinationPillActive: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    destinationText: {
        color: colors.ink,
        fontSize: 13,
        fontWeight: '600',
    },
    destinationTextActive: {
        color: '#fffaf1',
        fontSize: 13,
        fontWeight: '700',
    },
    toggleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
});
