import { createHash } from 'node:crypto';

export class DeviceID {
    public static fromSeed(seed: string): string {
        return createHash('sha256').update(seed).digest('hex').slice(0, 24);
    }
}