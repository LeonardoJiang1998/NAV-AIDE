/**
 * Post-processing for structured intent extractions.
 *
 * Small LLMs (notably Gemma 3 1B) sometimes swap the `origin` and
 * `destination` fields — they correctly extract both station names but
 * assign them to the wrong slots. For route-style queries we can cross-check
 * the extraction against the raw query by looking at which name appears after
 * "from"/"to" / "from"/"from", or just which name comes first in the text.
 *
 * If both extracted strings are present in the raw query and the extraction
 * contradicts the obvious word order, swap them. If the signal is ambiguous
 * (both before/after the same preposition, or neither name is present in the
 * raw text), leave the extraction untouched — we never want to "correct" a
 * weak signal into a wrong one.
 */

import type { IntentExtraction } from './IntentExtractor';

export function correctOriginDestinationOrder(extraction: IntentExtraction): IntentExtraction {
    if (extraction.intent !== 'route') return extraction;
    const origin = extraction.origin?.trim();
    const destination = extraction.destination?.trim();
    const raw = extraction.rawQuery.toLowerCase();

    // Special case: LLM returned only an origin but the raw query is a
    // destination-only "take me to X" / "to X" form. Flip origin → destination.
    if (origin && !destination) {
        const originLower = origin.toLowerCase();
        const bareToMatch = raw.match(/\bto\s+([^,?!]+?)(?:[?.!]|$)/);
        const hasFrom = /\bfrom\b/.test(raw);
        if (bareToMatch && !hasFrom) {
            const afterTo = bareToMatch[1].trim();
            if (afterTo.includes(originLower)) {
                return { ...extraction, origin: null, destination: origin };
            }
        }
        return extraction;
    }

    if (!origin || !destination || origin === destination) return extraction;

    const originLower = origin.toLowerCase();
    const destLower = destination.toLowerCase();

    const originIdx = raw.indexOf(originLower);
    const destIdx = raw.indexOf(destLower);
    if (originIdx < 0 || destIdx < 0) return extraction;

    // Look for the preposition signal. "from X to Y" is the strongest cue.
    const fromMatch = raw.match(/\bfrom\s+([^,?!]+?)(?:\s+to\s+([^,?!]+?))?(?:[?.!]|$)/);
    if (fromMatch) {
        const afterFrom = fromMatch[1].trim();
        const afterTo = fromMatch[2]?.trim();
        if (afterFrom && afterTo) {
            const fromHit = afterFrom.includes(originLower) || afterFrom.includes(destLower);
            const toHit = afterTo.includes(originLower) || afterTo.includes(destLower);
            if (fromHit && toHit) {
                const originInFrom = afterFrom.includes(originLower);
                const destInTo = afterTo.includes(destLower);
                if (originInFrom && destInTo) return extraction;
                // Both hit but in the wrong slots — swap.
                return { ...extraction, origin: destination, destination: origin };
            }
        }
    }

    // Fallback: if there's no preposition signal but both names are in the
    // raw text, the first one to appear is the origin.
    if (originIdx > destIdx) {
        return { ...extraction, origin: destination, destination: origin };
    }

    return extraction;
}
