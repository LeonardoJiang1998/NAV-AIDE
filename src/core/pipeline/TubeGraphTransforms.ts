import type { WeightedGraph } from '../routing/Dijkstra';
import type { TubeGraphAsset } from '../runtime/OfflineRuntimeContracts';

export interface TubeSegment {
    lineId: string;
    stations: string[];
}

export function buildWeightedGraphFromTubeAsset(asset: TubeGraphAsset): WeightedGraph {
    return {
        nodes: asset.nodes.map((node) => ({ id: node.id, name: node.name })),
        edges: asset.edges.map((edge) => ({ from: edge.from, to: edge.to, cost: edge.travelMinutes, lineId: edge.lineId })),
    };
}

export function deriveKnownStations(asset: TubeGraphAsset): string[] {
    return asset.nodes.map((node) => node.name);
}

export function buildTubeSegments(path: string[], graph: WeightedGraph): TubeSegment[] {
    if (path.length < 2) {
        return [];
    }

    const lineByEdge = new Map<string, string>();
    for (const edge of graph.edges) {
        const lineId = edge.lineId ?? 'unknown';
        lineByEdge.set(`${edge.from}::${edge.to}`, lineId);
        lineByEdge.set(`${edge.to}::${edge.from}`, lineId);
    }

    const nameById = new Map(graph.nodes.map((node) => [node.id, node.name]));
    const resolveName = (id: string): string => nameById.get(id) ?? id;

    const segments: TubeSegment[] = [];
    let current: TubeSegment | null = null;

    for (let index = 0; index < path.length - 1; index += 1) {
        const from = path[index];
        const to = path[index + 1];
        const lineId = lineByEdge.get(`${from}::${to}`) ?? 'unknown';

        if (!current || current.lineId !== lineId) {
            if (current) {
                segments.push(current);
            }
            current = { lineId, stations: [resolveName(from), resolveName(to)] };
        } else {
            current.stations.push(resolveName(to));
        }
    }

    if (current) {
        segments.push(current);
    }

    return segments;
}
