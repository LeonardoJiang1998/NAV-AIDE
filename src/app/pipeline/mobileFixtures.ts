import busRoutes from '../../../assets/busRoutes.json';
import tubeGraph from '../../../assets/tubeGraph.json';
import type { POIRecord } from '../../core/poi/POIService';
import type { EntityRecord } from '../../core/pipeline/EntityResolver';
import type { WeightedGraph } from '../../core/routing/Dijkstra';
import type { DisruptionEvent } from '../../core/services/DisruptionService';

export const knownStations = tubeGraph.nodes.map((node) => node.name);

export const graph: WeightedGraph = {
    nodes: tubeGraph.nodes.map((node) => ({ id: node.id, name: node.name })),
    edges: tubeGraph.edges.map((edge) => ({ from: edge.from, to: edge.to, cost: edge.travelMinutes, lineId: edge.lineId })),
};

export const entities: EntityRecord[] = [
    ...tubeGraph.nodes.map((node) => ({
        id: node.id,
        canonicalName: node.name,
        type: 'station' as const,
        aliases: node.name === 'Green Park' ? ['Park'] : [],
    })),
    {
        id: 'british-museum',
        canonicalName: 'British Museum',
        type: 'poi' as const,
        aliases: ['The British Museum'],
    },
];

export const pois: POIRecord[] = [
    {
        id: 'british-museum',
        canonicalName: 'British Museum',
        category: 'museum',
        aliases: ['The British Museum'],
    },
];

export const disruptions: DisruptionEvent[] = [
    {
        id: 'jubilee-signal',
        summary: 'Minor delays on the Jubilee line between Westminster and Green Park.',
        affectedPlaceNames: ['Westminster', 'Green Park'],
        updatedAt: '2026-04-09T09:00:00.000Z',
    },
];

export const busRouteNames = busRoutes.routes.map((route) => route.displayName);
export const sampleDestinations = ['Baker Street', 'British Museum', 'Green Park'];

export const sampleDestinationPins: Record<string, { longitude: number; latitude: number }> = {
    'Baker Street': { longitude: -0.1571, latitude: 51.5226 },
    'British Museum': { longitude: -0.1269, latitude: 51.5194 },
    'Green Park': { longitude: -0.1425, latitude: 51.5067 },
};