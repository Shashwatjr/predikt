import { keyValueStore } from './keyValueStore';

const DEMO_SCENARIO_PICKER_SEEN_KEY = 'predikt.demo.scenario-picker.v1.seen';

export async function hasSeenDemoScenarioPicker() {
  return (await keyValueStore.getItem(DEMO_SCENARIO_PICKER_SEEN_KEY)) === 'true';
}

export async function markDemoScenarioPickerSeen() {
  await keyValueStore.setItem(DEMO_SCENARIO_PICKER_SEEN_KEY, 'true');
}

export async function resetDemoScenarioPicker() {
  await keyValueStore.removeItem(DEMO_SCENARIO_PICKER_SEEN_KEY);
}
