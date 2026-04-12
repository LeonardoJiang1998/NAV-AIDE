import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { QueryPipelineResult } from '../../core/pipeline/QueryPipeline';
import { colors } from '../theme';
import { SectionCard } from './SectionCard';
import { StatusChip } from './StatusChip';

function formatLineName(lineId: string): string {
    if (lineId === 'walking-transfer') {
        return 'Walking transfer';
    }
    if (lineId === 'unknown') {
        return 'Unknown line';
    }
    return `${lineId.charAt(0).toUpperCase()}${lineId.slice(1)} line`;
}

export function RouteCard({ result }: { result: QueryPipelineResult }): React.JSX.Element {
    const segments = result.tubeSegments ?? [];
    const walking = result.walking;

    return (
        <SectionCard style={styles.card}>
            <View style={styles.row}>
                <Text style={styles.title}>Journey</Text>
                <StatusChip label={result.status.replace('_', ' ')} tone={result.status === 'complete' ? 'good' : result.status === 'needs_disambiguation' ? 'warn' : 'bad'} />
            </View>
            <Text style={styles.body}>{result.rendered?.text ?? 'No route summary available.'}</Text>
            {result.route ? <Text style={styles.meta}>Total tube travel: {result.route.cost} minutes</Text> : null}

            {segments.length > 0 ? (
                <View style={styles.segmentBlock}>
                    <Text style={styles.sectionHeader}>Steps</Text>
                    {segments.map((segment, index) => (
                        <View key={`${segment.lineId}-${index}`} style={styles.segment}>
                            <Text style={styles.segmentLine}>{index + 1}. {formatLineName(segment.lineId)}</Text>
                            <Text style={styles.segmentPath}>{segment.stations.join(' → ')}</Text>
                        </View>
                    ))}
                </View>
            ) : null}

            {walking ? (
                <View style={styles.walkingBlock}>
                    <Text style={styles.sectionHeader}>Walking</Text>
                    {walking.status === 'ok' ? (
                        <>
                            <Text style={styles.meta}>{walking.distanceMeters} m · {walking.durationMinutes} min</Text>
                            {walking.instructions.map((instruction, index) => (
                                <Text key={index} style={styles.meta}>• {instruction}</Text>
                            ))}
                        </>
                    ) : (
                        <Text style={styles.meta}>Walking directions unavailable — offline routing tiles (Valhalla) are not installed on this device.</Text>
                    )}
                </View>
            ) : null}

            {result.disruptions.map((disruption) => (
                <Text key={disruption.id} style={styles.disruption}>{disruption.summary}</Text>
            ))}
        </SectionCard>
    );
}

const styles = StyleSheet.create({
    card: {
        gap: 10,
    },
    row: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    title: {
        color: colors.ink,
        fontSize: 18,
        fontWeight: '700',
    },
    body: {
        color: colors.ink,
        fontSize: 15,
    },
    meta: {
        color: colors.rail,
        fontSize: 13,
    },
    sectionHeader: {
        color: colors.ink,
        fontSize: 14,
        fontWeight: '700',
        marginTop: 4,
    },
    segmentBlock: {
        gap: 8,
    },
    segment: {
        gap: 2,
    },
    segmentLine: {
        color: colors.ink,
        fontSize: 14,
        fontWeight: '600',
    },
    segmentPath: {
        color: colors.rail,
        fontSize: 13,
    },
    walkingBlock: {
        gap: 4,
    },
    disruption: {
        color: colors.warning,
        fontSize: 13,
        fontWeight: '600',
    },
});