import { createQueryPipelineRuntime } from '../../core/pipeline/createQueryPipelineRuntime';
import { buildWeightedGraphFromTubeAsset, deriveKnownStations } from '../../core/pipeline/TubeGraphTransforms';
import type { POIRecord } from '../../core/poi/POIService';
import type { EntityRecord } from '../../core/pipeline/EntityResolver';
import type { TubeGraphAsset } from '../../core/runtime/OfflineRuntimeContracts';

import { OFFLINE_RUNTIME_ASSET_CONTRACTS } from '../../core/pipeline/OfflineAssetRegistry';
import { ReactNativeDeviceIdProvider } from '../runtime/ReactNativeDeviceIdProvider';
import { ReactNativeOfflineAssetLoader } from '../runtime/ReactNativeOfflineAssetLoader';
import { ReactNativeSQLiteAdapter } from '../storage/ReactNativeSQLiteAdapter';
import { LocalModelManager } from '../model/LocalModelManager';
import { FallbackRenderAdapter, FallbackStructuredIntentAdapter, LlamaBackedRenderAdapter, LlamaBackedStructuredIntentAdapter } from '../model/LlamaBackedAdapters';
import { disruptions, entities, pois } from './mobileFixtures';
import { RuleBasedRenderClient, RuleBasedStructuredModelClient } from './RuleBasedModelBridge';

export interface MobilePipelineRuntimeProbe {
    assets: Awaited<ReturnType<ReactNativeOfflineAssetLoader['getAssetPathReport']>>;
    model: Awaited<ReturnType<LocalModelManager['load']>>;
    sqlite: {
        pois: { reachable: boolean; tablesPresent: string[]; ftsTablesPresent: string[] };
        locationAliases: { reachable: boolean; tablesPresent: string[]; ftsTablesPresent: string[] };
    };
    disruptionSource: string;
    walkingAssetsAvailable: boolean;
}

export interface MobilePipelineRuntimeState {
    source: 'fixture-fallback' | 'sqlite-runtime';
    entitySource: 'fixture' | 'sqlite';
    poiSource: 'fixture' | 'sqlite';
    disruptionSource: string;
    walkingAssetsAvailable: boolean;
    reasons: string[];
    entityCount: number;
    poiCount: number;
    probe: MobilePipelineRuntimeProbe | null;
    initializedAt: string | null;
}

type RuntimeInstance = ReturnType<typeof createQueryPipelineRuntime>;

export interface MobilePipeline {
    readonly knownStations: RuntimeInstance['knownStations'];
    readonly entityResolver: RuntimeInstance['entityResolver'];
    readonly eventLogger: RuntimeInstance['eventLogger'];
    readonly queryPipeline: RuntimeInstance['queryPipeline'];
    readonly runtimeAdapters: {
        assetLoader: ReactNativeOfflineAssetLoader;
        sqliteAdapter: ReactNativeSQLiteAdapter;
        modelManager: LocalModelManager;
        deviceIdProvider: ReactNativeDeviceIdProvider;
    };
    readonly runtimeState: MobilePipelineRuntimeState;
    probeRuntime(): Promise<MobilePipelineRuntimeProbe>;
    initializeRuntime(): Promise<MobilePipelineRuntimeState>;
}

export function createMobilePipeline(): MobilePipeline {
    const assetLoader = new ReactNativeOfflineAssetLoader();
    const sqliteAdapter = new ReactNativeSQLiteAdapter();
    const modelManager = new LocalModelManager();
    const deviceIdProvider = new ReactNativeDeviceIdProvider();
    const tubeGraph = assetLoader.loadTubeGraph();
    const knownStations = deriveKnownStations(tubeGraph);
    const graph = buildWeightedGraphFromTubeAsset(tubeGraph);

    // Build a station-name → coordinate map for the walking router. The TfL
    // tube graph ships with lat/lon on every node; we pass these in so
    // HaversineWalkingRouter can always produce a real estimate.
    const stationCoordinates = new Map<string, { lat: number; lon: number }>();
    for (const node of tubeGraph.nodes as Array<{ name: string; lat?: number; lon?: number }>) {
        if (typeof node.lat === 'number' && typeof node.lon === 'number') {
            stationCoordinates.set(node.name, { lat: node.lat, lon: node.lon });
        }
    }

    const intentModel = new FallbackStructuredIntentAdapter(
        new LlamaBackedStructuredIntentAdapter(modelManager, assetLoader),
        new RuleBasedStructuredModelClient(knownStations)
    );
    const responseModel = new FallbackRenderAdapter(
        new LlamaBackedRenderAdapter(modelManager, assetLoader),
        new RuleBasedRenderClient()
    );

    let activeRuntime = createQueryPipelineRuntime(
        {
            intentModel,
            responseModel,
        },
        {
            knownStations,
            entities,
            pois,
            graph,
            disruptions,
            walkingAssetsAvailable: true,
            stationCoordinates,
            deviceIdProvider,
        }
    );

    let runtimeState: MobilePipelineRuntimeState = {
        source: 'fixture-fallback',
        entitySource: 'fixture',
        poiSource: 'fixture',
        disruptionSource: 'fixture-static',
        walkingAssetsAvailable: true,
        reasons: ['Runtime not initialized yet. Using fixture-backed mobile shell data.'],
        entityCount: entities.length,
        poiCount: pois.length,
        probe: null,
        initializedAt: null,
    };

    const mobilePipeline: MobilePipeline = {
        get knownStations() {
            return activeRuntime.knownStations;
        },
        get entityResolver() {
            return activeRuntime.entityResolver;
        },
        get eventLogger() {
            return activeRuntime.eventLogger;
        },
        get queryPipeline() {
            return activeRuntime.queryPipeline;
        },
        runtimeAdapters: {
            assetLoader,
            sqliteAdapter,
            modelManager,
            deviceIdProvider,
        },
        get runtimeState() {
            return runtimeState;
        },
        async probeRuntime(): Promise<MobilePipelineRuntimeProbe> {
            const assets = await assetLoader.getAssetPathReport();
            const [model, poisValidation, aliasValidation, disruptionCache, walkingInput] = await Promise.all([
                modelManager.load(assets.model.resolvedPath),
                assets.poisDb.exists
                    ? sqliteAdapter.validateAsset(OFFLINE_RUNTIME_ASSET_CONTRACTS.poisDatabase, assets.poisDb.resolvedPath)
                    : Promise.resolve({ tablesPresent: [], ftsTablesPresent: [] }),
                assets.locationAliasesDb.exists
                    ? sqliteAdapter.validateAsset(OFFLINE_RUNTIME_ASSET_CONTRACTS.locationAliasesDatabase, assets.locationAliasesDb.resolvedPath)
                    : Promise.resolve({ tablesPresent: [], ftsTablesPresent: [] }),
                assetLoader.loadDisruptionCache(),
                assetLoader.getWalkingRoutingInput(),
            ]);

            return {
                assets,
                model,
                sqlite: {
                    pois: {
                        reachable: assets.poisDb.exists,
                        tablesPresent: poisValidation.tablesPresent,
                        ftsTablesPresent: poisValidation.ftsTablesPresent,
                    },
                    locationAliases: {
                        reachable: assets.locationAliasesDb.exists,
                        tablesPresent: aliasValidation.tablesPresent,
                        ftsTablesPresent: aliasValidation.ftsTablesPresent,
                    },
                },
                disruptionSource: disruptionCache.source,
                walkingAssetsAvailable: walkingInput.assetsAvailable,
            };
        },
        async initializeRuntime(): Promise<MobilePipelineRuntimeState> {
            const probe = await mobilePipeline.probeRuntime();
            const reasons: string[] = [];

            let runtimeEntities = entities;
            let runtimePois = pois;
            let entitySource: MobilePipelineRuntimeState['entitySource'] = 'fixture';
            let poiSource: MobilePipelineRuntimeState['poiSource'] = 'fixture';

            if (probe.assets.locationAliasesDb.exists) {
                try {
                    runtimeEntities = mergeEntityRecords(
                        alignStationEntityIds(await sqliteAdapter.loadEntityRecords(probe.assets.locationAliasesDb.resolvedPath), tubeGraph),
                        entities
                    );
                    entitySource = 'sqlite';
                } catch (error) {
                    reasons.push(`Location alias SQLite load failed: ${error instanceof Error ? error.message : 'unknown error'}`);
                }
            } else {
                reasons.push('Location alias database missing on device. Falling back to fixture entities.');
            }

            if (probe.assets.poisDb.exists) {
                try {
                    runtimePois = mergePoiRecords(await sqliteAdapter.loadPois(probe.assets.poisDb.resolvedPath), pois);
                    poiSource = 'sqlite';
                } catch (error) {
                    reasons.push(`POI SQLite load failed: ${error instanceof Error ? error.message : 'unknown error'}`);
                }
            } else {
                reasons.push('POI database missing on device. Falling back to fixture POIs.');
            }

            const disruptionCache = await assetLoader.loadDisruptionCache();
            const walkingInput = await assetLoader.getWalkingRoutingInput();

            activeRuntime = createQueryPipelineRuntime(
                {
                    intentModel,
                    responseModel,
                },
                {
                    knownStations,
                    entities: runtimeEntities,
                    pois: runtimePois,
                    graph,
                    disruptions: disruptionCache.events,
                    walkingAssetsAvailable: walkingInput.assetsAvailable,
                    stationCoordinates,
                    deviceIdProvider,
                }
            );

            runtimeState = {
                source: entitySource === 'sqlite' && poiSource === 'sqlite' ? 'sqlite-runtime' : 'fixture-fallback',
                entitySource,
                poiSource,
                disruptionSource: disruptionCache.source,
                walkingAssetsAvailable: walkingInput.assetsAvailable,
                reasons: reasons.length > 0 ? reasons : ['SQLite-backed runtime is active for entity resolution and POI lookup.'],
                entityCount: runtimeEntities.length,
                poiCount: runtimePois.length,
                probe,
                initializedAt: new Date().toISOString(),
            };

            return runtimeState;
        },
    };

    return mobilePipeline;
}

function alignStationEntityIds(records: EntityRecord[], asset: TubeGraphAsset): EntityRecord[] {
    const stationIdsByName = new Map(asset.nodes.map((node) => [normalizeKey(node.name), node.id]));

    return records.map((record) => {
        if (record.type !== 'station') {
            return record;
        }

        return {
            ...record,
            id: stationIdsByName.get(normalizeKey(record.canonicalName)) ?? record.id,
        };
    });
}

function mergeEntityRecords(primary: EntityRecord[], fallback: EntityRecord[]): EntityRecord[] {
    const merged = new Map<string, EntityRecord>();

    for (const record of [...primary, ...fallback]) {
        const key = `${record.type}:${normalizeKey(record.canonicalName)}`;
        const current = merged.get(key);

        if (!current) {
            merged.set(key, { ...record, aliases: [...record.aliases] });
            continue;
        }

        merged.set(key, {
            ...current,
            id: current.id.startsWith('station-') && !record.id.startsWith('station-') ? record.id : current.id,
            aliases: [...new Set([...current.aliases, ...record.aliases])],
        });
    }

    return [...merged.values()];
}

function mergePoiRecords(primary: POIRecord[], fallback: POIRecord[]): POIRecord[] {
    const merged = new Map<string, POIRecord>();

    for (const poi of [...primary, ...fallback]) {
        const key = normalizeKey(poi.canonicalName);
        const current = merged.get(key);

        if (!current) {
            merged.set(key, { ...poi, aliases: [...poi.aliases] });
            continue;
        }

        merged.set(key, {
            ...current,
            aliases: [...new Set([...current.aliases, ...poi.aliases])],
        });
    }

    return [...merged.values()];
}

function normalizeKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}