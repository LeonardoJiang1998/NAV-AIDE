import { useCallback, useEffect, useRef, useState } from 'react';
import Voice from '@react-native-voice/voice';

export interface UseSpeechToTextResult {
    isListening: boolean;
    transcript: string;
    partialTranscript: string;
    error: string | null;
    start: () => Promise<void>;
    stop: () => Promise<void>;
    cancel: () => Promise<void>;
}

export function useSpeechToText(locale = 'en-GB'): UseSpeechToTextResult {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [partialTranscript, setPartialTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        Voice.onSpeechStart = () => {
            if (mounted.current) {
                setIsListening(true);
                setError(null);
            }
        };

        Voice.onSpeechEnd = () => {
            if (mounted.current) {
                setIsListening(false);
            }
        };

        Voice.onSpeechResults = (event: { value?: string[] }) => {
            if (mounted.current && event.value && event.value.length > 0) {
                setTranscript(event.value[0]);
                setPartialTranscript('');
            }
        };

        Voice.onSpeechPartialResults = (event: { value?: string[] }) => {
            if (mounted.current && event.value && event.value.length > 0) {
                setPartialTranscript(event.value[0]);
            }
        };

        Voice.onSpeechError = (event: { error?: { message?: string } }) => {
            if (mounted.current) {
                setIsListening(false);
                setError(event.error?.message ?? 'Speech recognition failed.');
            }
        };

        return () => {
            mounted.current = false;
            Voice.destroy().then(() => Voice.removeAllListeners());
        };
    }, []);

    const start = useCallback(async () => {
        setError(null);
        setPartialTranscript('');
        try {
            await Voice.start(locale);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to start speech recognition.');
        }
    }, [locale]);

    const stop = useCallback(async () => {
        try {
            await Voice.stop();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to stop speech recognition.');
        }
    }, []);

    const cancel = useCallback(async () => {
        try {
            await Voice.cancel();
            setIsListening(false);
            setPartialTranscript('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to cancel speech recognition.');
        }
    }, []);

    return { isListening, transcript, partialTranscript, error, start, stop, cancel };
}
