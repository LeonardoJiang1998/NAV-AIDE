import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { SectionCard } from './SectionCard';

interface CollapsibleCardProps {
    title: string;
    subtitle?: string;
    initiallyExpanded?: boolean;
    children: React.ReactNode;
    /** Optional chip shown on the right of the header row. */
    headerRight?: React.ReactNode;
}

export function CollapsibleCard({
    title,
    subtitle,
    initiallyExpanded = false,
    children,
    headerRight,
}: CollapsibleCardProps): React.JSX.Element {
    const [expanded, setExpanded] = useState(initiallyExpanded);

    return (
        <SectionCard style={styles.card}>
            <Pressable onPress={() => setExpanded((v) => !v)} style={styles.header}>
                <View style={styles.titleColumn}>
                    <Text style={styles.title}>{title}</Text>
                    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
                <View style={styles.headerRight}>
                    {headerRight}
                    <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
                </View>
            </Pressable>
            {expanded ? <View style={styles.body}>{children}</View> : null}
        </SectionCard>
    );
}

const styles = StyleSheet.create({
    card: {
        gap: 0,
        paddingVertical: 0,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 0,
    },
    titleColumn: {
        flex: 1,
        gap: 2,
    },
    title: {
        color: colors.ink,
        fontSize: 15,
        fontWeight: '700',
    },
    subtitle: {
        color: colors.inkMuted,
        fontSize: 12,
    },
    headerRight: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    chevron: {
        color: colors.inkMuted,
        fontSize: 16,
        fontWeight: '700',
    },
    body: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.line,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 10,
    },
});
