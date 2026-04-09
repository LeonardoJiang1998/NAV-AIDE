import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/app/navigation/AppNavigator';
import { AppShellProvider } from './src/app/state/AppShellContext';

function App(): React.JSX.Element {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <StatusBar barStyle="dark-content" />
                <AppShellProvider>
                    <AppNavigator />
                </AppShellProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

export default App;