import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getSparkDateKey, getSparkForDate } from '../utils/sparkRotation';

export type DailySparkState = {
  lastShownDate: string;
  templateKey: string;
  dismissed: boolean;
  completed: boolean;
  voteChoice: string | null;
  createdAt: string;
};

const STARTUP_SPARK_STATE_KEY = 'predikt.startup-spark.state.v1';
const STARTUP_SPARK_ENABLED_KEY = 'predikt.startup-spark.enabled.v1';

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

export async function getStartupSparkEnabled() {
  const value = await getItem(STARTUP_SPARK_ENABLED_KEY);
  return value !== 'false';
}

export async function setStartupSparkEnabled(enabled: boolean) {
  await setItem(STARTUP_SPARK_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function getDailySparkState() {
  const raw = await getItem(STARTUP_SPARK_STATE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DailySparkState;
  } catch {
    return null;
  }
}

async function saveDailySparkState(state: DailySparkState) {
  await setItem(STARTUP_SPARK_STATE_KEY, JSON.stringify(state));
}

export async function getStartupSparkPayload() {
  const enabled = await getStartupSparkEnabled();
  if (!enabled) return null;

  const today = getSparkDateKey();
  const existingState = await getDailySparkState();
  if (existingState?.lastShownDate === today) {
    return null;
  }

  const rotation = getSparkForDate();
  const state: DailySparkState = {
    lastShownDate: today,
    templateKey: rotation.template.key,
    dismissed: false,
    completed: false,
    voteChoice: null,
    createdAt: new Date().toISOString(),
  };

  return { rotation, state };
}

export async function completeStartupSpark(state: DailySparkState) {
  await saveDailySparkState({ ...state, dismissed: true, completed: true });
}

export async function storeStartupSparkVote(state: DailySparkState, voteChoice: string) {
  const nextState = { ...state, voteChoice };
  await saveDailySparkState(nextState);
  return nextState;
}
