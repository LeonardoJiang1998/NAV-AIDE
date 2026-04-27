import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { CollapsibleCard } from '../components/CollapsibleCard';
import { SectionCard } from '../components/SectionCard';
import { StatusChip } from '../components/StatusChip';
import { SystemAlertsCard } from '../components/SystemAlertsCard';
import { DownloadScreen } from '../download/DownloadScreen';
import { useAppShell } from '../state/AppShellContext';
import { colors } from '../theme';
import { shellStyles } from './shared';

/**
 * Settings layout intent: actionable controls first (preferences, permissions,
 * feedback queue), reference data behind collapsible cards (asset paths,
 * runtime probe state, system alerts). Mirrors GO / Maps / LOST? in keeping
 * the diagnostic wall out of the user's face by default.
 */
export function SettingsScreen(): React.JSX.Element {
    const {
        assetStatus,
        assetDiagnostics,
        demoReadiness,
        modelStatus,
        preferences,
        permissions,
        runtimeState,
        voiceCapabilities,
        feedbackQueue,
        deviceInfo,
        mobilePipeline,
        refreshSystemState,
        requestDemoPermissions,
        updatePermission,
        updatePreference,
    } = useAppShell();

    const placementGuide = assetStatus
        ? mobilePipeline.runtimeAdapters.assetLoader.getResolvedPlacementGuide(assetStatus.resolvedPaths)
        : [];

    return (
        <ScrollView contentContainerStyle={shellStyles.screen}>
            <View style={styles.hero}>
                <View style={styles.heroHeader}>
                    <Text style={shellStyles.title}>Settings</Text>
                    <StatusChip
                        label={demoReadiness.readyForInternalDemo ? 'ready' : 'partial'}
                        tone={demoReadiness.readyForInternalDemo ? 'good' : 'warn'}
                    />
                </View>
                <Text style={[shellStyles.copy, styles.heroCopy]}>
                    Manage your guidance preferences, permissions, and offline downloads.
                </Text>
            </View>

            {/* Preferences — the actual user-facing settings */}
            <SectionCard>
                <Text style={styles.sectionTitle}>Preferences</Text>
                <View style={styles.toggleRow}>
                    <View style={styles.toggleLabel}>
                        <Text style={styles.toggleHeading}>Voice guidance</Text>
                        <Text style={styles.toggleHint}>Speak directions aloud after each search.</Text>
                    </View>
                    <Switch
                        value={preferences.voiceEnabled}
                        onValueChange={(value) => updatePreference('voiceEnabled', value)}
                    />
                </View>
                <View style={styles.toggleRow}>
                    <View style={styles.toggleLabel}>
                        <Text style={styles.toggleHeading}>Prefer walking first</Text>
                        <Text style={styles.toggleHint}>Suggest walking when distances are short, before tube routing.</Text>
                    </View>
                    <Switch
                        value={preferences.preferWalkingFirst}
                        onValueChange={(value) => updatePreference('preferWalkingFirst', value)}
                    />
                </View>
            </SectionCard>

            {/* Permissions — actionable, with one-tap request */}
            <SectionCard>
                <Text style={styles.sectionTitle}>Permissions</Text>
                <View style={styles.toggleRow}>
                    <View style={styles.toggleLabel}>
                        <Text style={styles.toggleHeading}>Location (GPS)</Text>
                        <Text style={styles.toggleHint}>
                            Status: {voiceCapabilities?.locationPermission ?? 'unknown'}
                        </Text>
                    </View>
                    <Switch
                        value={permissions.gps}
                        onValueChange={(value) => updatePermission('gps', value)}
                    />
                </View>
                <View style={styles.toggleRow}>
                    <View style={styles.toggleLabel}>
                        <Text style={styles.toggleHeading}>Microphone</Text>
                        <Text style={styles.toggleHint}>
                            Status: {voiceCapabilities?.microphonePermission ?? 'unknown'} ·
                            {' '}STT: {voiceCapabilities?.stt ? 'ready' : 'unavailable'} ·
                            {' '}TTS: {voiceCapabilities?.tts ? 'ready' : 'unavailable'}
                        </Text>
                    </View>
                    <Switch
                        value={permissions.microphone}
                        onValueChange={(value) => updatePermission('microphone', value)}
                    />
                </View>
                <Pressable onPress={() => void requestDemoPermissions()} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Request permissions (Android)</Text>
                </Pressable>
            </SectionCard>

            {/* Offline downloads — keep the existing manager visible */}
            <SectionCard>
                <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>Offline content</Text>
                    <StatusChip
                        label={assetStatus?.ready ? 'ready' : 'update needed'}
                        tone={assetStatus?.ready ? 'good' : 'warn'}
                    />
                </View>
                <Text style={shellStyles.copy}>
                    {assetDiagnostics.cacheState === 'offline-with-cache'
                        ? 'Local cache is in place. Tube routing and POI search work without a network.'
                        : 'No offline cache yet — start a download to make routing usable in airplane mode.'}
                </Text>
                <Text style={styles.metricsRow}>
                    <Text style={styles.metricLabel}>Tracked: </Text>{assetStatus?.checks.length ?? 0}
                    <Text style={styles.metricLabel}>  Missing: </Text>{assetDiagnostics.missingCount}
                    <Text style={styles.metricLabel}>  Bad checksum: </Text>{assetDiagnostics.checksumMismatchCount}
                </Text>
                <Pressable onPress={() => void refreshSystemState()} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Refresh status</Text>
                </Pressable>
            </SectionCard>

            {/* Feedback queue — small, useful when populated */}
            <SectionCard>
                <Text style={styles.sectionTitle}>Feedback queue</Text>
                {feedbackQueue.length === 0 ? (
                    <Text style={shellStyles.copy}>No queued journey feedback yet.</Text>
                ) : (
                    feedbackQueue.map((entry) => (
                        <Text key={entry.id} style={shellStyles.copy}>
                            {entry.rating === 'up' ? '👍' : '👎'} {entry.routeLabel}
                        </Text>
                    ))
                )}
            </SectionCard>

            {/* Diagnostics — collapsed by default */}
            <CollapsibleCard
                title="System alerts"
                subtitle={`${assetDiagnostics.missingCount} missing · ${assetDiagnostics.checksumMismatchCount} bad checksum`}
            >
                <SystemAlertsCard />
            </CollapsibleCard>

            <CollapsibleCard
                title="Runtime"
                subtitle={`${runtimeState.source} · entities ${runtimeState.entityCount} · POIs ${runtimeState.poiCount}`}
            >
                <Text style={shellStyles.copy}>Entity source: {runtimeState.entitySource}</Text>
                <Text style={shellStyles.copy}>POI source: {runtimeState.poiSource}</Text>
                <Text style={shellStyles.copy}>Disruption source: {runtimeState.disruptionSource}</Text>
                <Text style={shellStyles.copy}>Walking assets: {runtimeState.walkingAssetsAvailable ? 'yes' : 'no'}</Text>
                <Text style={shellStyles.copy}>Demo readiness: {demoReadiness.mode}</Text>
                <Text style={shellStyles.copy}>{runtimeState.reasons.join(' ')}</Text>
            </CollapsibleCard>

            <CollapsibleCard
                title="Device backed vs fallback"
                subtitle={`${demoReadiness.deviceBacked.length} device-backed · ${demoReadiness.fallback.length} fallback`}
            >
                {demoReadiness.deviceBacked.map((entry) => (
                    <Text key={`db-${entry}`} style={shellStyles.copy}>✓ {entry}</Text>
                ))}
                {demoReadiness.fallback.map((entry) => (
                    <Text key={`fb-${entry}`} style={shellStyles.copy}>↪ {entry}</Text>
                ))}
                {demoReadiness.blockers.map((entry) => (
                    <Text key={`bl-${entry}`} style={shellStyles.copy}>! {entry}</Text>
                ))}
            </CollapsibleCard>

            <CollapsibleCard
                title="Asset paths"
                subtitle={`${placementGuide.length} tracked locations`}
            >
                {placementGuide.map((entry) => (
                    <View key={entry.key} style={styles.assetRow}>
                        <Text style={styles.assetName}>{entry.label}</Text>
                        <Text style={shellStyles.copy}>Path: {entry.relativePath}</Text>
                        <Text style={shellStyles.copy}>
                            {entry.resolution.exists
                                ? `Resolved (${entry.resolution.source})`
                                : 'Not yet on device'}
                        </Text>
                    </View>
                ))}
            </CollapsibleCard>

            <CollapsibleCard
                title="Device info"
                subtitle={`${deviceInfo.platform} · model ${modelStatus?.loaded ? 'loaded' : 'pending'}`}
            >
                <Text style={shellStyles.copy}>Platform: {deviceInfo.platform}</Text>
                <Text style={shellStyles.copy}>Model loaded: {modelStatus?.loaded ? 'yes' : 'pending'}</Text>
                <Text style={shellStyles.copy}>Model backend: {modelStatus?.backend ?? 'llama.rn'}</Text>
                <Text style={shellStyles.copy}>Model path: {modelStatus?.modelPath ?? '—'}</Text>
                {modelStatus?.failureReason ? (
                    <Text style={shellStyles.copy}>Issue: {modelStatus.failureReason}</Text>
                ) : null}
            </CollapsibleCard>

            <CollapsibleCard title="Downloads" subtitle="Manage bundled and downloaded assets">
                <DownloadScreen />
            </CollapsibleCard>

            <SectionCard>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={shellStyles.copy}>NAV AiDE · AiDEMAIN Ltd.</Text>
                <Text style={shellStyles.copy}>Routing data: TfL Open Data + OpenStreetMap.</Text>
                <Text style={shellStyles.copy}>Inference: Gemma 3 1B (instruction-tuned, on-device).</Text>
            </SectionCard>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    hero: {
        gap: 6,
    },
    heroHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    heroCopy: {
        color: colors.inkMuted,
    },
    rowBetween: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        color: colors.ink,
        fontSize: 16,
        fontWeight: '700',
    },
    toggleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
    },
    toggleLabel: {
        flex: 1,
        gap: 2,
    },
    toggleHeading: {
        color: colors.ink,
        fontSize: 15,
        fontWeight: '600',
    },
    toggleHint: {
        color: colors.inkMuted,
        fontSize: 12,
    },
    metricsRow: {
        color: colors.ink,
        fontSize: 14,
    },
    metricLabel: {
        color: colors.inkMuted,
        fontSize: 12,
        fontWeight: '600',
    },
    primaryButton: {
        alignSelf: 'flex-start',
        backgroundColor: colors.accent,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    primaryButtonText: {
        color: '#fffaf1',
        fontWeight: '700',
    },
    secondaryButton: {
        alignSelf: 'flex-start',
        backgroundColor: colors.paperSunken,
        borderColor: colors.line,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    secondaryButtonText: {
        color: colors.ink,
        fontWeight: '700',
    },
    assetRow: {
        borderTopColor: colors.line,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 2,
        paddingTop: 8,
    },
    assetName: {
        color: colors.ink,
        fontSize: 14,
        fontWeight: '600',
    },
});
