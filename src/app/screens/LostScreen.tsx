import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
    const message = error instanceof Error ? error.message : 'Unknown LOST? pipeline failure.';

    if (/hallucinated/i.test(message)) {
        return { label: 'hallucinated locations', detail: 'The normalized response named a place that is not locally grounded, so the request was rejected.', tone: 'bad' };
    }

    if (/json|parse/i.test(message)) {
        return { label: 'invalid JSON from LLM', detail: 'Structured normalization failed to return valid JSON, so the Ask People flow stopped safely.', tone: 'bad' };
    }

    return { label: 'ask people error', detail: message, tone: 'bad' };
}

export function LostScreen(): React.JSX.Element {
    const { demoReadiness, mobilePipeline, permissions, runtimeState, voiceCapabilities } = useAppShell();
    const [signpostText, setSignpostText] = useState('Park');
    const [askPeopleText, setAskPeopleText] = useState('I am lost near Bank');
    const [signpostResult, setSignpostResult] = useState<ReturnType<typeof mobilePipeline.entityResolver.resolve> | null>(null);
    const [askPeopleResult, setAskPeopleResult] = useState<Awaited<ReturnType<typeof mobilePipeline.queryPipeline.execute>> | null>(null);
    const [flowAlert, setFlowAlert] = useState<FlowAlert | null>(null);
    const stt = useSpeechToText();

    useEffect(() => {
        if (stt.transcript) {
            setAskPeopleText(stt.transcript);
        }
    }, [stt.transcript]);

    useEffect(() => {
        if (stt.error) {
            setFlowAlert({ label: 'speech error', detail: stt.error, tone: 'bad' });
        }
    }, [stt.error]);

    const toggleSpeakButton = async () => {
        if (!permissions.microphone || !voiceCapabilities?.stt) {
            setFlowAlert({ label: 'stt unavailable', detail: 'OS speech input is not available because microphone permission or STT capability is missing.', tone: 'bad' });
            return;
        }

        if (stt.isListening) {
            await stt.stop();
        } else {
            await stt.start();
        }
    };

    const lowConfidenceTranscript = askPeopleText.trim().length < 10 || askPeopleText.includes('[unclear]');

    const resolveSignpost = () => {
        const resolution = mobilePipeline.entityResolver.resolve(signpostText);
        setSignpostResult(resolution);
        setFlowAlert(
            resolution.status === 'unresolved'
                ? { label: 'signpost not resolved', detail: 'The local alias and fuzzy resolver could not match that signpost to a trusted station.', tone: 'bad' }
                : resolution.status === 'disambiguation'
                    ? { label: 'disambiguation required', detail: 'The signpost text matched more than one local place, so NAV AiDE is asking for a clearer target.', tone: 'warn' }
                    : null
        );
    };

    const askPeople = async () => {
        if (!permissions.microphone || !voiceCapabilities?.stt) {
            setFlowAlert({ label: 'stt unavailable', detail: 'OS speech input is not available because microphone permission or STT capability is missing.', tone: 'bad' });
            return;
        }

        if (lowConfidenceTranscript) {
            setFlowAlert({ label: 'low-confidence STT', detail: 'The transcript looks too uncertain to normalize safely. Speak again or type a clearer phrase.', tone: 'warn' });
            return;
        }

        setFlowAlert(null);

        try {
            const result = await mobilePipeline.queryPipeline.execute(askPeopleText, mobilePipeline.knownStations);
            setAskPeopleResult(result);

            if (result.status === 'unresolved') {
                setFlowAlert({ label: 'ask people no match', detail: 'The normalized request did not produce a trusted local place match.', tone: 'bad' });
                return;
            }

            if (result.status === 'needs_disambiguation') {
                setFlowAlert({ label: 'disambiguation required', detail: 'The normalized request matched multiple local entities, so NAV AiDE is asking for a more specific place.', tone: 'warn' });
            }
        } catch (error) {
            setFlowAlert(mapPipelineError(error));
        }
    };

    return (
        <ScrollView contentContainerStyle={shellStyles.screen}>
            <Text style={shellStyles.title}>LOST?</Text>
            <Text style={shellStyles.copy}>Resolve nearby signposts directly with EntityResolver, or normalize a spoken request through the mobile query pipeline before disambiguation.</Text>
            <SystemAlertsCard />
            <SectionCard>
                <Text style={styles.sectionTitle}>Signpost flow</Text>
                <Text style={shellStyles.copy}>Runtime source: {runtimeState.source}. This flow resolves exact, alias, and disambiguation cases locally before asking for route help.</Text>
                <TextInput value={signpostText} onChangeText={setSignpostText} style={styles.input} placeholder="Type the station sign you can see" placeholderTextColor="#7c8a85" />
                <View style={styles.exampleRow}>
                    <Pressable onPress={() => setSignpostText('Green Park')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Try exact match</Text></Pressable>
                    <Pressable onPress={() => setSignpostText('Park')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Try disambiguation</Text></Pressable>
                </View>
                <Pressable onPress={resolveSignpost} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Resolve signpost</Text></Pressable>
                {signpostResult ? (
                    <>
                        <StatusChip label={signpostResult.status} tone={signpostResult.status === 'resolved' ? 'good' : signpostResult.status === 'disambiguation' ? 'warn' : 'bad'} />
                        <Text style={shellStyles.copy}>{signpostResult.bestCandidate ? `Best match: ${signpostResult.bestCandidate.entity.canonicalName}` : 'No signpost match found.'}</Text>
                        {signpostResult.status === 'disambiguation'
                            ? signpostResult.candidates.map((candidate) => (
                                <Text key={candidate.entity.id} style={shellStyles.copy}>Candidate: {candidate.entity.canonicalName}</Text>
                            ))
                            : null}
                    </>
                ) : null}
            </SectionCard>
            <SectionCard>
                <Text style={styles.sectionTitle}>Ask People flow</Text>
                <Text style={shellStyles.copy}>OS STT available: {voiceCapabilities?.stt ? 'yes' : 'no'}. Low-confidence STT stays surfaced as an explicit shell error state.</Text>
                {!voiceCapabilities?.stt ? <Text style={shellStyles.copy}>Safe demo fallback: use typed transcript examples below instead of live speech.</Text> : null}
                {demoReadiness.mode === 'fixture-fallback-mode' ? <Text style={shellStyles.copy}>Fixture fallback remains explicit in this flow so internal demos do not imply production asset coverage.</Text> : null}
                <TextInput value={askPeopleText} onChangeText={setAskPeopleText} style={styles.input} placeholder="Speech transcript (or type manually)" placeholderTextColor="#7c8a85" />
                <View style={styles.exampleRow}>
                    <Pressable onPress={() => void toggleSpeakButton()} style={stt.isListening ? styles.primaryButton : styles.secondaryButton}>
                        <Text style={stt.isListening ? styles.primaryButtonText : styles.secondaryButtonText}>{stt.isListening ? 'Stop listening' : 'Speak'}</Text>
                    </Pressable>
                    <Pressable onPress={() => setAskPeopleText('I am lost near Green Park')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Resolved example</Text></Pressable>
                    <Pressable onPress={() => setAskPeopleText('Take me to Park')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Ambiguous example</Text></Pressable>
                </View>
                {stt.isListening ? <Text style={shellStyles.copy}>Listening...</Text> : null}
                {stt.partialTranscript ? <Text style={shellStyles.copy}>Hearing: {stt.partialTranscript}</Text> : null}
                {lowConfidenceTranscript ? <StatusChip label="low-confidence STT" tone="warn" /> : null}
                <Pressable onPress={() => void askPeople()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Normalize and resolve</Text></Pressable>
                {askPeopleResult ? (
                    <>
                        <StatusChip label={askPeopleResult.status} tone={askPeopleResult.status === 'complete' ? 'good' : askPeopleResult.status === 'needs_disambiguation' ? 'warn' : 'bad'} />
                        <Text style={shellStyles.copy}>{askPeopleResult.rendered?.text ?? 'No spoken match found.'}</Text>
                        {(askPeopleResult.origin?.status === 'disambiguation' ? askPeopleResult.origin.candidates : askPeopleResult.destination?.candidates ?? []).map((candidate) => (
                            <Text key={candidate.entity.id} style={shellStyles.copy}>Candidate: {candidate.entity.canonicalName}</Text>
                        ))}
                    </>
                ) : null}
            </SectionCard>
            {flowAlert ? (
                <SectionCard>
                    <StatusChip label={flowAlert.label} tone={flowAlert.tone} />
                    <Text style={shellStyles.copy}>{flowAlert.detail}</Text>
                </SectionCard>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    sectionTitle: {
        color: colors.ink,
        fontSize: 18,
        fontWeight: '700',
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
    exampleRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
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
        backgroundColor: '#ece4d7',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    secondaryButtonText: {
        color: colors.ink,
        fontWeight: '700',
    },
});