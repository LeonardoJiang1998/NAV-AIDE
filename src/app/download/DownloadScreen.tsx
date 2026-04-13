import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import RNFS from 'react-native-fs';

import { assetManifest } from '../assets/assetManifest';
import { StatusChip } from '../components/StatusChip';
import { useAppShell } from '../state/AppShellContext';
import { colors } from '../theme';
import { DownloadService, type DownloadItemState, type DownloadItemStatus } from './DownloadService';

function statusTone(status: DownloadItemStatus): 'good' | 'warn' | 'bad' | 'neutral' {
    switch (status) {
        case 'complete': return 'good';
        case 'downloading':
        case 'validating': return 'neutral';
        case 'failed': return 'bad';
        case 'pending': return 'warn';
    }
}

export function DownloadScreen(): React.JSX.Element {
    const { assetStatus, demoReadiness, mobilePipeline, refreshSystemState, runtimeState } = useAppShell();
    const [downloadStates, setDownloadStates] = useState<DownloadItemState[]>([]);
    const [downloading, setDownloading] = useState(false);

    const downloadService = useMemo(() => new DownloadService({
        baseUrl: '',
        destinationRoot: RNFS.DocumentDirectoryPath,
    }), []);

    const entries = assetStatus?.checks ?? [];
    const placementGuide = assetStatus ? mobilePipeline.runtimeAdapters.assetLoader.getResolvedPlacementGuide(assetStatus.resolvedPaths) : [];

    const startDownloadAll = async () => {
        setDownloading(true);
        try {
            await downloadService.downloadAll(assetManifest, (states) => {
                setDownloadStates([...states]);
            });
        } finally {
            setDownloading(false);
            void refreshSystemState();
        }
    };

    const retryDownload = async (key: string) => {
        const entry = assetManifest.find((e) => e.key === key);
        if (!entry) return;

        await downloadService.downloadAsset(entry, () => {
            setDownloadStates(downloadService.getState());
        });
        void refreshSystemState();
    };

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Offline Download Setup</Text>
            <Text style={styles.copy}>Current runtime source: {runtimeState.source}</Text>
            <Text style={styles.copy}>Demo mode: {demoReadiness.mode}</Text>

            {entries.map((entry) => (
                <View key={entry.key} style={styles.row}>
                    <View style={styles.rowHeader}>
                        <Text style={styles.key}>{entry.key}</Text>
                        <StatusChip label={entry.exists ? 'local' : 'missing'} tone={entry.exists ? 'good' : 'warn'} />
                    </View>
                    <Text style={styles.path}>{entry.exists ? 'Available on device' : 'Not found in device search paths'}</Text>
                </View>
            ))}

            <View style={styles.buttonRow}>
                <Pressable disabled={downloading} onPress={() => void startDownloadAll()} style={[styles.primaryButton, downloading ? styles.buttonDisabled : null]}>
                    <Text style={styles.primaryButtonText}>{downloading ? 'Downloading...' : 'Download all'}</Text>
                </Pressable>
            </View>

            {downloadStates.length > 0 ? (
                <View style={styles.downloadSection}>
                    <Text style={styles.sectionTitle}>Download Progress</Text>
                    {downloadStates.map((item) => (
                        <View key={item.key} style={styles.row}>
                            <View style={styles.rowHeader}>
                                <Text style={styles.key}>{item.key}</Text>
                                <StatusChip label={item.status} tone={statusTone(item.status)} />
                            </View>
                            {(item.status === 'downloading' || item.status === 'validating') ? (
                                <View style={styles.progressBar}>
                                    <View style={[styles.progressFill, { width: `${Math.round(item.progress * 100)}%` }]} />
                                </View>
                            ) : null}
                            {item.error ? <Text style={styles.errorText}>{item.error}</Text> : null}
                            {item.status === 'failed' ? (
                                <Pressable onPress={() => void retryDownload(item.key)} style={styles.secondaryButton}>
                                    <Text style={styles.secondaryButtonText}>Retry</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    ))}
                </View>
            ) : null}

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
    sectionTitle: {
        color: colors.ink,
        fontSize: 16,
        fontWeight: '700',
    },
    copy: {
        color: colors.rail,
        fontSize: 14,
    },
    row: {
        borderTopColor: colors.line,
        borderTopWidth: 1,
        gap: 4,
        paddingTop: 10,
    },
    rowHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    key: {
        color: colors.ink,
        fontWeight: '600',
    },
    path: {
        color: colors.rail,
        fontSize: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    primaryButton: {
        backgroundColor: colors.accent,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    primaryButtonText: {
        color: '#fffaf1',
        fontWeight: '700',
    },
    buttonDisabled: {
        opacity: 0.45,
    },
    secondaryButton: {
        alignSelf: 'flex-start',
        backgroundColor: '#ece4d7',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    secondaryButtonText: {
        color: colors.ink,
        fontWeight: '700',
    },
    downloadSection: {
        gap: 8,
    },
    progressBar: {
        backgroundColor: '#dbe6e0',
        borderRadius: 4,
        height: 8,
        overflow: 'hidden',
    },
    progressFill: {
        backgroundColor: colors.accent,
        height: '100%',
        borderRadius: 4,
    },
    errorText: {
        color: colors.warning,
        fontSize: 12,
    },
});
