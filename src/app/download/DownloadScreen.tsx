import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppShell } from '../state/AppShellContext';
import { colors } from '../theme';

export function DownloadScreen(): React.JSX.Element {
    const { assetStatus, runtimeState } = useAppShell();

    const entries = assetStatus?.checks ?? [];

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Offline Download Setup</Text>
            <Text style={styles.copy}>Manifest checker and asset manager are wired. Download orchestration remains Phase 4, but the shell now reports which runtime assets are actually reachable.</Text>
            <Text style={styles.copy}>Current runtime source: {runtimeState.source}</Text>
            {entries.map((entry) => (
                <View key={entry.key} style={styles.row}>
                    <Text style={styles.key}>{entry.key}</Text>
                    <Text style={styles.path}>{entry.exists ? 'available locally' : 'missing locally'}</Text>
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