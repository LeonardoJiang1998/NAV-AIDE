import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CollapsibleCard } from '../components/CollapsibleCard';
import { SectionCard } from '../components/SectionCard';
import { StatusChip } from '../components/StatusChip';
import { SystemAlertsCard } from '../components/SystemAlertsCard';
import { useAppShell } from '../state/AppShellContext';
import { colors } from '../theme';
import { useSpeechToText } from '../voice/useSpeechToText';
import { shellStyles } from './shared';

interface FlowAlert {
    label: string;
    detail: string;
    tone: 'neutral' | 'good' | 'warn' | 'bad';
}

function mapPipelineError(error: unknown): FlowAlert {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    if (/hallucinated/i.test(message)) {
        return { label: 'hallucinated place', detail: 'The response referenced a place not in our local index.', tone: 'bad' };
    }
    if (/json|parse/i.test(message)) {
        return { label: 'invalid response', detail: 'The model returned malformed JSON; try again.', tone: 'bad' };
    }
    return { label: 'error', detail: message, tone: 'bad' };
}

export function LostScreen(): React.JSX.Element {
    const { mobilePipeline, permissions, voiceCapabilities } = useAppShell();
    const [signpostText, setSignpostText] = useState('');
    const [askPeopleText, setAskPeopleText] = useState('');
    const [signpostResult, setSignpostResult] = useState<ReturnType<typeof mobilePipeline.entityResolver.resolve> | null>(null);
    const [askPeopleResult, setAskPeopleResult] = useState<Awaited<ReturnType<typeof mobilePipeline.queryPipeline.execute>> | null>(null);
    const [flowAlert, setFlowAlert] = useState<FlowAlert | null>(null);
    const stt = useSpeechToText();

    useEffect(() => {
        if (stt.transcript) setAskPeopleText(stt.transcript);
    }, [stt.transcript]);

    useEffect(() => {
        if (stt.error) setFlowAlert({ label: 'speech error', detail: stt.error, tone: 'bad' });
    }, [stt.error]);

    const toggleSpeakButton = async () => {
        if (!permissions.microphone || !voiceCapabilities?.stt) {
            setFlowAlert({
                label: 'voice input unavailable',
                detail: 'Voice input needs microphone permission (iOS Settings > NavAideShell).',
                tone: 'bad',
            });
            return;
        }
        if (stt.isListening) await stt.stop();
        else await stt.start();
    };

    const resolveSignpost = () => {
        setFlowAlert(null);
        const trimmed = signpostText.trim();
        if (!trimmed) {
            setFlowAlert({ label: 'empty input', detail: 'Type the station name you can see on the signpost.', tone: 'warn' });
            return;
        }
        const resolution = mobilePipeline.entityResolver.resolve(trimmed);
        setSignpostResult(resolution);
        if (resolution.status === 'unresolved') {
            setFlowAlert({
                label: 'no match',
                detail: 'We could not find that station in our offline index. Double-check the spelling.',
                tone: 'bad',
            });
        } else if (resolution.status === 'disambiguation') {
            setFlowAlert({
                label: 'multiple matches',
                detail: 'Pick the closest candidate from the list.',
                tone: 'warn',
            });
        }
    };

    const askPeople = async () => {
        setFlowAlert(null);
        const trimmed = askPeopleText.trim();
        if (!trimmed) {
            setFlowAlert({ label: 'empty input', detail: 'Describe what you heard, or tap "Speak" to record.', tone: 'warn' });
            return;
        }
        try {
            const result = await mobilePipeline.queryPipeline.execute(trimmed, mobilePipeline.knownStations);
            setAskPeopleResult(result);
            if (result.status === 'unresolved') {
                setFlowAlert({ label: 'not understood', detail: 'Try a clearer phrase like "I am near Bank station".', tone: 'bad' });
            } else if (result.status === 'needs_disambiguation') {
                setFlowAlert({ label: 'more than one match', detail: 'Tap the right one below.', tone: 'warn' });
            }
        } catch (error) {
            setFlowAlert(mapPipelineError(error));
        }
    };

    return (
        <ScrollView contentContainerStyle={shellStyles.screen} keyboardShouldPersistTaps="handled">
            <View>
                <Text style={shellStyles.title}>LOST?</Text>
                <Text style={[shellStyles.copy, styles.heroCopy]}>
                    Two safe ways to reorient yourself: read a station sign, or ask a passerby.
                </Text>
            </View>

            {/* Signpost flow */}
            <SectionCard>
                <Text style={styles.sectionTitle}>1. Read a signpost</Text>
                <Text style={shellStyles.copy}>Type what you see on the nearest station sign.</Text>
                <TextInput
                    value={signpostText}
                    onChangeText={setSignpostText}
                    style={styles.input}
                    placeholder="e.g. Green Park"
                    placeholderTextColor="#7c8a85"
                    accessibilityLabel="Station signpost"
                />
                <View style={styles.exampleRow}>
                    <Pressable onPress={() => setSignpostText('Green Park')} style={styles.chipButton}>
                        <Text style={styles.chipText}>Try "Green Park"</Text>
                    </Pressable>
                    <Pressable onPress={() => setSignpostText('Park')} style={styles.chipButton}>
                        <Text style={styles.chipText}>Try "Park"</Text>
                    </Pressable>
                </View>
                <Pressable onPress={resolveSignpost} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Find it on the network</Text>
                </Pressable>
                {signpostResult ? (
                    <View style={styles.resultBlock}>
                        <StatusChip
                            label={signpostResult.status}
                            tone={
                                signpostResult.status === 'resolved'
                                    ? 'good'
                                    : signpostResult.status === 'disambiguation'
                                        ? 'warn'
                                        : 'bad'
                            }
                        />
                        {signpostResult.bestCandidate ? (
                            <Text style={styles.bigResult}>
                                {signpostResult.bestCandidate.entity.canonicalName}
                            </Text>
                        ) : (
                            <Text style={shellStyles.copy}>Not in the offline index.</Text>
                        )}
                        {signpostResult.status === 'disambiguation'
                            ? signpostResult.candidates.map((candidate) => (
                                <Pressable
                                    key={candidate.entity.id}
                                    onPress={() => setSignpostText(candidate.entity.canonicalName)}
                                    style={styles.candidatePill}
                                >
                                    <Text style={styles.candidateText}>{candidate.entity.canonicalName}</Text>
                                </Pressable>
                            ))
                            : null}
                    </View>
                ) : null}
            </SectionCard>

            {/* Ask People flow */}
            <SectionCard>
                <Text style={styles.sectionTitle}>2. Ask a passer-by</Text>
                <Text style={shellStyles.copy}>
                    Tap "Speak", listen to what they tell you, then let us ground it against the real network.
                </Text>
                <TextInput
                    value={askPeopleText}
                    onChangeText={setAskPeopleText}
                    style={styles.input}
                    placeholder="Paste or speak what they said"
                    placeholderTextColor="#7c8a85"
                    multiline
                    accessibilityLabel="What they told you"
                />
                <View style={styles.exampleRow}>
                    <Pressable
                        onPress={() => void toggleSpeakButton()}
                        style={[styles.chipButton, stt.isListening ? styles.chipButtonActive : null]}
                    >
                        <Text style={stt.isListening ? styles.chipTextActive : styles.chipText}>
                            {stt.isListening ? '● Listening' : '🎤 Speak'}
                        </Text>
                    </Pressable>
                    <Pressable onPress={() => setAskPeopleText('I am near Green Park')} style={styles.chipButton}>
                        <Text style={styles.chipText}>Clear example</Text>
                    </Pressable>
                    <Pressable onPress={() => setAskPeopleText('Take me to Park')} style={styles.chipButton}>
                        <Text style={styles.chipText}>Ambiguous example</Text>
                    </Pressable>
                </View>
                {stt.partialTranscript ? (
                    <Text style={styles.hearing}>Hearing: “{stt.partialTranscript}”</Text>
                ) : null}
                <Pressable onPress={() => void askPeople()} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Make sense of it</Text>
                </Pressable>
                {askPeopleResult ? (
                    <View style={styles.resultBlock}>
                        <StatusChip
                            label={askPeopleResult.status.replace('_', ' ')}
                            tone={
                                askPeopleResult.status === 'complete'
                                    ? 'good'
                                    : askPeopleResult.status === 'needs_disambiguation'
                                        ? 'warn'
                                        : 'bad'
                            }
                        />
                        {askPeopleResult.rendered?.text ? (
                            <Text style={styles.bigResult}>{askPeopleResult.rendered.text}</Text>
                        ) : null}
                        {(askPeopleResult.origin?.status === 'disambiguation'
                            ? askPeopleResult.origin.candidates
                            : askPeopleResult.destination?.candidates ?? [])
                            .map((candidate) => (
                                <Pressable
                                    key={candidate.entity.id}
                                    onPress={() => setAskPeopleText(`I am near ${candidate.entity.canonicalName}`)}
                                    style={styles.candidatePill}
                                >
                                    <Text style={styles.candidateText}>{candidate.entity.canonicalName}</Text>
                                </Pressable>
                            ))}
                    </View>
                ) : null}
            </SectionCard>

            {flowAlert ? (
                <SectionCard style={styles.alertCard}>
                    <StatusChip label={flowAlert.label} tone={flowAlert.tone} />
                    <Text style={shellStyles.copy}>{flowAlert.detail}</Text>
                </SectionCard>
            ) : null}

            <CollapsibleCard title="Diagnostics">
                <SystemAlertsCard />
            </CollapsibleCard>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    heroCopy: {
        color: colors.inkMuted,
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
        minHeight: 48,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    exampleRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chipButton: {
        backgroundColor: colors.paperSunken,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    chipButtonActive: {
        backgroundColor: colors.danger,
        borderColor: colors.danger,
    },
    chipText: {
        color: colors.ink,
        fontSize: 12,
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#fffaf1',
        fontSize: 12,
        fontWeight: '700',
    },
    hearing: {
        color: colors.inkMuted,
        fontSize: 13,
        fontStyle: 'italic',
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
    resultBlock: {
        backgroundColor: colors.paperSunken,
        borderRadius: 14,
        gap: 8,
        marginTop: 4,
        padding: 12,
    },
    bigResult: {
        color: colors.ink,
        fontSize: 16,
        fontWeight: '700',
    },
    candidatePill: {
        alignSelf: 'flex-start',
        backgroundColor: colors.paperRaised,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    candidateText: {
        color: colors.ink,
        fontSize: 13,
        fontWeight: '600',
    },
    alertCard: {
        gap: 8,
    },
});
