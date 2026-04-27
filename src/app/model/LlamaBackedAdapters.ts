import type { StructuredIntentModelAdapter, NaturalLanguageRenderAdapter, NaturalLanguageRenderResponse } from '../../core/runtime/ModelAdapterContracts';

import { LocalModelManager } from './LocalModelManager';

interface ModelPathResolver {
    resolveModelPath(): Promise<{ resolvedPath: string; exists: boolean }>;
}

export class LlamaBackedStructuredIntentAdapter implements StructuredIntentModelAdapter {
    public constructor(private readonly manager: LocalModelManager, private readonly pathResolver: ModelPathResolver) { }

    public async generateStructured<T>(request: { prompt: string; schema: object }): Promise<T> {
        const model = await this.pathResolver.resolveModelPath();
        if (!model.exists) {
            throw new Error(`Model asset missing at ${model.resolvedPath}`);
        }

        const context = await this.manager.getContext(model.resolvedPath);
        // Use messages format so llama.rn applies Gemma's chat template
        // (<start_of_turn>user\n...<end_of_turn>\n<start_of_turn>model\n).
        // This improves instruction-following for structured JSON output.
        const result = await context.completion({
            messages: [{ role: 'user', content: request.prompt }],
            n_predict: 256,
            temperature: 0.1,
            response_format: {
                type: 'json_schema',
                json_schema: {
                    strict: true,
                    schema: request.schema,
                },
            },
        });

        return JSON.parse((result.content || result.text).trim()) as T;
    }
}

export class LlamaBackedRenderAdapter implements NaturalLanguageRenderAdapter {
    public constructor(private readonly manager: LocalModelManager, private readonly pathResolver: ModelPathResolver) { }

    public async renderNaturalLanguage(request: { prompt: string }): Promise<NaturalLanguageRenderResponse> {
        const model = await this.pathResolver.resolveModelPath();
        if (!model.exists) {
            throw new Error(`Model asset missing at ${model.resolvedPath}`);
        }

        const context = await this.manager.getContext(model.resolvedPath);
        // Use messages format so llama.rn applies Gemma's chat template.
        const result = await context.completion({
            messages: [{
                role: 'user',
                content: [
                    request.prompt,
                    'Return JSON with keys: text, referencedPlaceNames.',
                ].join('\n'),
            }],
            n_predict: 256,
            temperature: 0.2,
            response_format: {
                type: 'json_schema',
                json_schema: {
                    strict: true,
                    schema: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['text', 'referencedPlaceNames'],
                        properties: {
                            text: { type: 'string' },
                            referencedPlaceNames: {
                                type: 'array',
                                items: { type: 'string' },
                            },
                        },
                    },
                },
            },
        });

        return JSON.parse((result.content || result.text).trim()) as NaturalLanguageRenderResponse;
    }
}

export class FallbackStructuredIntentAdapter implements StructuredIntentModelAdapter {
    public constructor(
        private readonly primary: StructuredIntentModelAdapter,
        private readonly fallback: StructuredIntentModelAdapter
    ) { }

    public async generateStructured<T>(request: { prompt: string; schema: object }): Promise<T> {
        try {
            return await this.primary.generateStructured<T>(request);
        } catch {
            return this.fallback.generateStructured<T>(request);
        }
    }
}

/**
 * "Fast first" adapter: run the rule-based extractor first because it's
 * sub-millisecond; only fall through to the LLM if the rule extractor
 * couldn't classify the intent or couldn't pull a route endpoint. This
 * eliminates the 40–80 s LLM round-trip for ordinary "X to Y" / "Take me to
 * X" queries that the rule bridge handles cleanly.
 *
 * Layered as the primary in the existing FallbackStructuredIntentAdapter
 * chain so the LLM still acts as the safety net on novel phrasings.
 */
export class FastFirstStructuredIntentAdapter implements StructuredIntentModelAdapter {
    public constructor(
        private readonly fast: StructuredIntentModelAdapter,
        private readonly slow: StructuredIntentModelAdapter
    ) { }

    public async generateStructured<T>(request: { prompt: string; schema: object }): Promise<T> {
        const fastResult = await this.fast.generateStructured<T>(request);
        if (this.fastResultIsConfident(fastResult)) {
            return fastResult;
        }
        try {
            return await this.slow.generateStructured<T>(request);
        } catch {
            // LLM unavailable → keep the rule-based answer rather than fail.
            return fastResult;
        }
    }

    private fastResultIsConfident(result: unknown): boolean {
        if (!result || typeof result !== 'object') return false;
        const r = result as { intent?: string; origin?: string | null; destination?: string | null; poiQuery?: string | null };
        // Unknown intent → defer to LLM.
        if (!r.intent || r.intent === 'unknown') return false;
        // Route/fare with neither origin nor destination → defer to LLM, the
        // raw text might be unusual phrasing.
        if ((r.intent === 'route' || r.intent === 'fare') && !r.origin && !r.destination) return false;
        // POI lookup with no query → defer.
        if (r.intent === 'poi_lookup' && !r.poiQuery) return false;
        return true;
    }
}

export class FallbackRenderAdapter implements NaturalLanguageRenderAdapter {
    public constructor(
        private readonly primary: NaturalLanguageRenderAdapter,
        private readonly fallback: NaturalLanguageRenderAdapter
    ) { }

    public async renderNaturalLanguage(request: { prompt: string }): Promise<NaturalLanguageRenderResponse> {
        try {
            return await this.primary.renderNaturalLanguage(request);
        } catch {
            return this.fallback.renderNaturalLanguage(request);
        }
    }
}