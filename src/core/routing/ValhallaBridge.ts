export interface WalkingRouteRequest {
    originName: string;
    destinationName: string;
}

export interface WalkingRouteResult {
    status: 'ok' | 'asset-unavailable';
    distanceMeters: number;
    durationMinutes: number;
    instructions: string[];
}

export interface OfflineWalkingRouter {
    route(request: WalkingRouteRequest): Promise<WalkingRouteResult>;
}

export class ValhallaBridge {
    public constructor(private readonly router: OfflineWalkingRouter) { }

    public route(request: WalkingRouteRequest): Promise<WalkingRouteResult> {
        return this.router.route(request);
    }
}

export class AssetAwareWalkingRouter implements OfflineWalkingRouter {
    public constructor(private readonly assetsAvailable: boolean) { }

    public async route(request: WalkingRouteRequest): Promise<WalkingRouteResult> {
        if (!this.assetsAvailable) {
            return {
                status: 'asset-unavailable',
                distanceMeters: 0,
                durationMinutes: 0,
                instructions: [`Offline walking graph unavailable for ${request.originName} to ${request.destinationName}.`],
            };
        }

        return {
            status: 'ok',
            distanceMeters: 500,
            durationMinutes: 7,
            instructions: [`Walk from ${request.originName} to ${request.destinationName}.`],
        };
    }
}