import SQLite from 'react-native-sqlite-storage';
import RNFS from 'react-native-fs';

import type { EntityRecord, ResolvedEntityType } from '../../core/pipeline/EntityResolver';
import type { POIRecord } from '../../core/poi/POIService';
import type { SqliteAssetContract } from '../../core/runtime/OfflineRuntimeContracts';

SQLite.enablePromise?.(true);

/**
 * react-native-sqlite-storage on iOS cannot open DB files via an absolute path.
 * `openDatabase({ name: absolutePath, location: 'default' })` prepends the app
 * Library directory to the already-absolute path and hangs with no error.
 *
 * The supported workaround is `createFromLocation` + `readOnly: true`:
 *   - `createFromLocation` maps to native `assetFilename`.
 *   - With a relative path (e.g. "data/pois.db"), the native code prepends the
 *     Documents directory. So we rewrite the absolute path back into a
 *     Documents-relative path, and keep the library-internal key stable by
 *     using the trailing filename as `name`.
 *
 * If a caller passes an absolute path rooted elsewhere (Library, Caches, or
 * app bundle), we fall back to treating the leaf basename as the DB name and
 * the full path as the asset. That mirrors the library's `~`-prefix contract.
 */

interface SQLiteResultSet {
    rows: {
        length: number;
        item(index: number): Record<string, unknown>;
    };
}

interface SQLiteDatabaseHandle {
    executeSql(statement: string, params?: unknown[]): Promise<[SQLiteResultSet]>;
    close(): Promise<void>;
}

export interface SqliteValidationResult {
    tablesPresent: string[];
    ftsTablesPresent: string[];
}

function trimTrailingSlash(path: string): string {
    return path.endsWith('/') ? path.slice(0, -1) : path;
}

function toNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export class ReactNativeSQLiteAdapter {
    public async validateAsset(contract: SqliteAssetContract, absolutePath: string): Promise<SqliteValidationResult> {
        const database = await this.openDatabase(absolutePath);

        try {
            const tablesPresent: string[] = [];
            const ftsTablesPresent: string[] = [];

            for (const table of contract.tables) {
                if (await this.tableExists(database, table)) {
                    tablesPresent.push(table);
                }
            }

            for (const table of contract.ftsTables) {
                if (await this.tableExists(database, table)) {
                    ftsTablesPresent.push(table);
                }
            }

            return { tablesPresent, ftsTablesPresent };
        } finally {
            await database.close();
        }
    }

    public async loadEntityRecords(absolutePath: string): Promise<EntityRecord[]> {
        const database = await this.openDatabase(absolutePath);

        try {
            const rows = await this.queryRows(database, `
SELECT canonical_name, entity_type, alias
FROM location_aliases
ORDER BY canonical_name, normalized_alias;
`);

            const grouped = new Map<string, EntityRecord>();
            for (const row of rows) {
                const canonicalName = String(row.canonical_name ?? '');
                const entityType = String(row.entity_type ?? 'station') as ResolvedEntityType;
                const alias = String(row.alias ?? '');
                const id = `${entityType}-${canonicalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

                const current = grouped.get(id) ?? {
                    id,
                    canonicalName,
                    type: entityType,
                    aliases: [],
                };

                if (alias && alias !== canonicalName) {
                    current.aliases.push(alias);
                }

                grouped.set(id, current);
            }

            return [...grouped.values()];
        } finally {
            await database.close();
        }
    }

    public async loadPois(absolutePath: string): Promise<POIRecord[]> {
        const database = await this.openDatabase(absolutePath);

        try {
            const rows = await this.queryRows(database, `
SELECT id, canonical_name, category, latitude, longitude, zone, nearest_station, search_terms
FROM pois
ORDER BY canonical_name;
`);

            return rows.map((row) => {
                const searchTerms = String(row.search_terms ?? '').split(/\s+/).filter(Boolean);
                const lat = toNumber(row.latitude);
                const lon = toNumber(row.longitude);
                const zone = toNumber(row.zone);
                const nearestStation = row.nearest_station ? String(row.nearest_station) : undefined;
                return {
                    id: String(row.id ?? ''),
                    canonicalName: String(row.canonical_name ?? ''),
                    category: String(row.category ?? 'unknown'),
                    aliases: searchTerms.filter((term) => term !== String(row.canonical_name)),
                    latitude: lat ?? undefined,
                    longitude: lon ?? undefined,
                    zone: zone ?? undefined,
                    nearestStation,
                } satisfies POIRecord;
            });
        } finally {
            await database.close();
        }
    }

    private async openDatabase(absolutePath: string): Promise<SQLiteDatabaseHandle> {
        const leafName = absolutePath.split('/').filter(Boolean).pop() ?? 'db.sqlite';
        const docsRoot = trimTrailingSlash(RNFS.DocumentDirectoryPath);
        let assetRelative: string;

        if (absolutePath.startsWith('/') && docsRoot && absolutePath.startsWith(`${docsRoot}/`)) {
            assetRelative = absolutePath.slice(docsRoot.length + 1);
        } else {
            // Not in Documents — fall back to the leaf filename. Native side will
            // look for it inside Documents; make sure the caller has actually
            // copied the file there before opening.
            assetRelative = leafName;
        }

        const params: {
            name: string;
            readOnly: boolean;
            createFromLocation: string;
        } = {
            name: leafName,
            readOnly: true,
            createFromLocation: assetRelative,
        };

        return SQLite.openDatabase(params) as Promise<SQLiteDatabaseHandle>;
    }

    private async tableExists(database: SQLiteDatabaseHandle, table: string): Promise<boolean> {
        const rows = await this.queryRows(database, "SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1;", [table]);
        return rows.length > 0;
    }

    private async queryRows(database: SQLiteDatabaseHandle, statement: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
        const [result] = await database.executeSql(statement, params);
        const rows: Record<string, unknown>[] = [];

        for (let index = 0; index < result.rows.length; index += 1) {
            rows.push(result.rows.item(index));
        }

        return rows;
    }
}