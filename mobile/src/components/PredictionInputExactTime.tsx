import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInputField from './TextInputField';
import { useTheme } from '../context/ThemeContext';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onAdjust: (minutes: number) => void;
  quickMinutes: number[];
}

export default function PredictionInputExactTime({ value, onChange, onAdjust, quickMinutes }: Props) {
  const { colors } = useTheme();

  return (
    <>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Pick an arrival time</Text>
      <Text style={[styles.helper, { color: colors.textSecondary }]}>
        Include seconds when you can. Closest guess wins Aura.
      </Text>
      <TextInputField
        label="Predicted arrival time"
        value={value}
        onChangeText={onChange}
        placeholder="2026-07-09T09:18:30"
        autoCapitalize="none"
        hint="Format: YYYY-MM-DDTHH:MM:SS"
      />
      <View style={styles.quickRow}>
        {quickMinutes.map((minutes) => (
          <TouchableOpacity
            key={minutes}
            style={[styles.quickChip, { borderColor: colors.border, backgroundColor: colors.surfaceHigh }]}
            onPress={() => onAdjust(minutes)}
          >
            <Text style={[styles.quickChipText, { color: colors.textPrimary }]}>
              {minutes > 0 ? `+${minutes}` : minutes} min
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.helper, { color: colors.textSecondary }]}>
        Predictions stay hidden until lock. You can edit or revoke for 2 minutes unless the room locks first.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  quickChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  quickChipText: { fontSize: 13, fontWeight: '700' },
  helper: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
});
