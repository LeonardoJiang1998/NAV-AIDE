export interface GoldenPipelineCase {
    id: string;
    rawQuery: string;
    extraction: {
        detectedLanguage: 'English' | 'Mandarin' | 'Spanish' | 'French' | 'Arabic' | 'Other';
        intent: 'route' | 'nearest_station' | 'poi_lookup' | 'lost_help' | 'fare' | 'unknown';
        origin: string | null;
        destination: string | null;
        poiQuery: string | null;
        requiresDisambiguation: boolean;
    };
    expectedStatus: 'complete' | 'needs_disambiguation' | 'unresolved';
    expectedIntent: string;
    expectedRenderedText: string | null;
    allowedPlaceNames: string[];
    expectedRouteCost?: number | null;
    expectedWalkingStatus?: 'ok' | 'asset-unavailable' | null;
    expectedPoiNames?: string[];
    expectedDisruptionIds?: string[];
    expectedOriginStatus?: 'resolved' | 'disambiguation' | 'unresolved';
    expectedDestinationStatus?: 'resolved' | 'disambiguation' | 'unresolved';
}