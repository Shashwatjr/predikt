import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../theme/designSystem';

export type NavTab = 'Home' | 'Create' | 'Profile';

type Props = {
  active: NavTab;
  onChange: (tab: NavTab) => void;
  hiddenTabs?: NavTab[];
};

// Home / raised "+" Create / Profile — the "+" is the single entry to Create.
const TABS: Array<{ key: NavTab; label: string; icon: string }> = [
  { key: 'Home', label: 'Home', icon: '⌂' },
  { key: 'Create', label: 'Create', icon: '+' },
  { key: 'Profile', label: 'Profile', icon: '♙' },
];

export default function BottomNav({ active, onChange, hiddenTabs = [] }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 14) }]} pointerEvents="box-none">
      <View style={styles.nav}>
      {TABS.filter((tab) => !hiddenTabs.includes(tab.key)).map((tab) => {
        const isActive = active === tab.key;
        const isCreate = tab.key === 'Create';
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.item, isActive && !isCreate && styles.itemActive]}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            {isCreate ? (
              <LinearGradient colors={['#7C3AED', '#2563EB']} style={styles.createIcon}>
                <Text style={styles.createPlus}>+</Text>
              </LinearGradient>
            ) : (
              <Text style={[styles.icon, isActive && styles.iconActive]}>{tab.icon}</Text>
            )}
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 14,
    paddingHorizontal: 14,
  },
  nav: {
    width: '100%',
    maxWidth: 520,
    minHeight: 78,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
    backgroundColor: 'rgba(5,10,24,0.92)',
    borderRadius: 26,
    flexDirection: 'row',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 18,
    minHeight: 54,
  },
  itemActive: {
    backgroundColor: 'rgba(124,58,237,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.16)',
  },
  icon: { color: palette.textMuted, fontSize: 21 },
  iconActive: { color: '#A78BFA' },
  label: { color: palette.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  labelActive: { color: '#E2E8F0' },
  createIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
  },
  createPlus: { color: '#fff', fontSize: 30, lineHeight: 30, fontWeight: '300' },
});
