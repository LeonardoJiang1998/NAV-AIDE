import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';
import { PermissionsAndroid, Platform } from 'react-native';

export interface VoiceRuntimeStatus {
    stt: boolean;
    tts: boolean;
    microphonePermission: 'granted' | 'denied' | 'unknown';
    locationPermission: 'granted' | 'denied' | 'unknown';
    validationMode: 'device-check' | 'scaffold';
    notes: string[];
}

export class VoiceServices {
    public async getCapabilities(): Promise<VoiceRuntimeStatus> {
        const notes: string[] = [];
        let stt = false;
        let tts = false;
        let microphonePermission: VoiceRuntimeStatus['microphonePermission'] = 'unknown';
        let locationPermission: VoiceRuntimeStatus['locationPermission'] = 'unknown';
        let validationMode: VoiceRuntimeStatus['validationMode'] = 'device-check';

        try {
            stt = typeof Voice.isAvailable === 'function' ? Boolean(await Voice.isAvailable()) : true;
        } catch (error) {
            notes.push(`STT availability check failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }

        try {
            await Tts.getInitStatus();
            tts = true;
        } catch (error) {
            notes.push(`TTS init check failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }

        if (Platform.OS === 'android') {
            microphonePermission = (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)) ? 'granted' : 'denied';
            locationPermission = (
                await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
                || await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION)
            ) ? 'granted' : 'denied';
        } else {
            validationMode = 'scaffold';
            notes.push('iOS permission state is scaffolded from Info.plist declarations; validate microphone and location prompts on a physical device.');
        }

        return {
            stt,
            tts,
            microphonePermission,
            locationPermission,
            validationMode,
            notes,
        };
    }

    public async requestAndroidDemoPermissions(): Promise<VoiceRuntimeStatus> {
        if (Platform.OS !== 'android') {
            return this.getCapabilities();
        }

        await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);

        return this.getCapabilities();
    }
}