import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { useAppShell } from '../state/AppShellContext';
import { colors } from '../theme';
import { SectionCard } from './SectionCard';
import { StatusChip } from './StatusChip';

interface AlertDescriptor {
    key: string;
    label: string;
    tone: 'neutral' | 'good' | 'warn' | 'bad';
    detail: string;
}

export function SystemAlertsCard(): React.JSX.Element {
    const { assetStatus, assetDiagnostics, demoReadiness, modelStatus, permissions, runtimeState, voiceCapabilities } = useAppShell();

    const alerts: AlertDescriptor[] = [
        {
            key: 'cache-state',
            label: assetDiagnostics.cacheState,
            tone: assetDiagnostics.cacheState === 'offline-with-cache' ? 'good' : 'warn',
            detail:
                assetDiagnostics.cacheState === 'offline-with-cache'
                    ? 'Offline cache is available, so the shell can still present partial local guidance when downloads are incomplete.'
                    : 'No cached offline assets are available yet, so guidance is limited until downloads succeed.',
        },
    ];

    if (!assetStatus?.ready) {
        alerts.push({
            key: 'assets-pending',
            label: 'assets not downloaded',
            tone: 'warn',
            detail: 'Offline routing and lookup assets are not fully available yet. Download completion is required for full offline use.',
        });
    }

    if (assetDiagnostics.missingCount > 0) {
        alerts.push({
            key: 'download-failure',
            label: 'download failure risk',
            tone: 'bad',
            detail: `${assetDiagnostics.missingCount} required offline assets are missing from the local manifest check.`,
        });
    }

    if (assetDiagnostics.checksumMismatchCount > 0) {
        alerts.push({
            key: 'checksum-mismatch',
            label: 'checksum mismatch',
            tone: 'bad',
            detail: `${assetDiagnostics.checksumMismatchCount} downloaded assets failed checksum validation and should not be trusted.`,
        });
    }

    if (!modelStatus?.loaded) {
        alerts.push({
            key: 'model-loading',
            label: 'model loading',
            tone: 'warn',
            detail: modelStatus?.failureReason ?? 'The native Gemma runtime is still pending. Structured normalization is scaffolded, but native model loading is not active yet.',
        });
    }

    if (runtimeState.source === 'fixture-fallback') {
        alerts.push({
            key: 'fixture-runtime',
            label: 'fixture fallback',
            tone: 'warn',
            detail: runtimeState.reasons.join(' '),
        });
    }

    if (!demoReadiness.readyForInternalDemo) {
        alerts.push({
            key: 'demo-readiness',
            label: 'demo not fully device-backed',
            tone: 'warn',
            detail: demoReadiness.blockers.join(' '),
        });
    }

    if (!voiceCapabilities?.stt) {
        alerts.push({
            key: 'stt-runtime',
            label: 'stt unavailable',
            tone: 'bad',
            detail: 'OS speech recognition did not validate on this device runtime check.',
        });
    }

    if (!voiceCapabilities?.tts) {
        alerts.push({
            key: 'tts-runtime',
            label: 'tts unavailable',
            tone: 'bad',
            detail: 'OS text-to-speech did not validate on this device runtime check.',
        });
    }

    if (voiceCapabilities?.microphonePermission === 'denied') {
        alerts.push({
            key: 'microphone',
            label: 'microphone permission denied',
            tone: 'bad',
            detail: 'Microphone access is denied, so live STT cannot be demonstrated safely.',
        });
    }

    if (!permissions.gps) {
        alerts.push({
            key: 'gps',
            label: 'no GPS permission',
            tone: 'warn',
            detail: 'The shell is using an underground-safe last known location state because live GPS permission is off.',
        });
    }

    return (
        <SectionCard>
            <Text style={styles.title}>System alerts</Text>
            {alerts.map((alert) => (
                <React.Fragment key={alert.key}>
                    <StatusChip label={alert.label} tone={alert.tone} />
                    <Text style={styles.detail}>{alert.detail}</Text>
                </React.Fragment>
            ))}
        </SectionCard>
    );
}

const styles = StyleSheet.create({
    title: {
        color: colors.ink,
        fontSize: 18,
        fontWeight: '700',
    },
    detail: {
        color: colors.rail,
        fontSize: 14,
        lineHeight: 20,
    },
});