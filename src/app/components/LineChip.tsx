import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getTubeLineStyle } from '../theme';

export interface LineChipProps {
    lineId: string;
    size?: 'small' | 'medium';
}

/**
 * A pill chip rendering a TfL line name in its official brand colour.
 */
export function LineChip({ lineId, size = 'medium' }: LineChipProps): React.JSX.Element {
    const style = getTubeLineStyle(lineId);
    const sizing = size === 'small' ? styles.chipSmall : styles.chipMedium;
    const textSizing = size === 'small' ? styles.textSmall : styles.textMedium;

    return (
        <View style={[styles.chip, sizing, { backgroundColor: style.hex }]}>
            <Text style={[styles.text, textSizing, { color: style.ink }]}>{style.displayName}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    chip: {
        alignSelf: 'flex-start',
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
    },
    chipSmall: {
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    chipMedium: {
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    text: {
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    textSmall: {
        fontSize: 11,
    },
    textMedium: {
        fontSize: 13,
    },
});
