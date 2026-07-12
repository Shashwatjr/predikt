import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function dailyTeaStorageKey(userId: string) {
  return `predikt.todays-tea.${userId}.${dateKey()}`;
}

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

export async function hasSeenTodaysTea(userId: string) {
  return (await getItem(dailyTeaStorageKey(userId))) === 'true';
}

export async function markTodaysTeaSeen(userId: string) {
  await setItem(dailyTeaStorageKey(userId), 'true');
}
