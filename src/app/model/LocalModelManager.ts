import { initLlama } from 'llama.rn';

interface LlamaContextLike {
    completion(params: {
        prompt?: string;
        messages?: Array<{ role: string; content: string }>;
        n_predict?: number;
        temperature?: number;
        response_format?: object;
    }): Promise<{ text: string; content: string }>;
}

export interface LocalModelStatus {
    loaded: boolean;
    modelPath: string;
    backend: 'llama.rn';
    failureReason?: string;
}

export class LocalModelManager {
    private context: LlamaContextLike | null = null;
    private modelPath: string | null = null;

    public async load(modelPath: string): Promise<LocalModelStatus> {
        try {
            console.log('[LocalModelManager] Loading model from:', modelPath);
            await this.getContext(modelPath);
            console.log('[LocalModelManager] Model LOADED successfully:', modelPath);
            return {
                loaded: true,
                modelPath,
                backend: 'llama.rn',
            };
        } catch (error) {
            const reason = error instanceof Error ? error.message : 'Unknown llama.rn initialization failure';
            console.log('[LocalModelManager] Model load FAILED:', reason);
            return {
                loaded: false,
                modelPath,
                backend: 'llama.rn',
                failureReason: reason,
            };
        }
    }

    public async getContext(modelPath: string): Promise<LlamaContextLike> {
        if (this.context && this.modelPath === modelPath) {
            return this.context;
        }

        this.context = await initLlama({
            model: modelPath,
            n_ctx: 2048,
            n_gpu_layers: 0,
        }) as unknown as LlamaContextLike;
        this.modelPath = modelPath;
        return this.context;
    }
}