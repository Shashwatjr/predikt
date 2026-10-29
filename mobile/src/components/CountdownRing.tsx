import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

interface Props {
  seconds: number;
  size?: number;
  color?: string;
  label?: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function CountdownRing({ seconds, size = 80, color = '#A855F7', label }: Props) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <View style={styles.wrap}>
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}>
        <Text style={[styles.time, { color, fontSize: size * 0.28 }]}>
          {pad(mins)}:{pad(secs)}
        </Text>
      </View>
      {label ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  ring: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.10)',
  },
  time: { fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
