import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DASHBOARD_ONBOARDING_COMPLETED_KEY = 'predikt.onboarding.dashboard.v1.completed';

async function getItem(key: string) {
  return Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function hasCompletedDashboardOnboarding() {
  return (await getItem(DASHBOARD_ONBOARDING_COMPLETED_KEY)) === 'true';
}

export async function completeDashboardOnboarding() {
  await setItem(DASHBOARD_ONBOARDING_COMPLETED_KEY, 'true');
}

export async function resetDashboardOnboarding() {
  await deleteItem(DASHBOARD_ONBOARDING_COMPLETED_KEY);
}

export const onboardingStorageMetadata = {
  dashboardOnboardingCompletedKey: DASHBOARD_ONBOARDING_COMPLETED_KEY,
  storageMode: Platform.OS === 'web' ? 'async-storage' : 'expo-secure-store',
} as const;
