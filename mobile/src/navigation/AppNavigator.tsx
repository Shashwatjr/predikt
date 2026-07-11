import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import LandingScreen from '../screens/LandingScreen';
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
import { consumePendingJoinCode } from '../utils/inviteIntent';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    let cancelled = false;
    const timeout = setTimeout(() => {
      void consumePendingJoinCode().then((joinCode) => {
        if (!joinCode || cancelled || !navigationRef.isReady()) return;
        navigationRef.navigate('JoinRoom', { joinCode });
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isAuthenticated, isLoading, navigationRef]);

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
    <NavigationContainer ref={navigationRef}>
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
            <Stack.Screen name="Landing" component={LandingScreen} options={{ headerShown: false }} />
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
            <Stack.Screen name="LiveRoom" component={LiveRoomScreen} options={{ title: '' }} />
            <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Results' }} />
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
