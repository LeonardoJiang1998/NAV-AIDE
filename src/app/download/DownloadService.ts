import RNFS from 'react-native-fs';

import type { OfflineAssetManifestEntry } from '../assets/assetManifest';

export type DownloadItemStatus = 'pending' | 'downloading' | 'validating' | 'complete' | 'failed';

export interface DownloadItemState {
    key: string;
    status: DownloadItemStatus;
    progress: number;
    bytesWritten: number;
    totalBytes: number;
    error: string | null;
}

export interface DownloadServiceConfig {
    baseUrl: string;
    destinationRoot: string;
}

function initialItemState(key: string): DownloadItemState {
    return { key, status: 'pending', progress: 0, bytesWritten: 0, totalBytes: 0, error: null };
}

export class DownloadService {
    private readonly config: DownloadServiceConfig;
    private readonly items = new Map<string, DownloadItemState>();
    private readonly activeJobs = new Map<string, number>();

    constructor(config: DownloadServiceConfig) {
        this.config = config;
    }

    public getState(): DownloadItemState[] {
        return [...this.items.values()];
    }

    public async downloadAsset(
        entry: OfflineAssetManifestEntry,
        onProgress?: (state: DownloadItemState) => void,
    ): Promise<DownloadItemState> {
        const state = initialItemState(entry.key);
        this.items.set(entry.key, state);

        const destinationPath = `${this.config.destinationRoot}/${entry.path}`;
        const parentDir = destinationPath.substring(0, destinationPath.lastIndexOf('/'));

        try {
            await RNFS.mkdir(parentDir);

            const fromUrl = `${this.config.baseUrl}/${entry.key}`;

            state.status = 'downloading';
            this.items.set(entry.key, { ...state });
            onProgress?.({ ...state });

            const { jobId, promise } = RNFS.downloadFile({
                fromUrl,
                toFile: destinationPath,
                connectionTimeout: 30_000,
                readTimeout: 60_000,
                begin: (result: { contentLength: number }) => {
                    state.totalBytes = result.contentLength;
                    this.items.set(entry.key, { ...state });
                    onProgress?.({ ...state });
                },
                progress: (result: { bytesWritten: number; contentLength: number }) => {
                    state.bytesWritten = result.bytesWritten;
                    state.totalBytes = result.contentLength;
                    state.progress = result.contentLength > 0 ? result.bytesWritten / result.contentLength : 0;
                    this.items.set(entry.key, { ...state });
                    onProgress?.({ ...state });
                },
            });

            this.activeJobs.set(entry.key, jobId);
            const result = await promise;
            this.activeJobs.delete(entry.key);

            if (result.statusCode < 200 || result.statusCode >= 300) {
                state.status = 'failed';
                state.error = `HTTP ${result.statusCode}`;
                this.items.set(entry.key, { ...state });
                onProgress?.({ ...state });
                return { ...state };
            }

            state.status = 'validating';
            state.progress = 1;
            this.items.set(entry.key, { ...state });
            onProgress?.({ ...state });

            const checksumValid = await this.validateChecksum(destinationPath, entry.checksum);

            if (!checksumValid) {
                state.status = 'failed';
                state.error = 'Checksum mismatch after download.';
                this.items.set(entry.key, { ...state });
                onProgress?.({ ...state });
                return { ...state };
            }

            state.status = 'complete';
            state.error = null;
            this.items.set(entry.key, { ...state });
            onProgress?.({ ...state });
            return { ...state };
        } catch (error) {
            this.activeJobs.delete(entry.key);
            state.status = 'failed';
            state.error = error instanceof Error ? error.message : 'Download failed.';
            this.items.set(entry.key, { ...state });
            onProgress?.({ ...state });
            return { ...state };
        }
    }

    public async downloadAll(
        entries: OfflineAssetManifestEntry[],
        onProgress?: (states: DownloadItemState[]) => void,
    ): Promise<DownloadItemState[]> {
        for (const entry of entries) {
            this.items.set(entry.key, initialItemState(entry.key));
        }

        const results: DownloadItemState[] = [];

        for (const entry of entries) {
            const result = await this.downloadAsset(entry, () => {
                onProgress?.(this.getState());
            });
            results.push(result);
        }

        return results;
    }

    public async validateChecksum(filePath: string, expectedChecksum: string): Promise<boolean> {
        try {
            const actualChecksum = await RNFS.hash(filePath, 'sha256');
            return actualChecksum === expectedChecksum;
        } catch {
            return false;
        }
    }

    public cancelDownload(key: string): void {
        const jobId = this.activeJobs.get(key);
        if (jobId !== undefined) {
            RNFS.stopDownload(jobId);
            this.activeJobs.delete(key);

            const state = this.items.get(key);
            if (state) {
                state.status = 'failed';
                state.error = 'Download cancelled.';
                this.items.set(key, { ...state });
            }
        }
    }
}
