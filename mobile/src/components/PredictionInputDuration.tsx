import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInputField from './TextInputField';
import { useTheme } from '../context/ThemeContext';

interface Props {
  value: string;
  onChange: (value: string) => void;
  durationChoices: number[];
}

export default function PredictionInputDuration({ value, onChange, durationChoices }: Props) {
  const { colors } = useTheme();

  return (
    <>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Predict the journey duration</Text>
      <Text style={[styles.helper, { color: colors.textSecondary }]}>
        Choose how many minutes the trip will take from Start to Destination.
      </Text>
      <View style={styles.quickRow}>
        {durationChoices.map((minutes) => (
          <TouchableOpacity
            key={minutes}
            style={[
              styles.quickChip,
              {
                borderColor: value === minutes.toString() ? colors.purple : colors.border,
                backgroundColor: value === minutes.toString() ? colors.purpleDim : colors.surfaceHigh,
              },
            ]}
            onPress={() => onChange(minutes.toString())}
          >
            <Text style={[styles.quickChipText, { color: colors.textPrimary }]}>{minutes} mins</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInputField
        label="Custom duration in minutes"
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="35"
        hint="Use Custom if none of the quick chips fit your Closest Guess."
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  helper: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  quickChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  quickChipText: { fontSize: 13, fontWeight: '700' },
});
