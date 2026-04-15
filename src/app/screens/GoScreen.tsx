import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Tts from 'react-native-tts';

import { CollapsibleCard } from '../components/CollapsibleCard';
import { RouteCard } from '../components/RouteCard';
import { SectionCard } from '../components/SectionCard';
import { StationSuggestions } from '../components/StationSuggestions';
import { StatusChip } from '../components/StatusChip';
import { SystemAlertsCard } from '../components/SystemAlertsCard';
import { DownloadScreen } from '../download/DownloadScreen';
import { useAppShell } from '../state/AppShellContext';
import { colors } from '../theme';
import { useSpeechToText } from '../voice/useSpeechToText';
import { shellStyles } from './shared';

const QUICK_QUERIES = [
    'Waterloo to Baker Street',
    'Heathrow T5 to Canary Wharf',
    'Take me to the British Museum',
    'Stratford to Wimbledon',
    "Where is Hampstead?",
];

interface FlowAlert {
    label: string;
    detail: string;
    tone: 'neutral' | 'good' | 'warn' | 'bad';
}

function mapPipelineError(error: unknown): FlowAlert {
    const message = error instanceof Error ? error.message : 'Unknown pipeline failure.';
    if (/hallucinated/i.test(message)) {
        return {
            label: 'hallucinated locations',
            detail: 'The model referenced a place not in our local index, so the response was rejected. Try the exact station name.',
            tone: 'bad',
        };
    }
    if (/json|parse/i.test(message)) {
        return {
            label: 'invalid JSON from LLM',
            detail: 'The model returned malformed JSON. This is usually transient; try again.',
            tone: 'bad',
        };
    }
    return { label: 'query error', detail: message, tone: 'bad' };
}

/**
 * When the user taps a suggested station, update the query in-place so the
 * natural-language prompt stays grammatical.
 */
function rewriteQueryWithStation(query: string, station: string): string {
    const trimmed = query.trim();
    if (!trimmed) return station;
    const toMatch = trimmed.match(/(.*\bto\s+)([^?\n]+?)(\??)$/i);
    if (toMatch) return `${toMatch[1]}${station}${toMatch[3]}`;
    const fromMatch = trimmed.match(/(.*\bfrom\s+)([^?\n]+?)(\s+to\s+.*|$)/i);
    if (fromMatch) return `${fromMatch[1]}${station}${fromMatch[3]}`;
    return `${trimmed}${/\s$/.test(trimmed) ? '' : ' '}${station}`;
}

export function GoScreen(): React.JSX.Element {
    const {
        demoReadiness,
        modelStatus,
        permissions,
        preferences,
        runtimeState,
        voiceCapabilities,
        stagedDestination,
        clearStagedDestination,
        enqueueFeedback,
        mobilePipeline,
        setLastRoute,
    } = useAppShell();

    const [query, setQuery] = useState('Waterloo to Baker Street');
    const [isLoading, setIsLoading] = useState(false);
    const [resultText, setResultText] = useState<string | null>(null);
    const [result, setResult] = useState<Awaited<ReturnType<typeof mobilePipeline.queryPipeline.execute>> | null>(null);
    const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
    const [flowAlert, setFlowAlert] = useState<FlowAlert | null>(null);
    const stt = useSpeechToText();

    useEffect(() => {
        if (stt.transcript) setQuery(stt.transcript);
    }, [stt.transcript]);

    useEffect(() => {
        if (stt.error) setFlowAlert({ label: 'speech error', detail: stt.error, tone: 'bad' });
    }, [stt.error]);

    useEffect(() => {
        if (stagedDestination) {
            setQuery(`Take me to ${stagedDestination}`);
        }
    }, [stagedDestination]);

    const headerChip = useMemo(() => {
        if (!demoReadiness.readyForInternalDemo) {
            return { label: 'fallback mode', tone: 'warn' as const };
        }
        if (!modelStatus?.loaded) {
            return { label: 'rule-based', tone: 'warn' as const };
        }
        return { label: 'ready', tone: 'good' as const };
    }, [demoReadiness.readyForInternalDemo, modelStatus?.loaded]);

    const toggleVoiceSearch = async () => {
        if (!voiceCapabilities?.stt || !permissions.microphone) {
            setFlowAlert({
                label: 'voice input unavailable',
                detail: 'Voice search needs microphone permission. You can grant it from iOS Settings > NavAideShell.',
                tone: 'bad',
            });
            return;
        }
        if (stt.isListening) await stt.stop();
        else await stt.start();
    };

    const runQuery = async () => {
        setFlowAlert(null);
        setIsLoading(true);
        try {
            const pipelineResult = await mobilePipeline.queryPipeline.execute(query, mobilePipeline.knownStations);
            setResult(pipelineResult);
            setResultText(pipelineResult.rendered?.text ?? null);

            if (pipelineResult.status === 'needs_disambiguation') {
                setFlowAlert({
                    label: 'pick a station',
                    detail: 'More than one place matched — pick from the candidates below.',
                    tone: 'warn',
                });
            } else if (pipelineResult.status === 'unresolved') {
                setFlowAlert({
                    label: 'no route found',
                    detail:
                        'We could not find a tube route for this query. Try "<station> to <station>" or ask about a tourist landmark like "Take me to the British Museum".',
                    tone: 'bad',
                });
            }

            if (
                pipelineResult.route &&
                pipelineResult.origin?.bestCandidate &&
                pipelineResult.destination?.bestCandidate
            ) {
                setLastRoute({
                    path: pipelineResult.route.path,
                    originName: pipelineResult.origin.bestCandidate.entity.canonicalName,
                    destinationName: pipelineResult.destination.bestCandidate.entity.canonicalName,
                    cost: pipelineResult.route.cost,
                });
            }

            clearStagedDestination();
        } catch (error) {
            setFlowAlert(mapPipelineError(error));
        } finally {
            setIsLoading(false);
        }
    };

    const playVoice = async () => {
        if (!preferences.voiceEnabled) {
            setFlowAlert({
                label: 'voice guidance off',
                detail: 'Enable voice guidance in Settings to hear spoken directions.',
                tone: 'warn',
            });
            return;
        }
        if (!voiceCapabilities?.tts) {
            setFlowAlert({
                label: 'tts unavailable',
                detail: 'OS text-to-speech is not available on this device.',
                tone: 'bad',
            });
            return;
        }
        if (!resultText) {
            setFlowAlert({ label: 'run a search first', detail: 'Run a search before playing spoken directions.', tone: 'warn' });
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
        enqueueFeedback({ routeLabel: resultText ?? query, rating, note: 'route feedback' });
    };

    return (
        <ScrollView contentContainerStyle={shellStyles.screen} keyboardShouldPersistTaps="handled">
            {/* Hero header */}
            <View style={styles.hero}>
                <View style={styles.heroHeader}>
                    <Text style={shellStyles.title}>GO</Text>
                    <StatusChip label={headerChip.label} tone={headerChip.tone} />
                </View>
                <Text style={[shellStyles.copy, styles.heroCopy]}>
                    Ask where you want to go. Everything runs on-device.
                </Text>
            </View>

            {/* Search hero */}
            <SectionCard style={styles.searchCard}>
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    style={styles.input}
                    placeholder="e.g. Waterloo to Baker Street"
                    placeholderTextColor="#7c8a85"
                    multiline
                    accessibilityLabel="Journey query"
                    returnKeyType="search"
                />

                <StationSuggestions
                    stations={mobilePipeline.knownStations}
                    query={query}
                    onPick={(station) => setQuery((current) => rewriteQueryWithStation(current, station))}
                />

                <View style={styles.buttonRow}>
                    <Pressable
                        onPress={() => void runQuery()}
                        disabled={isLoading}
                        style={[styles.primaryButton, isLoading ? styles.buttonDisabled : null]}
                    >
                        <Text style={styles.primaryButtonText}>{isLoading ? 'Routing…' : 'Search'}</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => void toggleVoiceSearch()}
                        style={[styles.iconButton, stt.isListening ? styles.iconButtonActive : null]}
                        accessibilityLabel={stt.isListening ? 'Stop voice input' : 'Voice input'}
                    >
                        <Text style={stt.isListening ? styles.iconButtonTextActive : styles.iconButtonText}>
                            {stt.isListening ? '● Listening' : '🎤 Voice'}
                        </Text>
                    </Pressable>
                    {resultText ? (
                        <Pressable onPress={() => void playVoice()} style={styles.iconButton}>
                            <Text style={styles.iconButtonText}>🔊 Speak</Text>
                        </Pressable>
                    ) : null}
                </View>

                {stt.partialTranscript ? (
                    <Text style={styles.hearing}>Hearing: “{stt.partialTranscript}”</Text>
                ) : null}
            </SectionCard>

            {/* Quick examples */}
            <View style={styles.quickRow}>
                {QUICK_QUERIES.map((preset) => (
                    <Pressable key={preset} onPress={() => setQuery(preset)} style={styles.quickPill}>
                        <Text style={styles.quickPillText}>{preset}</Text>
                    </Pressable>
                ))}
            </View>

            {/* Flow alert */}
            {flowAlert ? (
                <SectionCard style={styles.alertCard}>
                    <StatusChip label={flowAlert.label} tone={flowAlert.tone} />
                    <Text style={shellStyles.copy}>{flowAlert.detail}</Text>
                </SectionCard>
            ) : null}

            {/* Disambiguation */}
            {result?.status === 'needs_disambiguation' ? (
                <SectionCard>
                    <Text style={styles.sectionTitle}>Did you mean…</Text>
                    {(result.origin?.candidates ?? result.destination?.candidates ?? []).map((candidate) => (
                        <Pressable
                            key={candidate.entity.id}
                            onPress={() => setQuery((q) => rewriteQueryWithStation(q, candidate.entity.canonicalName))}
                            style={styles.disambiguationPill}
                        >
                            <Text style={styles.disambiguationText}>{candidate.entity.canonicalName}</Text>
                        </Pressable>
                    ))}
                </SectionCard>
            ) : null}

            {/* Primary result */}
            {result ? <RouteCard result={result} /> : null}

            {/* Feedback (only after a result) */}
            {result ? (
                <SectionCard style={styles.feedbackCard}>
                    <Text style={styles.feedbackTitle}>Was this helpful?</Text>
                    <View style={styles.feedbackRow}>
                        <Pressable
                            onPress={() => submitFeedback('up')}
                            style={[styles.feedbackButton, feedback === 'up' ? styles.feedbackButtonActive : null]}
                        >
                            <Text style={styles.feedbackText}>👍 Yes</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => submitFeedback('down')}
                            style={[styles.feedbackButton, feedback === 'down' ? styles.feedbackButtonActive : null]}
                        >
                            <Text style={styles.feedbackText}>👎 Not really</Text>
                        </Pressable>
                    </View>
                </SectionCard>
            ) : null}

            {/* Diagnostics collapsed by default */}
            <CollapsibleCard
                title="Diagnostics"
                subtitle={`Pipeline: ${runtimeState.source} · Entities: ${runtimeState.entityCount} · POIs: ${runtimeState.poiCount}`}
            >
                <Text style={shellStyles.copy}>
                    Model: {modelStatus?.loaded ? 'loaded' : `pending (${modelStatus?.failureReason ?? 'unknown'})`}
                </Text>
                <Text style={shellStyles.copy}>
                    Permissions — GPS: {permissions.gps ? 'granted' : 'off'}. Microphone:{' '}
                    {permissions.microphone ? 'granted' : 'off'}.
                </Text>
                <Text style={shellStyles.copy}>Demo readiness: {demoReadiness.mode}</Text>
                <SystemAlertsCard />
            </CollapsibleCard>

            <CollapsibleCard title="Offline downloads" subtitle="Manage bundled + downloaded assets">
                <DownloadScreen />
            </CollapsibleCard>
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
    searchCard: {
        gap: 12,
    },
    sectionTitle: {
        color: colors.ink,
        fontSize: 16,
        fontWeight: '700',
    },
    input: {
        backgroundColor: '#fff',
        borderColor: colors.line,
        borderRadius: 14,
        borderWidth: 1,
        color: colors.ink,
        fontSize: 16,
        lineHeight: 22,
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    buttonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    primaryButton: {
        backgroundColor: colors.accent,
        borderRadius: 14,
        flexGrow: 1,
        minWidth: 120,
        paddingHorizontal: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        color: '#fffaf1',
        fontSize: 15,
        fontWeight: '700',
    },
    iconButton: {
        backgroundColor: colors.paperSunken,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    iconButtonActive: {
        backgroundColor: colors.danger,
        borderColor: colors.danger,
    },
    iconButtonText: {
        color: colors.ink,
        fontSize: 14,
        fontWeight: '700',
    },
    iconButtonTextActive: {
        color: '#fffaf1',
        fontSize: 14,
        fontWeight: '700',
    },
    hearing: {
        color: colors.inkMuted,
        fontSize: 13,
        fontStyle: 'italic',
    },
    quickRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    quickPill: {
        backgroundColor: colors.paperRaised,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    quickPillText: {
        color: colors.ink,
        fontSize: 13,
        fontWeight: '600',
    },
    alertCard: {
        gap: 8,
    },
    disambiguationPill: {
        alignSelf: 'flex-start',
        backgroundColor: colors.paperSunken,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 14,
        marginTop: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    disambiguationText: {
        color: colors.ink,
        fontSize: 14,
        fontWeight: '600',
    },
    feedbackCard: {
        gap: 8,
    },
    feedbackTitle: {
        color: colors.inkMuted,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    feedbackRow: {
        flexDirection: 'row',
        gap: 10,
    },
    feedbackButton: {
        backgroundColor: colors.paperSunken,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    feedbackButtonActive: {
        backgroundColor: colors.accentSoft,
        borderColor: colors.accent,
    },
    feedbackText: {
        color: colors.ink,
        fontSize: 13,
        fontWeight: '600',
    },
});
