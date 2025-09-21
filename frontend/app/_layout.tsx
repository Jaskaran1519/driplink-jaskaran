import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { Provider } from 'react-redux';
import { store } from '@/redux/store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Perform any async tasks you need to do before hiding the splash screen
    // For example, loading fonts or making API calls
    // Once everything is loaded, hide the splash screen
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        {/* 👇 Slot is where the current route will render */}
        <Slot />
      </Provider>
    </GestureHandlerRootView>
  );
}
