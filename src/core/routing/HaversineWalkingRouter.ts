/**
 * Real walking router backed by great-circle (Haversine) distance estimation.
 *
 * This is not a street-network router — it does not avoid rivers or traffic-
 * free paths — but for MVP tourist use it gives us an always-available
 * walking estimate instead of the "offline walking graph unavailable" dead
 * end. When Valhalla tile integration lands it can replace this; the
 * contract (distanceMeters, durationMinutes, instructions) is the same.
 *
 * Assumptions:
 *   - Average tourist walking speed: 4.8 km/h ≈ 80 m/min.
 *   - We pad by 20% to account for the real path being longer than the
 *     great-circle distance (streets don't go through buildings).
 */

import type {
    OfflineWalkingRouter,
    WalkingRouteRequest,
    WalkingRouteResult,
} from './ValhallaBridge';

export interface GeoPoint {
    lat: number;
    lon: number;
}

export interface PlaceCoordinateProvider {
    findCoordinate(name: string): GeoPoint | null;
}

const WALKING_METERS_PER_MINUTE = 80; // ~4.8 km/h
const GREAT_CIRCLE_PADDING = 1.2; // 20% padding for street network detours
const LONG_WALK_THRESHOLD_METERS = 2000;
const TRANSIT_SUGGESTION_THRESHOLD_METERS = 1500;

export class HaversineWalkingRouter implements OfflineWalkingRouter {
    public constructor(private readonly coordinateProvider: PlaceCoordinateProvider) {}

    public async route(request: WalkingRouteRequest): Promise<WalkingRouteResult> {
        const origin = this.coordinateProvider.findCoordinate(request.originName);
        const destination = this.coordinateProvider.findCoordinate(request.destinationName);

        if (!origin || !destination) {
            return {
                status: 'asset-unavailable',
                distanceMeters: 0,
                durationMinutes: 0,
                instructions: [
                    buildMissingCoordsMessage(request, origin, destination),
                ],
            };
        }

        const greatCircle = haversineMeters(origin, destination);
        const distanceMeters = Math.round(greatCircle * GREAT_CIRCLE_PADDING);
        const durationMinutes = Math.max(1, Math.round(distanceMeters / WALKING_METERS_PER_MINUTE));

        const instructions: string[] = [];
        instructions.push(
            `Walk approximately ${formatDistance(distanceMeters)} (~${durationMinutes} min) from ${request.originName} to ${request.destinationName}.`,
        );
        instructions.push(
            `Head ${bearingLabel(origin, destination)} from ${request.originName}.`,
        );
        if (distanceMeters > TRANSIT_SUGGESTION_THRESHOLD_METERS) {
            instructions.push(
                distanceMeters > LONG_WALK_THRESHOLD_METERS
                    ? 'This is a long walk — consider taking the tube or a bus for part of the journey.'
                    : 'You may prefer to take a short tube or bus hop instead.',
            );
        }
        instructions.push(
            'Offline estimate based on great-circle distance + 20% street padding. Street-level walking tiles will refine this further.',
        );

        return {
            status: 'ok',
            distanceMeters,
            durationMinutes,
            instructions,
        };
    }
}

function buildMissingCoordsMessage(
    request: WalkingRouteRequest,
    origin: GeoPoint | null,
    destination: GeoPoint | null,
): string {
    if (!origin && !destination) {
        return `Walking estimate unavailable: neither ${request.originName} nor ${request.destinationName} has known coordinates in the offline index.`;
    }
    const missing = !origin ? request.originName : request.destinationName;
    return `Walking estimate unavailable: ${missing} has no known coordinates in the offline index.`;
}

function haversineMeters(a: GeoPoint, b: GeoPoint): number {
    const R = 6371000;
    const dLat = toRadians(b.lat - a.lat);
    const dLon = toRadians(b.lon - a.lon);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
}

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

function bearingLabel(a: GeoPoint, b: GeoPoint): string {
    const dLon = toRadians(b.lon - a.lon);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
        Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const theta = Math.atan2(y, x);
    const degrees = ((theta * 180) / Math.PI + 360) % 360;
    const directions = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
}

function formatDistance(meters: number): string {
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}
