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