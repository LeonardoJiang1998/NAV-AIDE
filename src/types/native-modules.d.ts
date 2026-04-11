declare module '@maplibre/maplibre-react-native' {
    const MapLibreGL: any;
    export default MapLibreGL;
}

declare module '@react-native-voice/voice' {
    const Voice: any;
    export default Voice;
}

declare module 'react-native-tts' {
    const Tts: any;
    export default Tts;
}

declare module 'react-native-sqlite-storage' {
    const SQLite: any;
    export default SQLite;
}

declare module 'react-native-fs' {
    const RNFS: any;
    export default RNFS;
}

declare module 'llama.rn' {
    const llama: any;
    export function initLlama(options: any, onProgress?: (progress: number) => void): Promise<any>;
    export function loadLlamaModelInfo(path: string): Promise<any>;
    export default llama;
}