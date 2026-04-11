import SQLite from 'react-native-sqlite-storage';

import type { EntityRecord, ResolvedEntityType } from '../../core/pipeline/EntityResolver';
import type { POIRecord } from '../../core/poi/POIService';
import type { SqliteAssetContract } from '../../core/runtime/OfflineRuntimeContracts';

SQLite.enablePromise?.(true);

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
SELECT id, canonical_name, category
FROM pois
ORDER BY canonical_name;
`);

            return rows.map((row) => ({
                id: String(row.id ?? ''),
                canonicalName: String(row.canonical_name ?? ''),
                category: String(row.category ?? 'unknown'),
                aliases: [],
            } satisfies POIRecord));
        } finally {
            await database.close();
        }
    }

    private async openDatabase(absolutePath: string): Promise<SQLiteDatabaseHandle> {
        return SQLite.openDatabase({ name: absolutePath, location: 'default', readOnly: true }) as Promise<SQLiteDatabaseHandle>;
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