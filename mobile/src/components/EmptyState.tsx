import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import PrimaryButton from './PrimaryButton';
import { palette, radius, spacing, typography } from '../theme/designSystem';

type Props = {
  title: string;
  body: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  icon?: string;
};

export default function EmptyState({ title, body, primaryLabel, secondaryLabel, onPrimary, onSecondary, icon = '✨' }: Props) {
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={['rgba(34,211,238,0.12)', 'rgba(37,99,235,0.08)']} style={styles.card}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {primaryLabel && onPrimary ? <PrimaryButton label={primaryLabel} onPress={onPrimary} icon="⚡" /> : null}
        {secondaryLabel && onSecondary ? <PrimaryButton label={secondaryLabel} onPress={onSecondary} variant="secondary" /> : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing.sm },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: { fontSize: 36 },
  title: { color: palette.textPrimary, ...typography.h3, textAlign: 'center' },
  body: { color: palette.textSecondary, ...typography.body, textAlign: 'center' },
});
