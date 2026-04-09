import type { OfflineAssetManifestEntry } from './assetManifest.js';

export interface ManifestCheckResult {
    key: string;
    exists: boolean;
    checksumMatches: boolean;
}

export interface AssetFileSystem {
    exists(path: string): Promise<boolean>;
    checksum(path: string): Promise<string>;
}

export class ManifestChecker {
    public constructor(private readonly fileSystem: AssetFileSystem) { }

    public async check(entries: OfflineAssetManifestEntry[]): Promise<ManifestCheckResult[]> {
        return Promise.all(
            entries.map(async (entry) => {
                const exists = await this.fileSystem.exists(entry.path);
                const checksumMatches = exists ? (await this.fileSystem.checksum(entry.path)) === entry.checksum : false;
                return {
                    key: entry.key,
                    exists,
                    checksumMatches,
                };
            })
        );
    }
}