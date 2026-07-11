import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '../theme/designSystem';

type Props = {
  label: string;
  icon?: string;
  color?: string;
};

export default function BadgeChip({ label, icon, color = palette.violet }: Props) {
  return (
    <View style={[styles.chip, { borderColor: `${color}66`, backgroundColor: `${color}22` }]}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  icon: { fontSize: 14 },
  text: { ...typography.caption, fontWeight: '900' },
});
