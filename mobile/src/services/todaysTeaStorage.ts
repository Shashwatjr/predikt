import { keyValueStore } from './keyValueStore';

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function dailyTeaStorageKey(userId: string) {
  return `predikt.todays-tea.${userId}.${dateKey()}`;
}

export async function hasSeenTodaysTea(userId: string) {
  return (await keyValueStore.getItem(dailyTeaStorageKey(userId))) === 'true';
}

export async function markTodaysTeaSeen(userId: string) {
  await keyValueStore.setItem(dailyTeaStorageKey(userId), 'true');
}
