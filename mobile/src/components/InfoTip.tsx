import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  title: string;
  body: string;
}

export default function InfoTip({ title, body }: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Pressable onPress={() => setVisible(false)} hitSlop={8}>
          <Text style={[styles.dismiss, { color: colors.textSecondary }]}>Dismiss</Text>
        </Pressable>
      </View>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  dismiss: {
    fontSize: 13,
    fontWeight: '700',
  },
  body: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
  },
});
