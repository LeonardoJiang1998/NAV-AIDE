import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { assetManifest } from '../assets/assetManifest';
import { colors } from '../theme';

export function DownloadScreen(): React.JSX.Element {
    return (
        <View style={styles.card}>
            <Text style={styles.title}>Offline Download Setup</Text>
            <Text style={styles.copy}>Manifest checker and asset manager are wired. Download orchestration lands here in Phase 4.</Text>
            {assetManifest.map((entry) => (
                <View key={entry.key} style={styles.row}>
                    <Text style={styles.key}>{entry.key}</Text>
                    <Text style={styles.path}>{entry.path}</Text>
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