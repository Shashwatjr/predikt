import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import JourneyRouteArt from './JourneyRouteArt';
import { journeyPalette } from '../theme/journeyPalette';

type Props = {
  /** Small label above the heading. Desktop uses "Ready when you are". */
  eyebrow?: string;
  title: string;
  headline?: string;
  subtitle: string;
  ctaLabel: string;
  onPressCta: () => void;
  secondaryLabel?: string;
  onPressSecondary?: () => void;
  /** Taller art + roomier padding for the desktop dashboard column. */
  wide?: boolean;
  /** Forwarded to JourneyRouteArt's art-swap slot. */
  artwork?: React.ReactNode;
};

export default function JourneyHeroCard({
  eyebrow,
  title,
  headline,
  subtitle,
  ctaLabel,
  onPressCta,
  secondaryLabel,
  onPressSecondary,
  wide = false,
  artwork,
}: Props) {
  return (
    <LinearGradient
      colors={journeyPalette.gradHeroSurface}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, wide && styles.cardWide]}
    >
      <JourneyRouteArt height={wide ? 88 : 64} artwork={artwork} />

      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {headline ? <Text style={[styles.headline, wide && styles.headlineWide]}>{headline}</Text> : null}
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={[styles.actionRow, wide && styles.actionRowWide]}>
        <Pressable
          onPress={onPressCta}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          style={({ pressed }) => [styles.ctaPress, wide && styles.ctaPressWide, pressed && styles.ctaPressed]}
        >
          <LinearGradient
            colors={journeyPalette.gradAccent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </LinearGradient>
        </Pressable>

        {secondaryLabel && onPressSecondary ? (
          <Pressable onPress={onPressSecondary} accessibilityRole="button" style={[styles.secondary, wide && styles.secondaryWide]}>
            <Text style={styles.secondaryText}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: journeyPalette.border,
    backgroundColor: journeyPalette.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
    overflow: 'hidden',
  },
  cardWide: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18, gap: 12 },
  copy: { gap: 3 },
  eyebrow: {
    color: journeyPalette.purpleLight,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: journeyPalette.purpleLight, fontSize: 12, lineHeight: 16, fontWeight: '800' },
  headline: { color: journeyPalette.textPrimary, fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.4 },
  headlineWide: { fontSize: 29, lineHeight: 33 },
  subtitle: { color: journeyPalette.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '500', maxWidth: 560 },
  actionRow: { gap: 8 },
  actionRowWide: { flexDirection: 'row', alignItems: 'center' },
  ctaPress: { width: '100%' },
  ctaPressWide: { flex: 1 },
  ctaPressed: { opacity: 0.85 },
  cta: {
    width: '100%',
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  secondary: {
    width: '100%',
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: journeyPalette.borderStrong,
    backgroundColor: 'rgba(24,26,66,0.66)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryWide: { width: 198 },
  secondaryText: { color: journeyPalette.textPrimary, fontSize: 14, fontWeight: '700' },
});
