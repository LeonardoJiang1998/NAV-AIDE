export interface StructuredIntentModelRequest {
    prompt: string;
    schema: object;
}

export interface StructuredIntentModelAdapter {
    generateStructured<T>(request: StructuredIntentModelRequest): Promise<T>;
}

export interface NaturalLanguageRenderRequest {
    prompt: string;
}

export interface NaturalLanguageRenderResponse {
    text: string;
    referencedPlaceNames: string[];
}

export interface NaturalLanguageRenderAdapter {
    renderNaturalLanguage(request: NaturalLanguageRenderRequest): Promise<NaturalLanguageRenderResponse>;
}