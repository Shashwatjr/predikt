import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export type TravelMode = 'car' | 'bike' | 'walk' | 'cycle' | 'transit';

const travelModeOptions: Array<{ key: TravelMode; label: string; icon: string }> = [
  { key: 'car', label: 'Car', icon: '🚗' },
  { key: 'bike', label: 'Bike', icon: '🛵' },
  { key: 'walk', label: 'Walk', icon: '🚶' },
  { key: 'cycle', label: 'Cycle', icon: '🚲' },
  { key: 'transit', label: 'Transit', icon: '🚇' },
];

interface Props {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
}

export default function TravelModeSelector({ value, onChange }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      {travelModeOptions.map((option) => {
        const selected = value === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.chip,
              {
                borderColor: selected ? colors.purple : colors.border,
                backgroundColor: selected ? colors.purpleDim : colors.surfaceHigh,
              },
            ]}
            onPress={() => onChange(option.key)}
          >
            <Text style={styles.icon}>{option.icon}</Text>
            <Text style={[styles.label, { color: selected ? colors.purpleLight : colors.textPrimary }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: { fontSize: 16 },
  label: { fontSize: 13, fontWeight: '900' },
});
