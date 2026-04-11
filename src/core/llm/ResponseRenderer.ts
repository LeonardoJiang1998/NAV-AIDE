import type { NaturalLanguageRenderAdapter, NaturalLanguageRenderResponse } from '../runtime/ModelAdapterContracts.js';

export interface RenderRequest {
    intent: string;
    summary: string;
    allowedPlaceNames: string[];
}

export type RenderModelResponse = NaturalLanguageRenderResponse;
export type NaturalLanguageRenderClient = NaturalLanguageRenderAdapter;

export interface RenderedResponse extends RenderModelResponse { }

export class ResponseRenderer {
    public constructor(private readonly client: NaturalLanguageRenderAdapter) { }

    public async render(request: RenderRequest): Promise<RenderedResponse> {
        const prompt = [
            'Render a concise NAV AiDE response.',
            `Intent: ${request.intent}`,
            `Summary: ${request.summary}`,
            `Allowed place names: ${request.allowedPlaceNames.join(', ')}`,
        ].join('\n');

        const response = await this.client.renderNaturalLanguage({ prompt });
        assertNoHallucinatedPlaceNames(response.referencedPlaceNames, request.allowedPlaceNames);
        return response;
    }
}

export function assertNoHallucinatedPlaceNames(referencedPlaceNames: string[], allowedPlaceNames: string[]): void {
    const allowed = new Set(allowedPlaceNames);
    const hallucinated = referencedPlaceNames.filter((placeName) => !allowed.has(placeName));
    if (hallucinated.length > 0) {
        throw new Error(`Hallucinated place names detected: ${hallucinated.join(', ')}`);
    }
}