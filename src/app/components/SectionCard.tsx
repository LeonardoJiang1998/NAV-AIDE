import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors } from '../theme';

export function SectionCard(props: ViewProps): React.JSX.Element {
    return <View {...props} style={[styles.card, props.style]} />;
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fffaf1',
        borderColor: colors.line,
        borderRadius: 20,
        borderWidth: 1,
        gap: 10,
        padding: 18,
    },
});