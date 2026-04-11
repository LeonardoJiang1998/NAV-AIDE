import type { WeightedGraph } from '../routing/Dijkstra';
import type { TubeGraphAsset } from '../runtime/OfflineRuntimeContracts';

export function buildWeightedGraphFromTubeAsset(asset: TubeGraphAsset): WeightedGraph {
    return {
        nodes: asset.nodes.map((node) => ({ id: node.id, name: node.name })),
        edges: asset.edges.map((edge) => ({ from: edge.from, to: edge.to, cost: edge.travelMinutes, lineId: edge.lineId })),
    };
}

export function deriveKnownStations(asset: TubeGraphAsset): string[] {
    return asset.nodes.map((node) => node.name);
}