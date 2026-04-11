import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Tts from 'react-native-tts';

import { RouteCard } from '../components/RouteCard';
import { SectionCard } from '../components/SectionCard';
import { StatusChip } from '../components/StatusChip';
import { SystemAlertsCard } from '../components/SystemAlertsCard';
import { DownloadScreen } from '../download/DownloadScreen';
import { useAppShell } from '../state/AppShellContext';
import { colors } from '../theme';
import { shellStyles } from './shared';

const transportModes = ['Tube', 'Walk', 'Mixed'];

interface FlowAlert {
    label: string;
    detail: string;
    tone: 'neutral' | 'good' | 'warn' | 'bad';
}

function mapPipelineError(error: unknown): FlowAlert {
    const message = error instanceof Error ? error.message : 'Unknown pipeline failure.';

    if (/hallucinated/i.test(message)) {
        return { label: 'hallucinated locations', detail: 'Rendered output referenced a place that is not in the allowed local place set, so the response was rejected.', tone: 'bad' };
    }

    if (/json|parse/i.test(message)) {
        return { label: 'invalid JSON from LLM', detail: 'Structured normalization returned invalid JSON, so the shell stopped instead of guessing.', tone: 'bad' };
    }

    return { label: 'query error', detail: message, tone: 'bad' };
}

export function GoScreen(): React.JSX.Element {
    const { assetStatus, assetDiagnostics, modelStatus, permissions, preferences, runtimeState, voiceCapabilities, stagedDestination, clearStagedDestination, enqueueFeedback, mobilePipeline } = useAppShell();
    const [query, setQuery] = useState('How do I get from Waterloo to Baker Street?');
    const [transportMode, setTransportMode] = useState('Tube');
    const [resultText, setResultText] = useState<string | null>(null);
    const [result, setResult] = useState<Awaited<ReturnType<typeof mobilePipeline.queryPipeline.execute>> | null>(null);
    const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
    const [flowAlert, setFlowAlert] = useState<FlowAlert | null>(null);

    const statusTone = useMemo(() => {
        if (!assetStatus?.ready) {
            return { label: 'assets pending', tone: 'warn' as const };
        }
        if (!permissions.gps) {
            return { label: 'last known location', tone: 'warn' as const };
        }
        return { label: 'blue dot ready', tone: 'good' as const };
    }, [assetStatus?.ready, permissions.gps]);

    useEffect(() => {
        if (stagedDestination) {
            setQuery(`Take me to ${stagedDestination}`);
            setFlowAlert({ label: 'navigate-here staged', detail: `${stagedDestination} was sent from Maps and is ready to route from GO.`, tone: 'good' });
        }
    }, [stagedDestination]);

    const runQuery = async () => {
        setFlowAlert(null);

        try {
            const pipelineResult = await mobilePipeline.queryPipeline.execute(query, mobilePipeline.knownStations);
            setResult(pipelineResult);
            setResultText(pipelineResult.rendered?.text ?? null);

            if (pipelineResult.status === 'needs_disambiguation') {
                setFlowAlert({ label: 'disambiguation required', detail: 'The local resolver found more than one likely place match, so routing stopped instead of guessing.', tone: 'warn' });
                return;
            }

            if (pipelineResult.status === 'unresolved') {
                setFlowAlert({ label: 'no route found', detail: 'The shell could not produce a valid offline route for this request.', tone: 'bad' });
                return;
            }

            if (runtimeState.source === 'fixture-fallback') {
                setFlowAlert({ label: 'fixture fallback active', detail: runtimeState.reasons.join(' '), tone: 'warn' });
            }

            clearStagedDestination();
        } catch (error) {
            setFlowAlert(mapPipelineError(error));
        }
    };

    const playVoice = async () => {
        if (!preferences.voiceEnabled) {
            setFlowAlert({ label: 'voice guidance disabled', detail: 'Enable voice guidance in Settings before requesting spoken route playback.', tone: 'warn' });
            return;
        }

        if (!voiceCapabilities?.tts) {
            setFlowAlert({ label: 'tts unavailable', detail: 'OS TTS is not available in the current shell state, so spoken playback cannot start.', tone: 'bad' });
            return;
        }

        if (!resultText) {
            setFlowAlert({ label: 'no route to speak', detail: 'Run a successful route search before asking for TTS playback.', tone: 'warn' });
            return;
        }

        try {
            await Tts.speak(resultText);
        } catch (error) {
            setFlowAlert(mapPipelineError(error));
        }
    };

    const submitFeedback = (rating: 'up' | 'down') => {
        setFeedback(rating);
        enqueueFeedback({
            routeLabel: resultText ?? query,
            rating,
            note: `${transportMode} route feedback`,
        });
    };

    return (
        <ScrollView contentContainerStyle={shellStyles.screen}>
            <Text style={shellStyles.title}>GO</Text>
            <Text style={shellStyles.copy}>Plan a journey with text or voice hooks, inspect route output, and send post-journey feedback into the offline queue.</Text>
            <SystemAlertsCard />
            {stagedDestination ? (
                <SectionCard>
                    <View style={styles.rowBetween}>
                        <Text style={styles.sectionTitle}>Navigate-here handoff</Text>
                        <StatusChip label="ready from Maps" tone="good" />
                    </View>
                    <Text style={shellStyles.copy}>{stagedDestination} is staged from Maps and will be used in the next route request.</Text>
                    <Pressable onPress={clearStagedDestination} style={styles.secondaryButton}>
                        <Text style={styles.secondaryButtonText}>Clear staged destination</Text>
                    </Pressable>
                </SectionCard>
            ) : null}
            <SectionCard>
                <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>Live map status</Text>
                    <StatusChip label={statusTone.label} tone={statusTone.tone} />
                </View>
                <View style={styles.blueDotCard}>
                    <View style={styles.blueDot} />
                    <Text style={shellStyles.copy}>{permissions.gps ? 'Blue dot is ready for surface navigation.' : 'GPS permission is off, so the shell is using an underground-safe last known location state.'}</Text>
                </View>
                <Text style={shellStyles.copy}>{assetDiagnostics.cacheState === 'offline-with-cache' ? 'Offline with cache is available for degraded guidance.' : 'Offline without cache means route search must wait for successful downloads.'}</Text>
                <Text style={shellStyles.copy}>{modelStatus?.loaded ? 'Native model path is loaded.' : 'Model loading remains pending, so this shell may fall back to fixture-safe adapters.'}</Text>
                <Text style={shellStyles.copy}>Pipeline source: {runtimeState.source}. Entities: {runtimeState.entitySource}. POIs: {runtimeState.poiSource}.</Text>
            </SectionCard>
            <SectionCard>
                <Text style={styles.sectionTitle}>Search</Text>
                <TextInput value={query} onChangeText={setQuery} style={styles.input} placeholder="Enter a route or place query" placeholderTextColor="#7c8a85" />
                <View style={styles.transportRow}>
                    {transportModes.map((mode) => (
                        <Pressable key={mode} onPress={() => setTransportMode(mode)} style={[styles.transportPill, transportMode === mode ? styles.transportPillActive : null]}>
                            <Text style={transportMode === mode ? styles.transportTextActive : styles.transportText}>{mode}</Text>
                        </Pressable>
                    ))}
                </View>
                <View style={styles.buttonRow}>
                    <Pressable onPress={() => void runQuery()} style={styles.primaryButton}>
                        <Text style={styles.primaryButtonText}>Run search</Text>
                    </Pressable>
                    <Pressable onPress={() => void playVoice()} style={styles.secondaryButton}>
                        <Text style={styles.secondaryButtonText}>Play TTS</Text>
                    </Pressable>
                </View>
                <Text style={shellStyles.copy}>Voice search hook is represented by OS STT capability in Settings; text search routes through the mobile pipeline adapter here.</Text>
            </SectionCard>
            {flowAlert ? (
                <SectionCard>
                    <StatusChip label={flowAlert.label} tone={flowAlert.tone} />
                    <Text style={shellStyles.copy}>{flowAlert.detail}</Text>
                </SectionCard>
            ) : null}
            {result?.status === 'needs_disambiguation' ? (
                <SectionCard>
                    <Text style={styles.sectionTitle}>Disambiguation</Text>
                    {(result.origin?.candidates ?? result.destination?.candidates ?? []).map((candidate) => (
                        <Text key={candidate.entity.id} style={shellStyles.copy}>Candidate: {candidate.entity.canonicalName}</Text>
                    ))}
                </SectionCard>
            ) : null}
            {result ? <RouteCard result={result} /> : null}
            {result ? (
                <SectionCard>
                    <Text style={styles.sectionTitle}>Post-journey feedback</Text>
                    <View style={styles.buttonRow}>
                        <Pressable onPress={() => submitFeedback('up')} style={styles.secondaryButton}>
                            <Text style={styles.secondaryButtonText}>Helpful</Text>
                        </Pressable>
                        <Pressable onPress={() => submitFeedback('down')} style={styles.secondaryButton}>
                            <Text style={styles.secondaryButtonText}>Needs work</Text>
                        </Pressable>
                    </View>
                    <Text style={shellStyles.copy}>{feedback ? `Queued ${feedback} feedback for offline upload.` : 'Feedback stays on device until later sync handling is added.'}</Text>
                </SectionCard>
            ) : null}
            <DownloadScreen />
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
    blueDotCard: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
    },
    blueDot: {
        backgroundColor: '#2583ff',
        borderRadius: 999,
        height: 16,
        width: 16,
    },
    input: {
        backgroundColor: '#fff',
        borderColor: colors.line,
        borderRadius: 14,
        borderWidth: 1,
        color: colors.ink,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    transportRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    transportPill: {
        backgroundColor: '#ece4d7',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    transportPillActive: {
        backgroundColor: colors.accent,
    },
    transportText: {
        color: colors.ink,
        fontWeight: '600',
    },
    transportTextActive: {
        color: '#fffaf1',
        fontWeight: '700',
    },
    buttonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
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
    secondaryButton: {
        backgroundColor: '#ece4d7',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    secondaryButtonText: {
        color: colors.ink,
        fontWeight: '700',
    },
});