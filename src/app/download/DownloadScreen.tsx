import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppShell } from '../state/AppShellContext';
import { colors } from '../theme';

export function DownloadScreen(): React.JSX.Element {
    const { assetStatus, demoReadiness, mobilePipeline, runtimeState } = useAppShell();

    const entries = assetStatus?.checks ?? [];
    const placementGuide = assetStatus ? mobilePipeline.runtimeAdapters.assetLoader.getResolvedPlacementGuide(assetStatus.resolvedPaths) : [];

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Offline Download Setup</Text>
            <Text style={styles.copy}>Manifest checker and asset manager are wired. Download orchestration remains Phase 4, but the shell now reports which runtime assets are actually reachable.</Text>
            <Text style={styles.copy}>Current runtime source: {runtimeState.source}</Text>
            <Text style={styles.copy}>Demo mode: {demoReadiness.mode}</Text>
            {entries.map((entry) => (
                <View key={entry.key} style={styles.row}>
                    <Text style={styles.key}>{entry.key}</Text>
                    <Text style={styles.path}>{entry.exists ? 'available locally' : 'missing locally'}</Text>
                </View>
            ))}
            {placementGuide.map((entry) => (
                <View key={`${entry.key}-paths`} style={styles.row}>
                    <Text style={styles.key}>{entry.label}</Text>
                    <Text style={styles.path}>Relative path: {entry.relativePath}</Text>
                    <Text style={styles.path}>Resolved status: {entry.resolution.exists ? `${entry.resolution.source} -> ${entry.resolution.resolvedPath}` : 'missing'}</Text>
                    {entry.resolution.candidates.map((candidate) => (
                        <Text key={candidate.path} style={styles.path}>Try: {candidate.path}</Text>
                    ))}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.paper,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 18,
        gap: 10,
        padding: 18,
    },
    title: {
        color: colors.ink,
        fontSize: 20,
        fontWeight: '700',
    },
    copy: {
        color: colors.rail,
        fontSize: 14,
    },
    row: {
        borderTopColor: colors.line,
        borderTopWidth: 1,
        paddingTop: 10,
    },
    key: {
        color: colors.ink,
        fontWeight: '600',
    },
    path: {
        color: colors.rail,
        fontSize: 12,
    },
});