import llama from 'llama.rn';

export interface LocalModelStatus {
    loaded: boolean;
    modelPath: string;
}

export class LocalModelManager {
    public async load(modelPath: string): Promise<LocalModelStatus> {
        void llama;
        return {
            loaded: false,
            modelPath,
        };
    }
}