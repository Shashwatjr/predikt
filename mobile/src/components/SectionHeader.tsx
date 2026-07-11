import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '../theme/designSystem';
import StatusPill from './StatusPill';

type Props = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  live?: boolean;
};

export default function SectionHeader({ title, subtitle, action, live }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {live ? <StatusPill label="LIVE" tone="live" /> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  text: { flex: 1 },
  title: { color: palette.textPrimary, ...typography.h3 },
  subtitle: { color: palette.textSecondary, ...typography.caption, marginTop: 2 },
});
