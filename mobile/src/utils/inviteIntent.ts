import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_JOIN_CODE_KEY = 'predikt.pendingJoinCode.v1';

export async function savePendingJoinCode(joinCode: string) {
  const normalized = joinCode.trim().toUpperCase();
  if (!normalized) return;
  await AsyncStorage.setItem(PENDING_JOIN_CODE_KEY, normalized);
}

export async function consumePendingJoinCode() {
  const value = await AsyncStorage.getItem(PENDING_JOIN_CODE_KEY);
  if (value) {
    await AsyncStorage.removeItem(PENDING_JOIN_CODE_KEY);
  }
  return value;
}
