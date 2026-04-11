import { FuzzyMatcher } from '../poi/FuzzyMatcher';

export type ResolvedEntityType = 'station' | 'poi';
export type MatchMethod = 'exact' | 'alias' | 'fuzzy';

export interface EntityRecord {
    id: string;
    canonicalName: string;
    type: ResolvedEntityType;
    aliases: string[];
}

export interface ResolutionCandidate {
    entity: EntityRecord;
    confidence: number;
    matchedBy: MatchMethod;
    matchedValue: string;
}

export interface ResolutionResult {
    status: 'resolved' | 'disambiguation' | 'unresolved';
    confidence: number;
    bestCandidate: ResolutionCandidate | null;
    candidates: ResolutionCandidate[];
    normalizedQuery: string;
}

export const EXACT_MATCH_THRESHOLD = 1.0;
export const ALIAS_MATCH_THRESHOLD = 0.93;
export const FUZZY_RESOLVE_THRESHOLD = 0.78;
export const DISAMBIGUATION_THRESHOLD = 0.72;
export const MIN_SCORE_GAP = 0.05;

export class EntityResolver {
    public constructor(
        private readonly records: EntityRecord[],
        private readonly matcher: FuzzyMatcher = new FuzzyMatcher()
    ) { }

    public resolve(query: string): ResolutionResult {
        const normalizedQuery = this.matcher.normalize(query);
        if (!normalizedQuery) {
            return this.unresolved(normalizedQuery);
        }

        const exactCanonical = this.records.find((record) => this.matcher.normalize(record.canonicalName) === normalizedQuery);
        if (exactCanonical) {
            return this.resolved(exactCanonical, EXACT_MATCH_THRESHOLD, 'exact', exactCanonical.canonicalName, normalizedQuery);
        }

        const exactAliasMatch = this.findAliasMatch(normalizedQuery);
        if (exactAliasMatch) {
            return this.resolved(
                exactAliasMatch.record,
                ALIAS_MATCH_THRESHOLD,
                'alias',
                exactAliasMatch.alias,
                normalizedQuery
            );
        }

        const ranked = this.matcher.rank(normalizedQuery, this.records, (record) => [record.canonicalName, ...record.aliases]);
        const topCandidates = ranked
            .filter((candidate) => candidate.score >= DISAMBIGUATION_THRESHOLD)
            .slice(0, 3)
            .map((candidate) => ({
                entity: candidate.item,
                confidence: candidate.score,
                matchedBy: candidate.matchedValue === candidate.item.canonicalName ? 'fuzzy' : 'alias',
                matchedValue: candidate.matchedValue,
            } satisfies ResolutionCandidate));

        const bestCandidate = topCandidates[0] ?? null;
        const secondCandidate = topCandidates[1] ?? null;

        if (!bestCandidate) {
            return this.unresolved(normalizedQuery);
        }

        if (
            bestCandidate.confidence >= FUZZY_RESOLVE_THRESHOLD &&
            (!secondCandidate || bestCandidate.confidence - secondCandidate.confidence >= MIN_SCORE_GAP)
        ) {
            return {
                status: 'resolved',
                confidence: bestCandidate.confidence,
                bestCandidate,
                candidates: topCandidates,
                normalizedQuery,
            };
        }

        return {
            status: 'disambiguation',
            confidence: bestCandidate.confidence,
            bestCandidate,
            candidates: topCandidates,
            normalizedQuery,
        };
    }

    public allRecords(): EntityRecord[] {
        return [...this.records];
    }

    public findById(id: string): EntityRecord | null {
        return this.records.find((record) => record.id === id) ?? null;
    }

    private findAliasMatch(normalizedQuery: string): { record: EntityRecord; alias: string } | null {
        for (const record of this.records) {
            const alias = record.aliases.find((value) => this.matcher.normalize(value) === normalizedQuery);
            if (alias) {
                return { record, alias };
            }
        }

        return null;
    }

    private resolved(
        entity: EntityRecord,
        confidence: number,
        matchedBy: MatchMethod,
        matchedValue: string,
        normalizedQuery: string
    ): ResolutionResult {
        const candidate: ResolutionCandidate = {
            entity,
            confidence,
            matchedBy,
            matchedValue,
        };

        return {
            status: 'resolved',
            confidence,
            bestCandidate: candidate,
            candidates: [candidate],
            normalizedQuery,
        };
    }

    private unresolved(normalizedQuery: string): ResolutionResult {
        return {
            status: 'unresolved',
            confidence: 0,
            bestCandidate: null,
            candidates: [],
            normalizedQuery,
        };
    }
}