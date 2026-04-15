import type { AssetStatus } from '../assets/AssetManager';
import type { LocalModelStatus } from '../model/LocalModelManager';
import type { MobilePipelineRuntimeState } from '../pipeline/createMobilePipeline';
import type { VoiceRuntimeStatus } from '../voice/VoiceServices';

export interface AssetDiagnostics {
    availableCount: number;
    missingCount: number;
    checksumMismatchCount: number;
    cacheState: 'offline-with-cache' | 'offline-without-cache';
}

export interface DeviceDemoReadiness {
    mode: 'real-asset-mode' | 'fixture-fallback-mode';
    readyForInternalDemo: boolean;
    deviceBacked: string[];
    fallback: string[];
    blockers: string[];
    warnings: string[];
}

interface DemoReadinessInput {
    assetStatus: AssetStatus | null;
    modelStatus: LocalModelStatus | null;
    runtimeState: MobilePipelineRuntimeState;
    voiceCapabilities: VoiceRuntimeStatus | null;
}

export function deriveAssetDiagnostics(assetStatus: AssetStatus | null): AssetDiagnostics {
    const checks = assetStatus?.checks ?? [];
    const availableCount = checks.filter((check) => check.exists).length;
    const missingCount = checks.filter((check) => !check.exists).length;
    const checksumMismatchCount = checks.filter((check) => check.exists && !check.checksumMatches).length;

    return {
        availableCount,
        missingCount,
        checksumMismatchCount,
        cacheState: availableCount > 0 ? 'offline-with-cache' : 'offline-without-cache',
    };
}

export function deriveDemoReadiness({
    assetStatus,
    modelStatus,
    runtimeState,
    voiceCapabilities,
}: DemoReadinessInput): DeviceDemoReadiness {
    const deviceBacked: string[] = [];
    const fallback: string[] = [];
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (modelStatus?.loaded) {
        deviceBacked.push('llama.rn loaded the local GGUF model');
    } else {
        fallback.push('Model runtime is not loaded; shell will rely on rule-based fallback adapters.');
        blockers.push('Local GGUF model is not validated on device.');
    }

    if (runtimeState.source === 'sqlite-runtime') {
        deviceBacked.push('Entity resolution and POI lookup are using device-visible SQLite assets.');
    } else {
        fallback.push('Entity resolution and POI lookup are still using fixture fallback data.');
        blockers.push('SQLite runtime mode is not active.');
    }

    applyAssetReadiness({
        key: 'map-mbtiles',
        assetStatus,
        successMessage: 'MBTiles asset is present for offline map rendering.',
        missingFallback: 'Map tab is running without a device-visible MBTiles asset.',
        invalidFallback: 'Map tab asset exists but failed checksum validation, so offline map rendering is not trusted.',
        missingBlocker: 'MBTiles asset is missing from device search paths.',
        invalidBlocker: 'MBTiles asset failed checksum validation.',
        deviceBacked,
        fallback,
        blockers,
    });

    applyAssetReadiness({
        key: 'valhalla-tiles',
        assetStatus,
        successMessage: 'Valhalla walking tiles are present.',
        missingFallback: 'Walking asset path is unresolved.',
        invalidFallback: 'Walking tiles exist but failed checksum validation, so offline walking is not trusted.',
        missingBlocker: 'Valhalla walking tiles are missing from device search paths.',
        invalidBlocker: 'Valhalla walking tiles failed checksum validation.',
        deviceBacked,
        fallback,
        blockers,
    });

    if (voiceCapabilities?.stt) {
        deviceBacked.push('OS STT runtime is available.');
    } else {
        blockers.push('OS STT runtime is unavailable.');
    }

    if (voiceCapabilities?.tts) {
        deviceBacked.push('OS TTS runtime is available.');
    } else {
        blockers.push('OS TTS runtime is unavailable.');
    }

    if (voiceCapabilities?.microphonePermission === 'denied') {
        blockers.push('Microphone permission is denied on device.');
    }

    if (voiceCapabilities?.locationPermission === 'denied') {
        warnings.push('Location permission is denied; GPS-backed states remain limited.');
    }

    for (const check of assetStatus?.checks ?? []) {
        if (check.exists && !check.checksumMatches) {
            warnings.push(`${check.key} failed checksum validation.`);
        }
    }

    warnings.push(...(runtimeState.reasons ?? []));
    warnings.push(...(voiceCapabilities?.notes ?? []));

    return {
        mode: blockers.length === 0 ? 'real-asset-mode' : 'fixture-fallback-mode',
        readyForInternalDemo: blockers.length === 0,
        deviceBacked,
        fallback,
        blockers,
        warnings: [...new Set(warnings)],
    };
}

function applyAssetReadiness({
    key,
    assetStatus,
    successMessage,
    missingFallback,
    invalidFallback,
    missingBlocker,
    invalidBlocker,
    deviceBacked,
    fallback,
    blockers,
}: {
    key: string;
    assetStatus: AssetStatus | null;
    successMessage: string;
    missingFallback: string;
    invalidFallback: string;
    missingBlocker: string;
    invalidBlocker: string;
    deviceBacked: string[];
    fallback: string[];
    blockers: string[];
}) {
    const check = assetStatus?.checks.find((entry) => entry.key === key);

    if (check?.exists && check.checksumMatches) {
        deviceBacked.push(successMessage);
        return;
    }

    if (check?.exists) {
        fallback.push(invalidFallback);
        blockers.push(invalidBlocker);
        return;
    }

    fallback.push(missingFallback);
    blockers.push(missingBlocker);
}
