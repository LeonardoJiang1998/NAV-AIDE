import RNFS from 'react-native-fs';

import type { ManifestCheckResult } from './ManifestChecker';
import { ManifestChecker } from './ManifestChecker';
import { assetManifest } from './assetManifest';

export interface AssetStatus {
    ready: boolean;
    checks: ManifestCheckResult[];
}

class ReactNativeFileSystemAdapter {
    public async exists(path: string): Promise<boolean> {
        return RNFS.exists(path);
    }

    public async checksum(path: string): Promise<string> {
        return RNFS.hash(path, 'sha256');
    }
}

export class AssetManager {
    private readonly checker = new ManifestChecker(new ReactNativeFileSystemAdapter());

    public async getStatus(): Promise<AssetStatus> {
        const checks = await this.checker.check(assetManifest);
        return {
            ready: checks.every((check) => check.exists && check.checksumMatches),
            checks,
        };
    }
}