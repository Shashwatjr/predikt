import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import LandingScreenV2 from '../screens/LandingScreen.v2';
import HomeScreen from '../screens/HomeScreen';
import CreateRoomScreen from '../screens/CreateRoomScreen';
import RoomCreatedScreen from '../screens/RoomCreatedScreen';
import JoinRoomScreen from '../screens/JoinRoomScreen';
import PredictionScreen from '../screens/PredictionScreen';
import LiveRoomScreen from '../screens/LiveRoomScreen';
import ResultScreen from '../screens/ResultScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import LegalScreen from '../screens/LegalScreen';
import HelpScreen from '../screens/HelpScreen';
import { RootStackParamList } from './types';
import { resolveInviteJoinCode } from '../utils/inviteIntent';
import { consumePostAuthIntent } from '../utils/postAuthIntent';
import ScreenCrashBoundary from '../components/ScreenCrashBoundary';

const Stack = createNativeStackNavigator<RootStackParamList>();

function SafeLiveRoomScreen(props: React.ComponentProps<typeof LiveRoomScreen>) {
  return (
    <ScreenCrashBoundary screenName="Journey" onHome={() => props.navigation.navigate('Home')}>
      <LiveRoomScreen {...props} />
    </ScreenCrashBoundary>
  );
}

function SafeResultScreen(props: React.ComponentProps<typeof ResultScreen>) {
  return (
    <ScreenCrashBoundary screenName="Result" onHome={() => props.navigation.navigate('Home')}>
      <ResultScreen {...props} />
    </ScreenCrashBoundary>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  // A tapped invite link opens straight into the join/predict flow — for guests
  // (unauthenticated) and signed-in users alike — instead of the landing page.
  // Anchored to the navigator being ready (via onReady + a post-login tick)
  // rather than a one-shot timer, so a cold-start invite is never silently dropped.
  const runInitialRouting = useCallback(() => {
    if (!navigationRef.isReady()) return;
    // A guest who just logged in mid-flow lands on their intended screen here.
    const intent = consumePostAuthIntent();
    if (intent) {
      (navigationRef.navigate as (screen: string, params?: object) => void)(
        intent.screen,
        intent.params,
      );
      return;
    }
    void resolveInviteJoinCode().then((joinCode) => {
      if (!joinCode || !navigationRef.isReady()) return;
      navigationRef.navigate('JoinRoom', { joinCode });
    });
  }, [navigationRef]);

  // The navigator remounts (key changes) when auth flips after a mid-flow login;
  // give the fresh stack one frame to settle, then route the pending intent. On the
  // very first mount this no-ops until ready — NavigationContainer.onReady drives that.
  useEffect(() => {
    if (isLoading) return;
    const frame = requestAnimationFrame(() => runInitialRouting());
    return () => cancelAnimationFrame(frame);
  }, [isAuthenticated, isLoading, runInitialRouting]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator color={colors.purple} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={runInitialRouting}>
      <Stack.Navigator
        key={isAuthenticated ? 'authenticated' : 'unauthenticated'}
        initialRouteName={isAuthenticated ? 'Home' : 'Landing'}
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '700', color: colors.textPrimary },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Landing" component={LandingScreenV2} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Account' }} />
            <Stack.Screen name="JoinRoom" component={JoinRoomScreen} options={{ title: 'Join Room' }} />
            <Stack.Screen name="Help" component={HelpScreen} options={{ title: 'Help' }} />
            <Stack.Screen name="Legal" component={LegalScreen} options={({ route }) => ({ title: route.params.title })} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CreateRoom" component={CreateRoomScreen} options={{ title: 'Create Room' }} />
            <Stack.Screen name="RoomCreated" component={RoomCreatedScreen} options={{ title: '' }} />
            <Stack.Screen name="JoinRoom" component={JoinRoomScreen} options={{ title: 'Join Room' }} />
            <Stack.Screen name="Prediction" component={PredictionScreen} options={{ title: 'Your Prediction' }} />
            <Stack.Screen name="LiveRoom" component={SafeLiveRoomScreen} options={{ title: '' }} />
            <Stack.Screen name="Result" component={SafeResultScreen} options={{ title: 'Results' }} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: '' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: '' }} />
            <Stack.Screen name="Help" component={HelpScreen} options={{ title: 'Help' }} />
            <Stack.Screen name="Legal" component={LegalScreen} options={({ route }) => ({ title: route.params.title })} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
