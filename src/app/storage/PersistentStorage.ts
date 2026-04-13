import RNFS from 'react-native-fs';

const STATE_DIR = `${RNFS.DocumentDirectoryPath}/nav-aide-state`;

export interface PersistentStorage {
    read<T>(key: string): Promise<T | null>;
    write<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
}

function filePath(key: string): string {
    return `${STATE_DIR}/${key}.json`;
}

let dirReady = false;

async function ensureDir(): Promise<void> {
    if (dirReady) {
        return;
    }
    const exists = await RNFS.exists(STATE_DIR);
    if (!exists) {
        await RNFS.mkdir(STATE_DIR);
    }
    dirReady = true;
}

export function createPersistentStorage(): PersistentStorage {
    return {
        async read<T>(key: string): Promise<T | null> {
            try {
                const path = filePath(key);
                const exists = await RNFS.exists(path);
                if (!exists) {
                    return null;
                }
                const raw = await RNFS.readFile(path, 'utf8');
                return JSON.parse(raw) as T;
            } catch {
                return null;
            }
        },

        async write<T>(key: string, value: T): Promise<void> {
            await ensureDir();
            await RNFS.writeFile(filePath(key), JSON.stringify(value), 'utf8');
        },

        async remove(key: string): Promise<void> {
            try {
                await RNFS.unlink(filePath(key));
            } catch {
                // File may not exist — ignore.
            }
        },
    };
}
