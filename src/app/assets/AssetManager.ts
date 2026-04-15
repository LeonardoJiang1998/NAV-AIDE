import type { ManifestCheckResult } from './ManifestChecker';
import { assetManifest, type OfflineAssetManifestEntry } from './assetManifest';
import type { RuntimeAssetPathReport } from '../runtime/ReactNativeOfflineAssetLoader';

export interface AssetStatus {
    ready: boolean;
    checks: ManifestCheckResult[];
    resolvedPaths: RuntimeAssetPathReport;
}

export interface AssetLoaderLike {
    getAssetPathReport(): Promise<RuntimeAssetPathReport>;
}

export interface HashingFileSystemLike {
    hash(path: string, algorithm: string): Promise<string>;
}

export class AssetManager {
    public constructor(
        private readonly loader: AssetLoaderLike,
        private readonly fileSystem: HashingFileSystemLike,
        private readonly manifest: OfflineAssetManifestEntry[] = assetManifest,
    ) { }

    public async getStatus(): Promise<AssetStatus> {
        const resolvedPaths = await this.loader.getAssetPathReport();
        const checks = await Promise.all(this.manifest.map(async (entry) => {
            const resolution = this.findResolution(entry.key, resolvedPaths);
            const exists = resolution?.exists ?? false;
            const checksumMatches = exists && resolution
                ? (await this.fileSystem.hash(resolution.resolvedPath, 'sha256')) === entry.checksum
                : Boolean(entry.optional);

            return {
                key: entry.key,
                exists,
                checksumMatches,
            } satisfies ManifestCheckResult;
        }));

        return {
            ready: isManifestReady(this.manifest, checks),
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

export function isManifestReady(
    manifest: OfflineAssetManifestEntry[],
    checks: ManifestCheckResult[],
): boolean {
    const checksByKey = new Map(checks.map((check) => [check.key, check]));

    return manifest.every((entry) => {
        if (entry.optional) {
            return true;
        }

        const check = checksByKey.get(entry.key);
        return Boolean(check?.exists && check.checksumMatches);
    });
}
