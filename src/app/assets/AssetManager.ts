import type { ManifestCheckResult } from './ManifestChecker';
import { assetManifest } from './assetManifest';
import { ReactNativeOfflineAssetLoader, type RuntimeAssetPathReport } from '../runtime/ReactNativeOfflineAssetLoader';
import RNFS from 'react-native-fs';

export interface AssetStatus {
    ready: boolean;
    checks: ManifestCheckResult[];
    resolvedPaths: RuntimeAssetPathReport;
}

export class AssetManager {
    private readonly loader = new ReactNativeOfflineAssetLoader();

    public async getStatus(): Promise<AssetStatus> {
        const resolvedPaths = await this.loader.getAssetPathReport();
        const checks = await Promise.all(assetManifest.map(async (entry) => {
            const resolution = this.findResolution(entry.key, resolvedPaths);
            const exists = resolution?.exists ?? false;
            const checksumMatches = exists && resolution
                ? (await RNFS.hash(resolution.resolvedPath, 'sha256')) === entry.checksum
                : Boolean(entry.optional);

            return {
                key: entry.key,
                exists,
                checksumMatches,
            } satisfies ManifestCheckResult;
        }));

        return {
            ready: checks.every((check) => check.exists || check.key === 'disruption-cache'),
            checks,
            resolvedPaths,
        };
    }

    private findResolution(key: string, resolvedPaths: RuntimeAssetPathReport) {
        switch (key) {
            case 'model':
                return resolvedPaths.model;
            case 'pois-db':
                return resolvedPaths.poisDb;
            case 'location-aliases-db':
                return resolvedPaths.locationAliasesDb;
            case 'map-mbtiles':
                return resolvedPaths.mapMbtiles;
            case 'valhalla-tiles':
                return resolvedPaths.walkingRouting;
            case 'disruption-cache':
                return resolvedPaths.disruptionCache;
            default:
                return null;
        }
    }
}