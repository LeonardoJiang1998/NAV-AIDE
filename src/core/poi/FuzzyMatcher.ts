export interface FuzzyMatchResult<T> {
    item: T;
    score: number;
    matchedValue: string;
}

export class FuzzyMatcher {
    public normalize(input: string): string {
        return input
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    public score(query: string, candidate: string): number {
        const normalizedQuery = this.normalize(query);
        const normalizedCandidate = this.normalize(candidate);

        if (!normalizedQuery || !normalizedCandidate) {
            return 0;
        }

        if (normalizedQuery === normalizedCandidate) {
            return 1;
        }

        if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
            return 0.9;
        }

        const distance = this.levenshtein(normalizedQuery, normalizedCandidate);
        const length = Math.max(normalizedQuery.length, normalizedCandidate.length);
        const similarity = length === 0 ? 0 : 1 - distance / length;

        const queryTokens = new Set(normalizedQuery.split(' '));
        const candidateTokens = new Set(normalizedCandidate.split(' '));
        let overlap = 0;
        for (const token of queryTokens) {
            if (candidateTokens.has(token)) {
                overlap += 1;
            }
        }

        const tokenScore = overlap / Math.max(queryTokens.size, candidateTokens.size);
        return Math.max(0, Number(((similarity * 0.7) + (tokenScore * 0.3)).toFixed(4)));
    }

    public rank<T>(query: string, items: T[], extractor: (item: T) => string[]): FuzzyMatchResult<T>[] {
        const results: FuzzyMatchResult<T>[] = [];

        for (const item of items) {
            let bestValue = '';
            let bestScore = 0;

            for (const value of extractor(item)) {
                const score = this.score(query, value);
                if (score > bestScore) {
                    bestScore = score;
                    bestValue = value;
                }
            }

            results.push({ item, score: bestScore, matchedValue: bestValue });
        }

        return results.sort((left, right) => right.score - left.score);
    }

    private levenshtein(left: string, right: string): number {
        const matrix: number[][] = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

        for (let row = 0; row <= left.length; row += 1) {
            matrix[row][0] = row;
        }

        for (let column = 0; column <= right.length; column += 1) {
            matrix[0][column] = column;
        }

        for (let row = 1; row <= left.length; row += 1) {
            for (let column = 1; column <= right.length; column += 1) {
                const cost = left[row - 1] === right[column - 1] ? 0 : 1;
                matrix[row][column] = Math.min(
                    matrix[row - 1][column] + 1,
                    matrix[row][column - 1] + 1,
                    matrix[row - 1][column - 1] + cost
                );
            }
        }

        return matrix[left.length][right.length];
    }
}