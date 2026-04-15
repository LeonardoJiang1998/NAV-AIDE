import { FuzzyMatcher } from './FuzzyMatcher';

export interface POIRecord {
    id: string;
    canonicalName: string;
    category: string;
    aliases: string[];
    latitude?: number;
    longitude?: number;
    nearestStation?: string;
    zone?: number;
}

export interface POIResult {
    poi: POIRecord;
    confidence: number;
}

export class POIService {
    public constructor(private readonly pois: POIRecord[], private readonly matcher: FuzzyMatcher = new FuzzyMatcher()) { }

    public search(query: string, limit = 3): POIResult[] {
        return this.matcher
            .rank(query, this.pois, (poi) => [poi.canonicalName, ...poi.aliases])
            .filter((result) => result.score >= 0.7)
            .slice(0, limit)
            .map((result) => ({ poi: result.item, confidence: result.score }));
    }
}