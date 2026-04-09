export interface GraphNode {
    id: string;
    name: string;
}

export interface GraphEdge {
    from: string;
    to: string;
    cost: number;
    lineId?: string;
}

export interface WeightedGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface ShortestPathResult {
    cost: number;
    path: string[];
    visited: string[];
}

export class Dijkstra {
    public findShortestPath(graph: WeightedGraph, originId: string, destinationId: string): ShortestPathResult | null {
        if (originId === destinationId) {
            return { cost: 0, path: [originId], visited: [originId] };
        }

        const adjacency = this.buildAdjacency(graph.edges);
        const distances = new Map<string, number>();
        const previous = new Map<string, string | null>();
        const queue = new Set<string>(graph.nodes.map((node) => node.id));
        const visited: string[] = [];

        for (const node of graph.nodes) {
            distances.set(node.id, Number.POSITIVE_INFINITY);
            previous.set(node.id, null);
        }

        if (!queue.has(originId) || !queue.has(destinationId)) {
            return null;
        }

        distances.set(originId, 0);

        while (queue.size > 0) {
            const current = this.extractNearest(queue, distances);
            if (!current) {
                break;
            }

            queue.delete(current);
            visited.push(current);

            if (current === destinationId) {
                return {
                    cost: distances.get(current) ?? Number.POSITIVE_INFINITY,
                    path: this.reconstructPath(previous, destinationId),
                    visited,
                };
            }

            const edges = adjacency.get(current) ?? [];
            for (const edge of edges) {
                if (!queue.has(edge.to)) {
                    continue;
                }

                const currentDistance = distances.get(current) ?? Number.POSITIVE_INFINITY;
                const nextDistance = currentDistance + edge.cost;

                if (nextDistance < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
                    distances.set(edge.to, nextDistance);
                    previous.set(edge.to, current);
                }
            }
        }

        return null;
    }

    private buildAdjacency(edges: GraphEdge[]): Map<string, GraphEdge[]> {
        const adjacency = new Map<string, GraphEdge[]>();

        for (const edge of edges) {
            const forward = adjacency.get(edge.from) ?? [];
            forward.push(edge);
            adjacency.set(edge.from, forward);

            const reverse = adjacency.get(edge.to) ?? [];
            reverse.push({ ...edge, from: edge.to, to: edge.from });
            adjacency.set(edge.to, reverse);
        }

        return adjacency;
    }

    private extractNearest(queue: Set<string>, distances: Map<string, number>): string | null {
        let bestNode: string | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const nodeId of queue) {
            const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestNode = nodeId;
            }
        }

        return bestNode;
    }

    private reconstructPath(previous: Map<string, string | null>, destinationId: string): string[] {
        const path: string[] = [];
        let current: string | null = destinationId;

        while (current) {
            path.unshift(current);
            current = previous.get(current) ?? null;
        }

        return path;
    }
}