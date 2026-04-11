export interface AssetPathRoots {
    documentDirectoryPath: string;
    libraryDirectoryPath?: string;
    cachesDirectoryPath?: string;
    mainBundlePath?: string;
}

export interface ResolvedAssetCandidate {
    source: 'document' | 'library' | 'cache' | 'bundle';
    path: string;
}

export function normalizeManagedRelativePath(relativePath: string): string {
    return relativePath.replace(/^assets\//, '').replace(/^\/+/, '');
}

export function buildResolvedAssetCandidates(relativePath: string, roots: AssetPathRoots): ResolvedAssetCandidate[] {
    const normalized = normalizeManagedRelativePath(relativePath);
    const segments = normalized.split('/').filter(Boolean);
    const joined = segments.join('/');
    const candidates: ResolvedAssetCandidate[] = [];

    if (roots.documentDirectoryPath) {
        candidates.push({ source: 'document', path: `${trimTrailingSlash(roots.documentDirectoryPath)}/${joined}` });
    }

    if (roots.libraryDirectoryPath) {
        candidates.push({ source: 'library', path: `${trimTrailingSlash(roots.libraryDirectoryPath)}/${joined}` });
    }

    if (roots.cachesDirectoryPath) {
        candidates.push({ source: 'cache', path: `${trimTrailingSlash(roots.cachesDirectoryPath)}/${joined}` });
    }

    if (roots.mainBundlePath) {
        candidates.push({ source: 'bundle', path: `${trimTrailingSlash(roots.mainBundlePath)}/${joined}` });
    }

    return candidates;
}

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}