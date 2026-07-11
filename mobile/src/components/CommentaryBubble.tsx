import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '../theme/designSystem';

type Props = {
  personality: string;
  headline: string;
  punchline: string;
  supportingLine?: string;
};

export default function CommentaryBubble({ personality, headline, punchline, supportingLine }: Props) {
  return (
    <View style={styles.bubble}>
      <View style={styles.header}>
        <Text style={styles.title}>Oracle + Chaos</Text>
        <Text style={styles.personality}>{personality}</Text>
      </View>
      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.quote}>“{punchline}”</Text>
      {supportingLine ? <Text style={styles.support}>{supportingLine}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: palette.textPrimary, ...typography.bodyBold },
  personality: { color: palette.violetLight, ...typography.caption },
  headline: { color: palette.textPrimary, ...typography.h3 },
  quote: { color: palette.textSecondary, ...typography.body, fontStyle: 'italic' },
  support: { color: palette.textMuted, ...typography.caption },
});
