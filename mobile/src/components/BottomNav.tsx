import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, spacing } from '../theme/designSystem';

export type NavTab = 'Home' | 'Create' | 'Activity' | 'Profile';

type Props = {
  active: NavTab;
  onChange: (tab: NavTab) => void;
  hiddenTabs?: NavTab[];
};

const TABS: Array<{ key: NavTab; label: string; icon: string }> = [
  { key: 'Home', label: 'Home', icon: '⌂' },
  { key: 'Create', label: 'Create', icon: '+' },
  { key: 'Activity', label: 'Activity', icon: '⚡' },
  { key: 'Profile', label: 'Profile', icon: '♙' },
];

export default function BottomNav({ active, onChange, hiddenTabs = [] }: Props) {
  return (
    <View style={styles.nav}>
      {TABS.filter((tab) => !hiddenTabs.includes(tab.key)).map((tab) => {
        const isActive = active === tab.key;
        const isCreate = tab.key === 'Create';
        return (
          <TouchableOpacity key={tab.key} style={styles.item} onPress={() => onChange(tab.key)} accessibilityRole="tab" accessibilityState={{ selected: isActive }}>
            {isCreate ? (
              <LinearGradient colors={['#38bdf8', '#22D3EE']} style={styles.createIcon}>
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
  );
}

const styles = StyleSheet.create({
  nav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 82,
    paddingTop: 11,
    paddingBottom: 14,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: 'rgba(3,8,22,0.96)',
    flexDirection: 'row',
  },
  item: { flex: 1, alignItems: 'center', gap: 5 },
  icon: { color: palette.textMuted, fontSize: 22 },
  iconActive: { color: palette.cyan },
  label: { color: palette.textMuted, fontSize: 10, fontWeight: '700' },
  labelActive: { color: palette.cyan },
  createIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  createPlus: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '300' },
});
