export interface GoldenPipelineCase {
    id: string;
    rawQuery: string;
    expectedStatus: 'complete' | 'needs_disambiguation' | 'unresolved';
    expectedIntent: string;
    expectedRenderedText: string;
    allowedPlaceNames: string[];
}