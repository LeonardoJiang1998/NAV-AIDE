import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';

export class VoiceServices {
    public async getCapabilities(): Promise<{ stt: boolean; tts: boolean }> {
        void Voice;
        void Tts;
        return {
            stt: true,
            tts: true,
        };
    }
}