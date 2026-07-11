import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { pillStyle } from '../theme/designSystem';

type Props = {
  label: string;
  tone?: 'default' | 'live' | 'success' | 'warning';
};

export default function StatusPill({ label, tone = 'default' }: Props) {
  return (
    <View style={[pillStyle(tone), styles.pill]}>
      {tone === 'live' ? <View style={styles.liveDot} /> : null}
      <Text style={[styles.text, tone === 'live' && styles.liveText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22d3ee' },
  text: { color: 'rgba(255,255,255,0.82)', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  liveText: { color: '#67e8f9' },
});
