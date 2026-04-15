import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

interface StationSuggestionsProps {
    stations: string[];
    query: string;
    onPick(station: string): void;
    limit?: number;
}

/**
 * Lightweight inline autocomplete for tube stations. Filters the known-station
 * list by prefix + substring match against the current query and surfaces
 * up to `limit` results as pills the user can tap.
 */
export function StationSuggestions({
    stations,
    query,
    onPick,
    limit = 8,
}: StationSuggestionsProps): React.JSX.Element | null {
    const suggestions = useMemo(() => {
        const needle = extractStationNeedle(query).trim().toLowerCase();
        if (needle.length < 2) return [];

        const seen = new Set<string>();
        const prefixHits: string[] = [];
        const substringHits: string[] = [];

        for (const station of stations) {
            if (seen.has(station)) continue;
            const lower = station.toLowerCase();
            if (lower.startsWith(needle)) {
                prefixHits.push(station);
                seen.add(station);
            } else if (lower.includes(needle)) {
                substringHits.push(station);
                seen.add(station);
            }
            if (prefixHits.length + substringHits.length >= limit * 2) break;
        }

        return [...prefixHits, ...substringHits].slice(0, limit);
    }, [stations, query, limit]);

    if (suggestions.length === 0) return null;

    return (
        <View style={styles.wrapper}>
            <Text style={styles.header}>Station suggestions</Text>
            <View style={styles.row}>
                {suggestions.map((station) => (
                    <Pressable key={station} onPress={() => onPick(station)} style={styles.pill}>
                        <Text style={styles.pillText}>{station}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

/**
 * Pull the most likely station fragment out of a free-text query.
 * - After "to ", use the text after "to".
 * - After "from ", use the text before the next " to ".
 * - Otherwise use the last word of the query (if ≥2 chars).
 */
function extractStationNeedle(query: string): string {
    const trimmed = query.trim();
    if (trimmed.length === 0) return '';

    const toMatch = trimmed.match(/\bto\s+([^?\n]+?)$/i);
    if (toMatch) return toMatch[1];

    const fromMatch = trimmed.match(/\bfrom\s+([^?\n]+?)(?:\s+to\s+|$)/i);
    if (fromMatch) return fromMatch[1];

    const lastWord = trimmed.split(/\s+/).pop();
    if (lastWord && lastWord.length >= 2) return lastWord;
    return trimmed;
}

const styles = StyleSheet.create({
    wrapper: {
        gap: 6,
    },
    header: {
        color: colors.inkMuted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    pill: {
        backgroundColor: colors.paperSunken,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.line,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    pillText: {
        color: colors.ink,
        fontSize: 13,
        fontWeight: '600',
    },
});
