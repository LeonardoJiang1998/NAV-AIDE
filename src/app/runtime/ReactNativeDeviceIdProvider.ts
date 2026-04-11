import RNFS from 'react-native-fs';

import type { DeviceIdProvider } from '../../core/runtime/DeviceIdContracts';

const DEVICE_ID_FILE = 'nav-aide/device-id.txt';

export class ReactNativeDeviceIdProvider implements DeviceIdProvider {
    private cachedId: string | null = null;

    public async getDeviceId(): Promise<string> {
        if (this.cachedId) {
            return this.cachedId;
        }

        const filePath = `${RNFS.DocumentDirectoryPath}/${DEVICE_ID_FILE}`;
        const parentDirectory = filePath.split('/').slice(0, -1).join('/');

        const exists = await RNFS.exists(filePath);
        if (exists) {
            const storedId = (await RNFS.readFile(filePath, 'utf8')).trim();
            this.cachedId = storedId;
            return storedId;
        }

        const generated = createLocalDeviceId();
        await RNFS.mkdir(parentDirectory);
        await RNFS.writeFile(filePath, generated, 'utf8');
        this.cachedId = generated;
        return generated;
    }
}

function createLocalDeviceId() {
    const seed = `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
    let hash = 2166136261;

    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return `rn-${(hash >>> 0).toString(16).padStart(8, '0')}-${seed.replace(/[^a-z0-9]+/gi, '').slice(0, 12)}`;
}