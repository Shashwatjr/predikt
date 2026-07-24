import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette, radius, spacing, typography } from '../theme/designSystem';
import { attributionFor } from '../utils/shareLine';

type Props = {
  personality: string;
  headline: string;
  punchline: string;
  supportingLine?: string;
  /** When provided, renders a "Share this line" button that copies the punchline. */
  onShareLine?: () => void;
  /** Transient copied-state label toggle from the parent. */
  shareCopied?: boolean;
  /**
   * Hero mode: the punchline is the reward, so render it oversized and make the
   * copy/share affordance a filled, unmissable button. Used on the Result screen.
   */
  hero?: boolean;
};

/**
 * The Tea's commentary. The punchline is the hero: it is the line users screenshot
 * into group chats, so it renders large and self-contained with attribution, giving
 * a WhatsApp screenshot a natural crop around the quote + "— Chaos Bot on My Prediktion".
 */
export default function CommentaryBubble({
  personality,
  headline,
  punchline,
  supportingLine,
  onShareLine,
  shareCopied,
  hero,
}: Props) {
  return (
    <View style={[styles.bubble, hero && styles.bubbleHero]}>
      <View style={styles.header}>
        <Text style={styles.brand}>My Prediktion</Text>
        <Text style={styles.personality}>{personality}</Text>
      </View>

      {headline ? <Text style={styles.headline}>{headline}</Text> : null}

      {/* Screenshot target: keep the quote + attribution together and well-padded. */}
      <View style={styles.quoteBlock}>
        <Text style={[styles.quote, hero && styles.quoteHero]}>“{punchline}”</Text>
        <Text style={styles.attribution}>— {attributionFor(personality)}</Text>
      </View>

      {supportingLine ? <Text style={styles.support}>{supportingLine}</Text> : null}

      {onShareLine ? (
        <TouchableOpacity
          style={[styles.shareButton, hero && styles.shareButtonHero]}
          onPress={onShareLine}
          accessibilityRole="button"
        >
          <Text style={[styles.shareButtonText, hero && styles.shareButtonTextHero]}>
            {shareCopied ? 'Copied ✓' : hero ? '📋 Copy this line to share' : 'Share this line'}
          </Text>
        </TouchableOpacity>
      ) : null}
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
    gap: spacing.md,
  },
  bubbleHero: {
    borderColor: palette.violetLight,
    borderWidth: 1.5,
    padding: spacing.xl,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: palette.textSecondary, ...typography.caption, fontWeight: '900', letterSpacing: 2 },
  personality: { color: palette.violetLight, ...typography.caption, fontWeight: '800' },
  headline: { color: palette.textSecondary, ...typography.caption },
  quoteBlock: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  quote: {
    color: palette.textPrimary,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
  },
  quoteHero: { fontSize: 30, lineHeight: 40, fontWeight: '900', letterSpacing: -0.4 },
  attribution: { color: palette.textMuted, ...typography.caption, fontWeight: '700' },
  support: { color: palette.textMuted, ...typography.caption },
  shareButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.violetLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
  shareButtonHero: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: palette.violet,
    paddingVertical: spacing.md,
  },
  shareButtonText: { color: palette.violetLight, ...typography.caption, fontWeight: '900' },
  shareButtonTextHero: { color: '#fff', fontSize: 14 },
});
