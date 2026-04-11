import type { StructuredIntentModelAdapter } from '../runtime/ModelAdapterContracts';

export type ExtractedIntentType = 'route' | 'nearest_station' | 'poi_lookup' | 'lost_help' | 'fare' | 'unknown';
export type ExtractedLanguage = 'English' | 'Mandarin' | 'Spanish' | 'French' | 'Arabic' | 'Other';

export interface IntentExtraction {
    detectedLanguage: ExtractedLanguage;
    intent: ExtractedIntentType;
    origin: string | null;
    destination: string | null;
    poiQuery: string | null;
    requiresDisambiguation: boolean;
    rawQuery: string;
}

export type StructuredJsonModelClient = StructuredIntentModelAdapter;

export interface IntentExtractionOptions {
    fastPathHints?: string[];
}

export const INTENT_EXTRACTION_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['detectedLanguage', 'intent', 'origin', 'destination', 'poiQuery', 'requiresDisambiguation', 'rawQuery'],
    properties: {
        detectedLanguage: { type: 'string', enum: ['English', 'Mandarin', 'Spanish', 'French', 'Arabic', 'Other'] },
        intent: { type: 'string', enum: ['route', 'nearest_station', 'poi_lookup', 'lost_help', 'fare', 'unknown'] },
        origin: { type: ['string', 'null'] },
        destination: { type: ['string', 'null'] },
        poiQuery: { type: ['string', 'null'] },
        requiresDisambiguation: { type: 'boolean' },
        rawQuery: { type: 'string' },
    },
} as const;

export class IntentExtractor {
    public constructor(private readonly client: StructuredIntentModelAdapter) { }

    public async extract(rawQuery: string, knownStations: string[], options: IntentExtractionOptions = {}): Promise<IntentExtraction> {
        const prompt = this.buildPrompt(rawQuery, knownStations, options.fastPathHints ?? []);
        const result = await this.client.generateStructured<IntentExtraction>({
            prompt,
            schema: INTENT_EXTRACTION_SCHEMA,
        });

        return validateIntentExtraction(result, rawQuery);
    }

    private buildPrompt(rawQuery: string, knownStations: string[], fastPathHints: string[]): string {
        const lines = [
            'Extract structured NAV AiDE travel intent as JSON.',
            'Known station names:',
            knownStations.join(', '),
            `User query: ${rawQuery}`,
        ];

        if (fastPathHints.length > 0) {
            lines.push('Local fast-path hints:', fastPathHints.join(', '));
        }

        return lines.join('\n');
    }
}

export function validateIntentExtraction(candidate: IntentExtraction, rawQuery: string): IntentExtraction {
    const languages = new Set<ExtractedLanguage>(['English', 'Mandarin', 'Spanish', 'French', 'Arabic', 'Other']);
    const intents = new Set<ExtractedIntentType>(['route', 'nearest_station', 'poi_lookup', 'lost_help', 'fare', 'unknown']);

    if (!languages.has(candidate.detectedLanguage) || !intents.has(candidate.intent)) {
        throw new Error('Intent extraction returned an unsupported language or intent.');
    }

    if (typeof candidate.requiresDisambiguation !== 'boolean') {
        throw new Error('Intent extraction must include a boolean requiresDisambiguation value.');
    }

    if (candidate.rawQuery !== rawQuery) {
        throw new Error('Intent extraction must preserve the original raw query.');
    }

    return candidate;
}