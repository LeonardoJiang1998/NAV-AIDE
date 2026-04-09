import { StyleSheet } from 'react-native';

import { colors } from '../theme';

export const shellStyles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#f0eadf',
        gap: 18,
        padding: 20,
    },
    title: {
        color: colors.ink,
        fontSize: 28,
        fontWeight: '800',
    },
    copy: {
        color: colors.rail,
        fontSize: 14,
        lineHeight: 20,
    },
    card: {
        backgroundColor: '#fffaf1',
        borderColor: colors.line,
        borderRadius: 20,
        borderWidth: 1,
        gap: 10,
        padding: 18,
    },
});