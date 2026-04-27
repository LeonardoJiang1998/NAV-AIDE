import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { GoScreen } from '../screens/GoScreen';
import { LostScreen } from '../screens/LostScreen';
import { MapsScreen } from '../screens/MapsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

// DEV-only navigation ref so the remote debugger / scripts can drive the
// active tab via globalThis.__NAVAIDE_NAV_REF.navigate('Maps') etc. Used by
// scripts/dev/remote-ask.mjs and the autonomous build-loop tooling.
export const navigationRef = createNavigationContainerRef();
if (__DEV__) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__NAVAIDE_NAV_REF = navigationRef;
}

export function AppNavigator(): React.JSX.Element {
    return (
        <NavigationContainer ref={navigationRef}>
            <Tab.Navigator
                screenOptions={{
                    headerStyle: { backgroundColor: colors.paper },
                    headerTintColor: colors.ink,
                    sceneStyle: { backgroundColor: '#f0eadf' },
                    tabBarStyle: { backgroundColor: colors.rail, borderTopColor: 'transparent', height: 68, paddingBottom: 8 },
                    tabBarActiveTintColor: '#f8f3e8',
                    tabBarInactiveTintColor: '#b7cec5',
                }}
            >
                <Tab.Screen name="GO" component={GoScreen} />
                <Tab.Screen name="LOST?" component={LostScreen} />
                <Tab.Screen name="Maps" component={MapsScreen} />
                <Tab.Screen name="Settings" component={SettingsScreen} />
            </Tab.Navigator>
        </NavigationContainer>
    );
}