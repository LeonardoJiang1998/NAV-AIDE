import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

export function StatusChip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }): React.JSX.Element {
    const palette = {
        neutral: { backgroundColor: '#ece4d7', color: colors.ink },
        good: { backgroundColor: '#cfe8de', color: colors.accent },
        warn: { backgroundColor: '#f1ddc1', color: colors.warning },
        bad: { backgroundColor: '#f3d8d0', color: '#8f3628' },
    }[tone];

    return (
        <View style={[styles.chip, { backgroundColor: palette.backgroundColor }]}>
            <Text style={[styles.text, { color: palette.color }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    chip: {
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    text: {
        fontSize: 12,
        fontWeight: '700',
    },
});