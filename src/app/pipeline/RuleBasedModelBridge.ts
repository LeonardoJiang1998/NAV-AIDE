import Fuse from 'fuse.js';

import type { IntentExtraction } from '../../core/llm/IntentExtractor';
import type { NaturalLanguageRenderAdapter, NaturalLanguageRenderResponse, StructuredIntentModelAdapter } from '../../core/runtime/ModelAdapterContracts';

function detectLanguage(query: string): IntentExtraction['detectedLanguage'] {
    if (/[\u4e00-\u9fff]/u.test(query)) {
        return 'Mandarin';
    }
    if (/[\u0600-\u06ff]/u.test(query)) {
        return 'Arabic';
    }

    const normalized = query.toLowerCase();
    if (/(como voy|donde esta|busca|estoy perdido|cuanto cuesta|llevame)/.test(normalized)) {
        return 'Spanish';
    }
    if (/(comment aller|ou est|trouve|je suis perdu|quel est le tarif|emmene-moi)/.test(normalized)) {
        return 'French';
    }

    return 'English';
}

function extractUserQuery(prompt: string): string {
    const match = prompt.match(/User query:\s*(.+)$/m);
    return match ? match[1].trim() : prompt.trim();
}

function findStationNames(query: string, knownStations: string[]): string[] {
    const fuse = new Fuse(knownStations, { includeScore: true, threshold: 0.35 });
    const exact = knownStations.filter((station) => query.toLowerCase().includes(station.toLowerCase()));
    if (exact.length > 0) {
        return exact;
    }

    return fuse.search(query).slice(0, 2).map((result) => result.item);
}

export class RuleBasedStructuredModelClient implements StructuredIntentModelAdapter {
    public constructor(private readonly knownStations: string[]) { }

    public async generateStructured<T>(request: { prompt: string; schema: object }): Promise<T> {
        const rawQuery = extractUserQuery(request.prompt);
        const normalized = rawQuery.toLowerCase();
        const stationMatches = findStationNames(rawQuery, this.knownStations);

        let intent: IntentExtraction['intent'] = 'unknown';
        let origin: string | null = null;
        let destination: string | null = null;
        let poiQuery: string | null = null;
        let requiresDisambiguation = false;

        if (/(nearest|closest|اقرب|最近|plus proche)/.test(normalized)) {
            intent = 'nearest_station';
        } else if (/\bwhere('?s|\s+is)\b|\bhow\s+do\s+i\s+find\b|\blocate\b/.test(normalized)) {
            // "Where is X?" and "Where's X?" — treat as nearest_station lookup.
            // If the station isn't in the known set, the pipeline will flag it
            // as unresolved, which is safer than guessing a route.
            intent = 'nearest_station';
            destination = stationMatches[0] ?? null;
        } else if (/(lost|perdido|perdu|迷路|تائه)/.test(normalized)) {
            intent = 'lost_help';
            origin = stationMatches[0] ?? null;
        } else if (/(find|busca|trouve|ابحث)/.test(normalized)) {
            intent = 'poi_lookup';
            poiQuery = rawQuery.replace(/.*?(find|busca|trouve|ابحث عن?)\s+/i, '').trim();
        } else if (/(fare|how much|cuanto cuesta|tarif|多少钱|كم تكلفة)/.test(normalized)) {
            intent = 'fare';
        } else if (/(from|to|take me to|lleva|emmene-moi|خذني|怎么从| الى | إلى |到)/.test(normalized)) {
            intent = 'route';
        }

        if (intent === 'route' || intent === 'fare') {
            if (stationMatches.length >= 2) {
                origin = stationMatches[0] ?? null;
                destination = stationMatches[1] ?? null;
            } else if (stationMatches.length === 1) {
                // Single station — assign to origin or destination based on
                // context words around it. "From Waterloo" → origin. "Take me
                // to Baker Street" / "To Baker Street" → destination.
                const hasFrom = /\bfrom\b/i.test(rawQuery);
                const hasTo = /\bto\b/i.test(rawQuery);
                if (hasFrom && !hasTo) {
                    origin = stationMatches[0];
                } else {
                    destination = stationMatches[0];
                }
            } else {
                destination = rawQuery.split(/to| a |الى|إلى/i).pop()?.trim() ?? null;
            }
        }

        if (destination?.toLowerCase() === 'park' || rawQuery.endsWith('Park')) {
            requiresDisambiguation = true;
            destination = 'Park';
        }

        return {
            detectedLanguage: detectLanguage(rawQuery),
            intent,
            origin,
            destination,
            poiQuery,
            requiresDisambiguation,
            rawQuery,
        } as T;
    }
}

export class RuleBasedRenderClient implements NaturalLanguageRenderAdapter {
    public async renderNaturalLanguage(request: { prompt: string }): Promise<NaturalLanguageRenderResponse> {
        const summaryMatch = request.prompt.match(/Summary:\s*(.+)$/m);
        const allowedMatch = request.prompt.match(/Allowed place names:\s*(.+)$/m);
        const text = summaryMatch ? summaryMatch[1].trim() : 'No summary available.';
        const referencedPlaceNames = allowedMatch
            ? allowedMatch[1].split(',').map((value) => value.trim()).filter(Boolean)
            : [];

        return {
            text,
            referencedPlaceNames,
        };
    }
}