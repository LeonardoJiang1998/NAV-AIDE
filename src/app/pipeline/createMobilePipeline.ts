import { createQueryPipelineRuntime } from '../../core/pipeline/createQueryPipelineRuntime';
import { buildWeightedGraphFromTubeAsset, deriveKnownStations } from '../../core/pipeline/TubeGraphTransforms';

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
}

export function createMobilePipeline() {
    const assetLoader = new ReactNativeOfflineAssetLoader();
    const sqliteAdapter = new ReactNativeSQLiteAdapter();
    const modelManager = new LocalModelManager();
    const deviceIdProvider = new ReactNativeDeviceIdProvider();
    const tubeGraph = assetLoader.loadTubeGraph();
    const knownStations = deriveKnownStations(tubeGraph);
    const graph = buildWeightedGraphFromTubeAsset(tubeGraph);

    const intentModel = new FallbackStructuredIntentAdapter(
        new LlamaBackedStructuredIntentAdapter(modelManager, assetLoader),
        new RuleBasedStructuredModelClient(knownStations)
    );
    const responseModel = new FallbackRenderAdapter(
        new LlamaBackedRenderAdapter(modelManager, assetLoader),
        new RuleBasedRenderClient()
    );

    const runtime = createQueryPipelineRuntime(
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
            deviceIdProvider,
        }
    );

    return {
        ...runtime,
        runtimeAdapters: {
            assetLoader,
            sqliteAdapter,
            modelManager,
            deviceIdProvider,
        },
        async probeRuntime(): Promise<MobilePipelineRuntimeProbe> {
            const assets = await assetLoader.getAssetPathReport();
            const [model, poisValidation, aliasValidation] = await Promise.all([
                modelManager.load(assets.model.resolvedPath),
                assets.poisDb.exists
                    ? sqliteAdapter.validateAsset(OFFLINE_RUNTIME_ASSET_CONTRACTS.poisDatabase, assets.poisDb.resolvedPath)
                    : Promise.resolve({ tablesPresent: [], ftsTablesPresent: [] }),
                assets.locationAliasesDb.exists
                    ? sqliteAdapter.validateAsset(OFFLINE_RUNTIME_ASSET_CONTRACTS.locationAliasesDatabase, assets.locationAliasesDb.resolvedPath)
                    : Promise.resolve({ tablesPresent: [], ftsTablesPresent: [] }),
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
            };
        },
    };
}