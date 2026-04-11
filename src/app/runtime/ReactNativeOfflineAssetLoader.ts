import RNFS from 'react-native-fs';

import { OFFLINE_RUNTIME_ASSET_CONTRACTS } from '../../core/pipeline/OfflineAssetRegistry';
import type {
    BusRoutesAsset,
    DisruptionCacheInput,
    SqliteAssetContract,
    TubeGraphAsset,
    WalkingRoutingInput,
} from '../../core/runtime/OfflineRuntimeContracts';
import busRoutes from '../../../assets/busRoutes.json';
import tubeGraph from '../../../assets/tubeGraph.json';
import { disruptions as fixtureDisruptions } from '../pipeline/mobileFixtures';
import { buildResolvedAssetCandidates, type AssetPathRoots } from './AssetPathResolver';
import { DEVICE_DEMO_ASSETS, getDeviceDemoAssetDefinition, type DeviceDemoAssetKey } from './DeviceDemoAssets';

export interface AssetPathResolution {
    key: string;
    relativePath: string;
    resolvedPath: string;
    exists: boolean;
    source: 'document' | 'library' | 'cache' | 'external' | 'bundle' | 'unresolved';
    candidates: Array<{ source: 'document' | 'library' | 'cache' | 'external' | 'bundle'; path: string }>;
}

export interface RuntimeAssetPathReport {
    model: AssetPathResolution;
    mapMbtiles: AssetPathResolution;
    poisDb: AssetPathResolution;
    locationAliasesDb: AssetPathResolution;
    walkingRouting: AssetPathResolution;
    disruptionCache: AssetPathResolution;
}

export class ReactNativeOfflineAssetLoader {
    public constructor(
        private readonly roots: AssetPathRoots = {
            documentDirectoryPath: RNFS.DocumentDirectoryPath,
            libraryDirectoryPath: RNFS.LibraryDirectoryPath,
            cachesDirectoryPath: RNFS.CachesDirectoryPath,
            externalDirectoryPath: RNFS.ExternalDirectoryPath,
            mainBundlePath: RNFS.MainBundlePath,
        }
    ) { }

    public loadTubeGraph(): TubeGraphAsset {
        return tubeGraph as TubeGraphAsset;
    }

    public loadBusRoutes(): BusRoutesAsset {
        return busRoutes as BusRoutesAsset;
    }

    public async resolveModelPath(): Promise<AssetPathResolution> {
        return this.resolveRelativePath('model', 'models/gemma4-e2b.gguf');
    }

    public async resolveSqlitePath(contract: SqliteAssetContract): Promise<AssetPathResolution> {
        return this.resolveRelativePath(contract.key, contract.relativePath);
    }

    public async loadDisruptionCache(): Promise<DisruptionCacheInput> {
        const report = await this.resolveRelativePath(
            OFFLINE_RUNTIME_ASSET_CONTRACTS.disruptionCache.key,
            OFFLINE_RUNTIME_ASSET_CONTRACTS.disruptionCache.relativePath
        );

        if (report.exists) {
            const raw = await RNFS.readFile(report.resolvedPath, 'utf8');
            return JSON.parse(raw) as DisruptionCacheInput;
        }

        return {
            generatedAt: '2026-04-11T09:10:00.000Z',
            source: 'fixture-static',
            events: fixtureDisruptions,
        };
    }

    public async getWalkingRoutingInput(): Promise<WalkingRoutingInput> {
        const report = await this.resolveRelativePath(
            OFFLINE_RUNTIME_ASSET_CONTRACTS.walkingRouting.key,
            OFFLINE_RUNTIME_ASSET_CONTRACTS.walkingRouting.relativePath
        );

        return {
            provider: 'valhalla',
            profile: 'pedestrian',
            relativePath: report.resolvedPath,
            assetsAvailable: report.exists,
        };
    }

    public async getAssetPathReport(): Promise<RuntimeAssetPathReport> {
        return {
            model: await this.resolveModelPath(),
            mapMbtiles: await this.resolveRelativePath('map-mbtiles', 'maps/london.mbtiles'),
            poisDb: await this.resolveSqlitePath(OFFLINE_RUNTIME_ASSET_CONTRACTS.poisDatabase),
            locationAliasesDb: await this.resolveSqlitePath(OFFLINE_RUNTIME_ASSET_CONTRACTS.locationAliasesDatabase),
            walkingRouting: await this.resolveRelativePath(
                OFFLINE_RUNTIME_ASSET_CONTRACTS.walkingRouting.key,
                OFFLINE_RUNTIME_ASSET_CONTRACTS.walkingRouting.relativePath
            ),
            disruptionCache: await this.resolveRelativePath(
                OFFLINE_RUNTIME_ASSET_CONTRACTS.disruptionCache.key,
                OFFLINE_RUNTIME_ASSET_CONTRACTS.disruptionCache.relativePath
            ),
        };
    }

    public getPlacementGuide() {
        return DEVICE_DEMO_ASSETS.map((asset) => ({
            ...asset,
            candidates: buildResolvedAssetCandidates(asset.relativePath, this.roots),
        }));
    }

    public getResolvedPlacementGuide(report: RuntimeAssetPathReport) {
        return DEVICE_DEMO_ASSETS.map((asset) => ({
            ...asset,
            resolution: this.findResolution(report, asset.key),
        }));
    }

    private async resolveRelativePath(key: string, relativePath: string): Promise<AssetPathResolution> {
        const candidates = buildResolvedAssetCandidates(relativePath, this.roots);

        for (const candidate of candidates) {
            if (await RNFS.exists(candidate.path)) {
                return {
                    key,
                    relativePath,
                    resolvedPath: candidate.path,
                    exists: true,
                    source: candidate.source,
                    candidates,
                };
            }
        }

        const fallback = candidates[0];
        return {
            key,
            relativePath,
            resolvedPath: fallback?.path ?? relativePath,
            exists: false,
            source: 'unresolved',
            candidates,
        };
    }

    private findResolution(report: RuntimeAssetPathReport, key: DeviceDemoAssetKey): AssetPathResolution {
        switch (key) {
            case 'model':
                return report.model;
            case 'map-mbtiles':
                return report.mapMbtiles;
            case 'pois-db':
                return report.poisDb;
            case 'location-aliases-db':
                return report.locationAliasesDb;
            case 'valhalla-tiles':
                return report.walkingRouting;
            case 'disruption-cache':
                return report.disruptionCache;
            default:
                return this.resolveFromDefinition(getDeviceDemoAssetDefinition(key));
        }
    }

    private resolveFromDefinition(definition: ReturnType<typeof getDeviceDemoAssetDefinition>): AssetPathResolution {
        const candidates = buildResolvedAssetCandidates(definition.relativePath, this.roots);
        return {
            key: definition.key,
            relativePath: definition.relativePath,
            resolvedPath: candidates[0]?.path ?? definition.relativePath,
            exists: false,
            source: 'unresolved',
            candidates,
        };
    }
}