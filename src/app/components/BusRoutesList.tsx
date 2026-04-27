import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import busRoutesAsset from '../../../assets/busRoutes.json';
import { colors } from '../theme';

interface BusRoute {
    routeId: string;
    displayName: string;
    stops: string[];
}

interface BusRoutesAsset {
    routes: BusRoute[];
}

interface BusRoutesListProps {
    onStopPress: (stopName: string) => void;
}

/**
 * Compact list of bundled London bus routes. The MVP ships 29 tourist-relevant
 * routes (22 day + 7 Night Bus) seeded from `assets/busRoutes.json`. Tapping a
 * route reveals its stop list; tapping a stop stages it for the GO flow.
 */
export function BusRoutesList({ onStopPress }: BusRoutesListProps): React.JSX.Element {
    const data = busRoutesAsset as unknown as BusRoutesAsset;
    const routes = useMemo(() => data.routes ?? [], [data]);
    const [expanded, setExpanded] = useState<string | null>(null);

    const dayRoutes = routes.filter((r) => !/N\d/i.test(r.routeId));
    const nightRoutes = routes.filter((r) => /N\d/i.test(r.routeId));

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Bus routes</Text>
            <Text style={styles.copy}>
                {dayRoutes.length} day routes · {nightRoutes.length} night routes. Tap a number to see stops, then a stop to stage it for GO.
            </Text>
            <Text style={styles.subheading}>Daytime</Text>
            <View style={styles.chipRow}>
                {dayRoutes.map((route) => (
                    <RouteChip
                        key={route.routeId}
                        route={route}
                        isExpanded={expanded === route.routeId}
                        onToggle={() => setExpanded((cur) => (cur === route.routeId ? null : route.routeId))}
                    />
                ))}
            </View>
            {nightRoutes.length > 0 ? (
                <>
                    <Text style={styles.subheading}>Night Bus</Text>
                    <View style={styles.chipRow}>
                        {nightRoutes.map((route) => (
                            <RouteChip
                                key={route.routeId}
                                route={route}
                                isExpanded={expanded === route.routeId}
                                onToggle={() => setExpanded((cur) => (cur === route.routeId ? null : route.routeId))}
                                isNight
                            />
                        ))}
                    </View>
                </>
            ) : null}
            {expanded ? (
                <ExpandedRoute
                    route={routes.find((r) => r.routeId === expanded) ?? null}
                    onStopPress={onStopPress}
                />
            ) : null}
        </View>
    );
}

function RouteChip({
    route,
    isExpanded,
    onToggle,
    isNight,
}: {
    route: BusRoute;
    isExpanded: boolean;
    onToggle: () => void;
    isNight?: boolean;
}): React.JSX.Element {
    return (
        <Pressable
            onPress={onToggle}
            style={[
                styles.chip,
                isNight ? styles.chipNight : null,
                isExpanded ? styles.chipActive : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Bus route ${route.routeId}`}
            accessibilityHint={`Shows the stops on the ${route.displayName} route`}
            accessibilityState={{ expanded: isExpanded }}
        >
            <Text
                style={[
                    styles.chipText,
                    isNight ? styles.chipTextNight : null,
                    isExpanded ? styles.chipTextActive : null,
                ]}
            >
                {route.routeId}
            </Text>
        </Pressable>
    );
}

function ExpandedRoute({
    route,
    onStopPress,
}: {
    route: BusRoute | null;
    onStopPress: (stopName: string) => void;
}): React.JSX.Element | null {
    if (!route) return null;
    return (
        <View style={styles.expanded}>
            <Text style={styles.expandedHeading}>{route.displayName}</Text>
            <View style={styles.stopsRow}>
                {route.stops.map((stop, index) => (
                    <Pressable
                        key={`${route.routeId}-${index}-${stop}`}
                        onPress={() => onStopPress(stop)}
                        style={styles.stopPill}
                        accessibilityRole="button"
                        accessibilityLabel={`Stage ${stop} for GO`}
                    >
                        <Text style={styles.stopText}>{stop}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 8,
    },
    heading: {
        color: colors.ink,
        fontSize: 16,
        fontWeight: '700',
    },
    subheading: {
        color: colors.inkMuted,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.6,
        marginTop: 4,
        textTransform: 'uppercase',
    },
    copy: {
        color: colors.inkMuted,
        fontSize: 13,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        backgroundColor: '#dc241f', // TfL bus red
        borderRadius: 6,
        minWidth: 44,
        paddingHorizontal: 10,
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipNight: {
        backgroundColor: '#1c2c4f', // Night Bus navy
    },
    chipActive: {
        backgroundColor: colors.accent,
    },
    chipText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
    },
    chipTextNight: {
        color: '#fff',
    },
    chipTextActive: {
        color: '#fffaf1',
    },
    expanded: {
        backgroundColor: colors.paperSunken,
        borderRadius: 12,
        gap: 6,
        marginTop: 6,
        padding: 10,
    },
    expandedHeading: {
        color: colors.ink,
        fontSize: 14,
        fontWeight: '700',
    },
    stopsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    stopPill: {
        backgroundColor: colors.paperRaised,
        borderColor: colors.line,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    stopText: {
        color: colors.ink,
        fontSize: 12,
        fontWeight: '600',
    },
});
