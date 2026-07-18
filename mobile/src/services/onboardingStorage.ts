import { Platform } from 'react-native';
import { keyValueStore } from './keyValueStore';

const DASHBOARD_ONBOARDING_COMPLETED_KEY = 'predikt.onboarding.dashboard.v1.completed';

export async function hasCompletedDashboardOnboarding() {
  return (await keyValueStore.getItem(DASHBOARD_ONBOARDING_COMPLETED_KEY)) === 'true';
}

export async function completeDashboardOnboarding() {
  await keyValueStore.setItem(DASHBOARD_ONBOARDING_COMPLETED_KEY, 'true');
}

export async function resetDashboardOnboarding() {
  await keyValueStore.removeItem(DASHBOARD_ONBOARDING_COMPLETED_KEY);
}

export const onboardingStorageMetadata = {
  dashboardOnboardingCompletedKey: DASHBOARD_ONBOARDING_COMPLETED_KEY,
  storageMode: Platform.OS === 'web' ? 'async-storage' : 'expo-secure-store',
} as const;
