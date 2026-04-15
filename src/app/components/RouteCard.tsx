import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { QueryPipelineResult } from '../../core/pipeline/QueryPipeline';
import type { TubeSegment } from '../../core/pipeline/TubeGraphTransforms';
import { colors, getTubeLineStyle } from '../theme';
import { LineChip } from './LineChip';
import { SectionCard } from './SectionCard';
import { StatusChip } from './StatusChip';

export function RouteCard({ result }: { result: QueryPipelineResult }): React.JSX.Element {
    const segments = result.tubeSegments ?? [];
    const walking = result.walking;
    const totalStops = segments.reduce((acc, seg) => acc + Math.max(0, seg.stations.length - 1), 0);
    const interchanges = Math.max(0, segments.length - 1);

    return (
        <SectionCard style={styles.card}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Journey</Text>
                <StatusChip
                    label={result.status.replace('_', ' ')}
                    tone={statusTone(result.status)}
                />
            </View>

            <Text style={styles.body}>{result.rendered?.text ?? 'No route summary available.'}</Text>

            {result.route ? (
                <View style={styles.summaryGrid}>
                    <SummaryMetric label="Travel time" value={`${result.route.cost} min`} />
                    <SummaryMetric label="Stops" value={`${totalStops}`} />
                    <SummaryMetric label="Changes" value={`${interchanges}`} />
                </View>
            ) : null}

            {segments.length > 0 ? (
                <View style={styles.segmentBlock}>
                    <Text style={styles.sectionHeader}>Steps</Text>
                    {segments.map((segment, index) => (
                        <SegmentRow
                            key={`${segment.lineId}-${index}`}
                            segment={segment}
                            stepNumber={index + 1}
                            isLast={index === segments.length - 1}
                        />
                    ))}
                </View>
            ) : null}

            {walking ? (
                <View style={styles.walkingBlock}>
                    <Text style={styles.sectionHeader}>Walking</Text>
                    {walking.status === 'ok' ? (
                        <>
                            <Text style={styles.meta}>
                                {walking.distanceMeters} m · {walking.durationMinutes} min
                            </Text>
                            {walking.instructions.map((instruction, index) => (
                                <Text key={index} style={styles.meta}>
                                    • {instruction}
                                </Text>
                            ))}
                        </>
                    ) : (
                        <Text style={styles.meta}>
                            Walking directions unavailable — offline routing tiles (Valhalla) are not installed on this
                            device.
                        </Text>
                    )}
                </View>
            ) : null}

            {result.disruptions.length > 0 ? (
                <View style={styles.disruptionBlock}>
                    <Text style={styles.sectionHeader}>Disruptions</Text>
                    {result.disruptions.map((disruption) => (
                        <Text key={disruption.id} style={styles.disruption}>
                            ⚠︎ {disruption.summary}
                        </Text>
                    ))}
                </View>
            ) : null}
        </SectionCard>
    );
}

function SegmentRow({
    segment,
    stepNumber,
    isLast,
}: {
    segment: TubeSegment;
    stepNumber: number;
    isLast: boolean;
}): React.JSX.Element {
    const style = getTubeLineStyle(segment.lineId);
    const hops = Math.max(0, segment.stations.length - 1);
    const fromStation = segment.stations[0];
    const toStation = segment.stations[segment.stations.length - 1];

    return (
        <View style={styles.segment}>
            <View style={styles.segmentHeader}>
                <View style={[styles.stepDot, { backgroundColor: style.hex }]}>
                    <Text style={[styles.stepDotText, { color: style.ink }]}>{stepNumber}</Text>
                </View>
                <LineChip lineId={segment.lineId} />
                <Text style={styles.hopText}>
                    {hops} {hops === 1 ? 'stop' : 'stops'}
                </Text>
            </View>
            <Text style={styles.fromTo}>
                <Text style={styles.stationName}>{fromStation}</Text>
                <Text style={styles.arrow}> → </Text>
                <Text style={styles.stationName}>{toStation}</Text>
            </Text>
            {segment.stations.length > 2 ? (
                <Text style={styles.viaText}>via {segment.stations.slice(1, -1).join(' · ')}</Text>
            ) : null}
            {!isLast ? <Text style={styles.changeHint}>Change here</Text> : null}
        </View>
    );
}

function SummaryMetric({ label, value }: { label: string; value: string }): React.JSX.Element {
    return (
        <View style={styles.metric}>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
        </View>
    );
}

function statusTone(status: string): 'good' | 'warn' | 'bad' {
    if (status === 'complete') return 'good';
    if (status === 'needs_disambiguation') return 'warn';
    return 'bad';
}

const styles = StyleSheet.create({
    card: {
        gap: 12,
    },
    headerRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    title: {
        color: colors.ink,
        fontSize: 20,
        fontWeight: '800',
    },
    body: {
        color: colors.ink,
        fontSize: 15,
        lineHeight: 21,
    },
    summaryGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 4,
    },
    metric: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: colors.paperSunken,
        paddingVertical: 10,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    metricValue: {
        color: colors.ink,
        fontSize: 20,
        fontWeight: '700',
    },
    metricLabel: {
        color: colors.inkMuted,
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginTop: 2,
    },
    sectionHeader: {
        color: colors.ink,
        fontSize: 14,
        fontWeight: '700',
        marginTop: 4,
        marginBottom: 2,
    },
    segmentBlock: {
        gap: 12,
    },
    segment: {
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: colors.paperSunken,
    },
    segmentHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    stepDot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepDotText: {
        fontSize: 13,
        fontWeight: '800',
    },
    hopText: {
        color: colors.inkMuted,
        fontSize: 12,
        fontWeight: '600',
    },
    fromTo: {
        marginTop: 4,
    },
    stationName: {
        color: colors.ink,
        fontSize: 15,
        fontWeight: '700',
    },
    arrow: {
        color: colors.inkMuted,
        fontSize: 15,
    },
    viaText: {
        color: colors.inkMuted,
        fontSize: 12,
        fontStyle: 'italic',
    },
    changeHint: {
        color: colors.accent,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    meta: {
        color: colors.rail,
        fontSize: 13,
    },
    walkingBlock: {
        gap: 4,
    },
    disruptionBlock: {
        gap: 4,
        marginTop: 6,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.line,
        paddingTop: 10,
    },
    disruption: {
        color: colors.warning,
        fontSize: 13,
        fontWeight: '600',
    },
});
