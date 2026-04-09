export interface DisruptionEvent {
    id: string;
    summary: string;
    affectedPlaceNames: string[];
    updatedAt: string;
}

export interface CachePolicy {
    key: string;
    maxAgeMs: number;
}

export interface DisruptionSource {
    fetch(placeNames: string[]): Promise<DisruptionEvent[]>;
}

export class CacheAwareDisruptionService {
    private readonly cache = new Map<string, { expiresAt: number; value: DisruptionEvent[] }>();

    public constructor(private readonly source: DisruptionSource, private readonly now: () => number = () => Date.now()) { }

    public async getDisruptions(placeNames: string[], policy: CachePolicy): Promise<DisruptionEvent[]> {
        const cached = this.cache.get(policy.key);
        const currentTime = this.now();

        if (cached && cached.expiresAt > currentTime) {
            return cached.value;
        }

        const value = await this.source.fetch(placeNames);
        this.cache.set(policy.key, { expiresAt: currentTime + policy.maxAgeMs, value });
        return value;
    }
}

export class StaticDisruptionSource implements DisruptionSource {
    public constructor(private readonly events: DisruptionEvent[]) { }

    public async fetch(placeNames: string[]): Promise<DisruptionEvent[]> {
        return this.events.filter((event) => event.affectedPlaceNames.some((name) => placeNames.includes(name)));
    }
}