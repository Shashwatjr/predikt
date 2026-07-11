import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  value: 'yes' | 'no' | null;
  onChange: (value: 'yes' | 'no') => void;
}

export default function PredictionInputYesNo({ value, onChange }: Props) {
  const { colors } = useTheme();

  return (
    <>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Will it beat the ETA?</Text>
      <Text style={[styles.helper, { color: colors.textSecondary }]}>
        Pick Yes if you think it finishes before the estimate. Pick No if you think it lands after.
      </Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.button,
            {
              borderColor: value === 'yes' ? colors.green : colors.border,
              backgroundColor: value === 'yes' ? colors.greenDim : colors.surfaceHigh,
            },
          ]}
          onPress={() => onChange('yes')}
        >
          <Text style={[styles.text, { color: colors.textPrimary }]}>Yes</Text>
          <Text style={[styles.subText, { color: colors.textSecondary }]}>Before ETA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            {
              borderColor: value === 'no' ? colors.red : colors.border,
              backgroundColor: value === 'no' ? `${colors.red}22` : colors.surfaceHigh,
            },
          ]}
          onPress={() => onChange('no')}
        >
          <Text style={[styles.text, { color: colors.textPrimary }]}>No</Text>
          <Text style={[styles.subText, { color: colors.textSecondary }]}>After ETA</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  helper: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  button: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 18, alignItems: 'center' },
  text: { fontSize: 15, fontWeight: '800' },
  subText: { fontSize: 12, marginTop: 4, fontWeight: '700' },
});
