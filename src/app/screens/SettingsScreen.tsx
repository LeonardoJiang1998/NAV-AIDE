import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { SectionCard } from '../components/SectionCard';
import { StatusChip } from '../components/StatusChip';
import { SystemAlertsCard } from '../components/SystemAlertsCard';
import { useAppShell } from '../state/AppShellContext';
import { colors } from '../theme';
import { shellStyles } from './shared';

export function SettingsScreen(): React.JSX.Element {
    const { assetStatus, assetDiagnostics, modelStatus, preferences, permissions, runtimeState, feedbackQueue, deviceInfo, refreshSystemState, updatePermission, updatePreference } = useAppShell();

    return (
        <ScrollView contentContainerStyle={shellStyles.screen}>
            <Text style={shellStyles.title}>Settings</Text>
            <Text style={shellStyles.copy}>Manage offline content, preferences, permissions, queued feedback, and device-level status for the shell.</Text>
            <SystemAlertsCard />
            <SectionCard>
                <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>Offline content</Text>
                    <StatusChip label={assetStatus?.ready ? 'ready' : 'update needed'} tone={assetStatus?.ready ? 'good' : 'warn'} />
                </View>
                <Text style={shellStyles.copy}>Model path: {modelStatus?.modelPath ?? 'models/gemma4-e2b.gguf'}</Text>
                <Text style={shellStyles.copy}>Tracked assets: {assetStatus?.checks.length ?? 0}</Text>
                <Text style={shellStyles.copy}>Offline cache state: {assetDiagnostics.cacheState}</Text>
                <Text style={shellStyles.copy}>Missing asset count: {assetDiagnostics.missingCount}</Text>
                <Text style={shellStyles.copy}>Checksum mismatches: {assetDiagnostics.checksumMismatchCount}</Text>
                <Text style={shellStyles.copy}>Map MBTiles path: {assetStatus?.resolvedPaths.mapMbtiles.resolvedPath ?? 'maps/london.mbtiles'}</Text>
                <Pressable onPress={() => void refreshSystemState()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Refresh status</Text></Pressable>
            </SectionCard>
            <SectionCard>
                <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>Runtime state</Text>
                    <StatusChip label={runtimeState.source} tone={runtimeState.source === 'sqlite-runtime' ? 'good' : 'warn'} />
                </View>
                <Text style={shellStyles.copy}>Entity source: {runtimeState.entitySource}</Text>
                <Text style={shellStyles.copy}>POI source: {runtimeState.poiSource}</Text>
                <Text style={shellStyles.copy}>Disruption source: {runtimeState.disruptionSource}</Text>
                <Text style={shellStyles.copy}>Walking assets available: {runtimeState.walkingAssetsAvailable ? 'yes' : 'no'}</Text>
                <Text style={shellStyles.copy}>Entity count: {runtimeState.entityCount}</Text>
                <Text style={shellStyles.copy}>POI count: {runtimeState.poiCount}</Text>
                <Text style={shellStyles.copy}>{runtimeState.reasons.join(' ')}</Text>
            </SectionCard>
            <SectionCard>
                <Text style={styles.sectionTitle}>Preferences</Text>
                <View style={styles.toggleRow}><Text style={shellStyles.copy}>Voice guidance</Text><Switch value={preferences.voiceEnabled} onValueChange={(value) => updatePreference('voiceEnabled', value)} /></View>
                <View style={styles.toggleRow}><Text style={shellStyles.copy}>Prefer walking first</Text><Switch value={preferences.preferWalkingFirst} onValueChange={(value) => updatePreference('preferWalkingFirst', value)} /></View>
            </SectionCard>
            <SectionCard>
                <Text style={styles.sectionTitle}>Permissions</Text>
                <View style={styles.toggleRow}><Text style={shellStyles.copy}>GPS permission</Text><Switch value={permissions.gps} onValueChange={(value) => updatePermission('gps', value)} /></View>
                <View style={styles.toggleRow}><Text style={shellStyles.copy}>Microphone permission</Text><Switch value={permissions.microphone} onValueChange={(value) => updatePermission('microphone', value)} /></View>
            </SectionCard>
            <SectionCard>
                <Text style={styles.sectionTitle}>Feedback queue</Text>
                {feedbackQueue.length === 0 ? <Text style={shellStyles.copy}>No queued journey feedback yet.</Text> : feedbackQueue.map((entry) => (
                    <Text key={entry.id} style={shellStyles.copy}>{entry.rating}: {entry.routeLabel}</Text>
                ))}
            </SectionCard>
            <SectionCard>
                <Text style={styles.sectionTitle}>Device info</Text>
                <Text style={shellStyles.copy}>Platform: {deviceInfo.platform}</Text>
                <Text style={shellStyles.copy}>Local model loaded: {modelStatus?.loaded ? 'yes' : 'pending native runtime'}</Text>
                <Text style={shellStyles.copy}>Model backend: {modelStatus?.backend ?? 'llama.rn'}</Text>
                <Text style={shellStyles.copy}>Model issue: {modelStatus?.failureReason ?? 'none'}</Text>
            </SectionCard>
            <SectionCard>
                <Text style={styles.sectionTitle}>Attributions</Text>
                <Text style={shellStyles.copy}>AiDEMAIN Ltd.</Text>
                <Text style={shellStyles.copy}>© OpenStreetMap contributors</Text>
                <Text style={shellStyles.copy}>Powered by TfL Open Data</Text>
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
});