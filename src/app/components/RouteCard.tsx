import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { QueryPipelineResult } from '../../core/pipeline/QueryPipeline';
import { colors } from '../theme';
import { SectionCard } from './SectionCard';
import { StatusChip } from './StatusChip';

export function RouteCard({ result }: { result: QueryPipelineResult }): React.JSX.Element {
    return (
        <SectionCard style={styles.card}>
            <View style={styles.row}>
                <Text style={styles.title}>Journey</Text>
                <StatusChip label={result.status.replace('_', ' ')} tone={result.status === 'complete' ? 'good' : result.status === 'needs_disambiguation' ? 'warn' : 'bad'} />
            </View>
            <Text style={styles.body}>{result.rendered?.text ?? 'No route summary available.'}</Text>
            {result.route ? <Text style={styles.meta}>Tube travel: {result.route.cost} minutes</Text> : null}
            {result.walking ? <Text style={styles.meta}>Walking: {result.walking.durationMinutes} minutes</Text> : null}
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
    disruption: {
        color: colors.warning,
        fontSize: 13,
        fontWeight: '600',
    },
});