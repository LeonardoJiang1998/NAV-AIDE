import { execFileSync } from 'node:child_process';

import { EntityResolver, type EntityRecord, type ResolvedEntityType } from './EntityResolver.js';

const FIELD_SEPARATOR = '\t';
const ALIAS_SEPARATOR = '|||';

export function createEntityResolverFromSqlite(dbPath: string) {
    return new EntityResolver(loadEntityRecordsFromSqlite(dbPath));
}

export function loadEntityRecordsFromSqlite(dbPath: string): EntityRecord[] {
    const sql = `
SELECT
    canonical_name,
    entity_type,
    COALESCE(GROUP_CONCAT(alias_value, '|||'), '') AS aliases
FROM (
    SELECT
        canonical_name,
        entity_type,
        CASE
            WHEN alias = canonical_name THEN NULL
            ELSE alias
        END AS alias_value,
        normalized_alias
    FROM location_aliases
    ORDER BY canonical_name, normalized_alias
)
GROUP BY canonical_name, entity_type
ORDER BY canonical_name;
`;

    const output = execFileSync('sqlite3', ['-noheader', '-separator', FIELD_SEPARATOR, dbPath, sql], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!output) {
        return [];
    }

    return output.split('\n').map((line) => {
        const [canonicalName, entityType, aliasColumn = ''] = line.split(FIELD_SEPARATOR);
        const aliases = aliasColumn
            .split(ALIAS_SEPARATOR)
            .map((alias) => alias.trim())
            .filter(Boolean);

        return {
            id: buildEntityId(entityType as ResolvedEntityType, canonicalName),
            canonicalName,
            type: entityType as ResolvedEntityType,
            aliases,
        } satisfies EntityRecord;
    });
}

function buildEntityId(type: ResolvedEntityType, canonicalName: string) {
    const slug = canonicalName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `${type}-${slug}`;
}