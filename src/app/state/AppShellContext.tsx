import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

import { AssetManager, type AssetStatus } from '../assets/AssetManager';
import type { LocalModelStatus } from '../model/LocalModelManager';
import { createMobilePipeline, type MobilePipeline, type MobilePipelineRuntimeState } from '../pipeline/createMobilePipeline';
import { sampleDestinations } from '../pipeline/mobileFixtures';
import { ReactNativeOfflineAssetLoader } from '../runtime/ReactNativeOfflineAssetLoader';
import {
    deriveAssetDiagnostics,
    deriveDemoReadiness,
    type AssetDiagnostics,
    type DeviceDemoReadiness,
} from './readiness';
import { createPersistentStorage, type PersistentStorage } from '../storage/PersistentStorage';
import { VoiceServices, type VoiceRuntimeStatus } from '../voice/VoiceServices';

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

export interface LastRoute {
    path: string[];
    originName: string;
    destinationName: string;
    cost: number;
}

interface AppShellContextValue {
    assetStatus: AssetStatus | null;
    assetDiagnostics: AssetDiagnostics;
    modelStatus: LocalModelStatus | null;
    runtimeState: MobilePipelineRuntimeState;
    demoReadiness: DeviceDemoReadiness;
    voiceCapabilities: VoiceRuntimeStatus | null;
    preferences: PreferencesState;
    permissions: PermissionsState;
    feedbackQueue: FeedbackEntry[];
    deviceInfo: { platform: string; sampleDestinations: string[] };
    stagedDestination: string | null;
    lastRoute: LastRoute | null;
    mobilePipeline: MobilePipeline;
    refreshSystemState(): Promise<void>;
    requestDemoPermissions(): Promise<void>;
    updatePreference<K extends keyof PreferencesState>(key: K, value: PreferencesState[K]): void;
    updatePermission<K extends keyof PermissionsState>(key: K, value: PermissionsState[K]): void;
    enqueueFeedback(entry: Omit<FeedbackEntry, 'id'>): void;
    stageDestination(destination: string): void;
    clearStagedDestination(): void;
    setLastRoute(route: LastRoute | null): void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const mobilePipeline = useMemo(() => createMobilePipeline(), []);
    const voiceServices = useMemo(() => new VoiceServices(), []);
    const storage = useMemo<PersistentStorage>(() => createPersistentStorage(), []);
    const [assetStatus, setAssetStatus] = useState<AssetStatus | null>(null);
    const [modelStatus, setModelStatus] = useState<LocalModelStatus | null>(null);
    const [runtimeState, setRuntimeState] = useState<MobilePipelineRuntimeState>(mobilePipeline.runtimeState);
    const [voiceCapabilities, setVoiceCapabilities] = useState<VoiceRuntimeStatus | null>(null);
    const [preferences, setPreferences] = useState<PreferencesState>({ voiceEnabled: true, preferWalkingFirst: false });
    const [permissions, setPermissions] = useState<PermissionsState>({ gps: false, microphone: false });
    const [feedbackQueue, setFeedbackQueue] = useState<FeedbackEntry[]>([]);
    const [stagedDestination, setStagedDestination] = useState<string | null>(null);
    const [lastRoute, setLastRoute] = useState<LastRoute | null>(null);

    // DEV-only: expose the lastRoute setter so the autonomous build-loop can
    // simulate a finished search end-to-end (the GO screen owns the live
    // setter via its closure, which the loop can't reach directly).
    if (__DEV__) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__NAVAIDE_SET_LAST_ROUTE = setLastRoute;
    }

    const assetDiagnostics = useMemo<AssetDiagnostics>(
        () => deriveAssetDiagnostics(assetStatus),
        [assetStatus],
    );

    const demoReadiness = useMemo<DeviceDemoReadiness>(
        () => deriveDemoReadiness({ assetStatus, modelStatus, runtimeState, voiceCapabilities }),
        [assetStatus, modelStatus, runtimeState, voiceCapabilities],
    );

    const refreshSystemState = async () => {
        // Expose the pipeline immediately so the remote debugger can drive it
        // even if the runtime probe stalls on asset loading.
        if (__DEV__) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).__NAVAIDE_PIPELINE = mobilePipeline;
            console.log('[DEV-PROBE] pipeline exposed on globalThis.__NAVAIDE_PIPELINE');
        }

        const assetManager = new AssetManager(new ReactNativeOfflineAssetLoader(), RNFS);

        const [assets, runtimeProbe, voice] = await Promise.all([
            assetManager.getStatus(),
            mobilePipeline.initializeRuntime().catch((error) => {
                console.log(
                    '[DEV-PROBE] initializeRuntime failed:',
                    error instanceof Error ? error.message : String(error),
                );
                return mobilePipeline.runtimeState;
            }),
            voiceServices.getCapabilities(),
        ]);

        setAssetStatus(assets);
        setRuntimeState(runtimeProbe);
        const resolvedModelStatus = runtimeProbe.probe?.model ?? {
            loaded: false,
            modelPath: assets.resolvedPaths.model.resolvedPath,
            backend: 'llama.rn' as const,
            failureReason: 'Runtime probe unavailable',
        };
        setModelStatus(resolvedModelStatus);
        setVoiceCapabilities(voice);
        setPermissions((current) => ({
            gps: voice.locationPermission === 'unknown' ? current.gps : voice.locationPermission === 'granted',
            microphone: voice.microphonePermission === 'unknown'
                ? current.microphone
                : voice.microphonePermission === 'granted',
        }));

        // Opt-in auto-probe: set globalThis.__NAVAIDE_AUTO_PROBE = true via the
        // remote debugger to run a battery of test queries on mount.
        if (__DEV__ && resolvedModelStatus.loaded) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const autoProbe = Boolean((globalThis as any).__NAVAIDE_AUTO_PROBE);
            if (autoProbe) {
                const testQueries = [
                    'How do I get from Waterloo to Baker Street?',
                    'Take me to Waterloo',
                    'Find the British Museum',
                ];
                for (const text of testQueries) {
                    try {
                        const start = Date.now();
                        const result = await mobilePipeline.queryPipeline.execute(text, mobilePipeline.knownStations);
                        const elapsed = Date.now() - start;
                        console.log('[DEV-PROBE]', JSON.stringify({
                            query: text,
                            elapsedMs: elapsed,
                            status: result.status,
                            intent: result.extraction?.intent,
                            origin: result.extraction?.origin,
                            destination: result.extraction?.destination,
                            poiQuery: result.extraction?.poiQuery,
                            rendered: result.rendered?.text,
                        }));
                    } catch (error) {
                        console.log(
                            '[DEV-PROBE] Query FAILED:',
                            text,
                            '->',
                            error instanceof Error ? error.message : String(error),
                        );
                    }
                }
            }
        }
    };

    const requestDemoPermissions = async () => {
        const voice = await voiceServices.requestAndroidDemoPermissions();
        setVoiceCapabilities(voice);
        setPermissions((current) => ({
            gps: voice.locationPermission === 'unknown' ? current.gps : voice.locationPermission === 'granted',
            microphone: voice.microphonePermission === 'unknown'
                ? current.microphone
                : voice.microphonePermission === 'granted',
        }));
    };

    useEffect(() => {
        const hydrate = async () => {
            const [savedPrefs, savedPerms, savedFeedback] = await Promise.all([
                storage.read<PreferencesState>('preferences'),
                storage.read<PermissionsState>('permissions'),
                storage.read<FeedbackEntry[]>('feedbackQueue'),
            ]);
            if (savedPrefs) setPreferences(savedPrefs);
            if (savedPerms) setPermissions(savedPerms);
            if (savedFeedback) setFeedbackQueue(savedFeedback);
        };
        void hydrate();
    }, [storage]);

    useEffect(() => {
        void refreshSystemState();
    }, [mobilePipeline]);

    const value: AppShellContextValue = {
        assetStatus,
        assetDiagnostics,
        modelStatus,
        runtimeState,
        demoReadiness,
        voiceCapabilities,
        preferences,
        permissions,
        feedbackQueue,
        deviceInfo: {
            platform: Platform.OS,
            sampleDestinations,
        },
        stagedDestination,
        lastRoute,
        mobilePipeline,
        refreshSystemState,
        requestDemoPermissions,
        updatePreference(key, value) {
            setPreferences((current) => {
                const next = { ...current, [key]: value };
                void storage.write('preferences', next);
                return next;
            });
        },
        updatePermission(key, value) {
            setPermissions((current) => {
                const next = { ...current, [key]: value };
                void storage.write('permissions', next);
                return next;
            });
        },
        enqueueFeedback(entry) {
            setFeedbackQueue((current) => {
                const next = [...current, { ...entry, id: `${Date.now()}-${current.length}` }];
                void storage.write('feedbackQueue', next);
                return next;
            });
        },
        stageDestination(destination) {
            setStagedDestination(destination);
        },
        clearStagedDestination() {
            setStagedDestination(null);
        },
        setLastRoute(route) {
            setLastRoute(route);
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
