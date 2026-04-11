import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { AssetManager, type AssetStatus } from '../assets/AssetManager';
import type { LocalModelStatus } from '../model/LocalModelManager';
import { createMobilePipeline, type MobilePipeline, type MobilePipelineRuntimeState } from '../pipeline/createMobilePipeline';
import { sampleDestinations } from '../pipeline/mobileFixtures';
import { VoiceServices } from '../voice/VoiceServices';

export interface FeedbackEntry {
    id: string;
    routeLabel: string;
    rating: 'up' | 'down';
    note: string;
}

export interface PreferencesState {
    voiceEnabled: boolean;
    preferWalkingFirst: boolean;
}

export interface PermissionsState {
    gps: boolean;
    microphone: boolean;
}

export interface AssetDiagnostics {
    availableCount: number;
    missingCount: number;
    checksumMismatchCount: number;
    cacheState: 'offline-with-cache' | 'offline-without-cache';
}

interface AppShellContextValue {
    assetStatus: AssetStatus | null;
    assetDiagnostics: AssetDiagnostics;
    modelStatus: LocalModelStatus | null;
    runtimeState: MobilePipelineRuntimeState;
    voiceCapabilities: { stt: boolean; tts: boolean } | null;
    preferences: PreferencesState;
    permissions: PermissionsState;
    feedbackQueue: FeedbackEntry[];
    deviceInfo: { platform: string; sampleDestinations: string[] };
    stagedDestination: string | null;
    mobilePipeline: MobilePipeline;
    refreshSystemState(): Promise<void>;
    updatePreference<K extends keyof PreferencesState>(key: K, value: PreferencesState[K]): void;
    updatePermission<K extends keyof PermissionsState>(key: K, value: PermissionsState[K]): void;
    enqueueFeedback(entry: Omit<FeedbackEntry, 'id'>): void;
    stageDestination(destination: string): void;
    clearStagedDestination(): void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const mobilePipeline = useMemo(() => createMobilePipeline(), []);
    const [assetStatus, setAssetStatus] = useState<AssetStatus | null>(null);
    const [modelStatus, setModelStatus] = useState<LocalModelStatus | null>(null);
    const [runtimeState, setRuntimeState] = useState<MobilePipelineRuntimeState>(mobilePipeline.runtimeState);
    const [voiceCapabilities, setVoiceCapabilities] = useState<{ stt: boolean; tts: boolean } | null>(null);
    const [preferences, setPreferences] = useState<PreferencesState>({ voiceEnabled: true, preferWalkingFirst: false });
    const [permissions, setPermissions] = useState<PermissionsState>({ gps: false, microphone: true });
    const [feedbackQueue, setFeedbackQueue] = useState<FeedbackEntry[]>([]);
    const [stagedDestination, setStagedDestination] = useState<string | null>(null);
    const assetDiagnostics = useMemo<AssetDiagnostics>(() => {
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
    }, [assetStatus]);

    const refreshSystemState = async () => {
        const assetManager = new AssetManager();
        const voiceServices = new VoiceServices();

        const [assets, runtimeProbe, voice] = await Promise.all([
            assetManager.getStatus(),
            mobilePipeline.initializeRuntime().catch(() => mobilePipeline.runtimeState),
            voiceServices.getCapabilities(),
        ]);

        setAssetStatus(assets);
        setRuntimeState(runtimeProbe);
        setModelStatus(runtimeProbe.probe?.model ?? {
            loaded: false,
            modelPath: assets.resolvedPaths.model.resolvedPath,
            backend: 'llama.rn',
            failureReason: 'Runtime probe unavailable',
        });
        setVoiceCapabilities(voice);
    };

    useEffect(() => {
        void refreshSystemState();
    }, [mobilePipeline]);

    const value: AppShellContextValue = {
        assetStatus,
        assetDiagnostics,
        modelStatus,
        runtimeState,
        voiceCapabilities,
        preferences,
        permissions,
        feedbackQueue,
        deviceInfo: {
            platform: Platform.OS,
            sampleDestinations,
        },
        stagedDestination,
        mobilePipeline,
        refreshSystemState,
        updatePreference(key, value) {
            setPreferences((current) => ({ ...current, [key]: value }));
        },
        updatePermission(key, value) {
            setPermissions((current) => ({ ...current, [key]: value }));
        },
        enqueueFeedback(entry) {
            setFeedbackQueue((current) => [
                ...current,
                { ...entry, id: `${Date.now()}-${current.length}` },
            ]);
        },
        stageDestination(destination) {
            setStagedDestination(destination);
        },
        clearStagedDestination() {
            setStagedDestination(null);
        },
    };

    return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell(): AppShellContextValue {
    const context = useContext(AppShellContext);
    if (!context) {
        throw new Error('useAppShell must be used within AppShellProvider.');
    }
    return context;
}