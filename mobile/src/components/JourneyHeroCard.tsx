import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import JourneyRouteArt from './JourneyRouteArt';
import { journeyPalette } from '../theme/journeyPalette';

/**
 * How the competition works, as three chips that encode the hierarchy rather
 * than listing the rules flat: friends are the contest, the bot is another
 * rival, and the Maps ETA is only a neutral yardstick. The baseline chip is
 * deliberately muted and dashed so it never reads as a competitor.
 */
export type JourneyTierTone = 'friends' | 'bot' | 'baseline';
export type JourneyTier = { tone: JourneyTierTone; strong?: string; label: string };

const DEFAULT_TIERS: JourneyTier[] = [
  { tone: 'friends', strong: 'Friends', label: 'compete' },
  { tone: 'bot', strong: 'Bot', label: 'joins as a rival' },
  { tone: 'baseline', label: 'Maps ETA · baseline only' },
];

type Props = {
  /** Small label above the heading. Desktop uses "Ready when you are". */
  eyebrow?: string;
  title: string;
  headline?: string;
  /** Second headline line, tinted with the accent. Keeps the break explicit
   *  instead of depending on where the text happens to wrap. */
  headlineAccent?: string;
  subtitle: string;
  ctaLabel: string;
  onPressCta: () => void;
  secondaryLabel?: string;
  onPressSecondary?: () => void;
  /** Taller art + roomier padding for the desktop dashboard column. */
  wide?: boolean;
  /** Forwarded to JourneyRouteArt's art-swap slot. */
  artwork?: React.ReactNode;
  tiers?: JourneyTier[];
};

function TierChips({ tiers, wide }: { tiers: JourneyTier[]; wide: boolean }) {
  return (
    <View style={[styles.tiers, wide && styles.tiersWide]}>
      {tiers.map((tier, index) => {
        const isBaseline = tier.tone === 'baseline';
        return (
          <View
            // Keyed by position, not tone — a tier list may legitimately repeat a
            // tone (e.g. two `baseline` notes).
            key={`${tier.tone}-${index}`}
            style={[styles.tier, isBaseline && styles.tierBaseline]}
            accessibilityRole="text"
          >
            <View style={[styles.tierDot, styles[`tierDot_${tier.tone}`]]} />
            <Text style={[styles.tierText, isBaseline && styles.tierTextBaseline]}>
              {tier.strong ? <Text style={styles.tierStrong}>{tier.strong}</Text> : null}
              {tier.strong ? ' ' : ''}
              {tier.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function JourneyHeroCard({
  eyebrow,
  title,
  headline,
  headlineAccent,
  subtitle,
  ctaLabel,
  onPressCta,
  secondaryLabel,
  onPressSecondary,
  wide = false,
  artwork,
  tiers = DEFAULT_TIERS,
}: Props) {
  const { width } = useWindowDimensions();
  const isTabletWide = wide && width < 1240;
  // `title` repeats the eyebrow on the compact layout, so only render it when it
  // actually adds something.
  const showTitle = !!title && title !== eyebrow;

  const copy = (
    <>
      {eyebrow ? (
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        </View>
      ) : null}
      {showTitle ? <Text style={styles.title}>{title}</Text> : null}

      {headline ? (
        <Text style={[styles.headline, wide && (isTabletWide ? styles.headlineTabletWide : styles.headlineWide)]}>
          {headline}
        </Text>
      ) : null}
      {headlineAccent ? (
        <Text
          style={[
            styles.headline,
            wide && (isTabletWide ? styles.headlineTabletWide : styles.headlineWide),
            styles.headlineAccent,
          ]}
        >
          {headlineAccent}
        </Text>
      ) : null}

      <Text style={[styles.subtitle, wide && styles.subtitleWide]}>{subtitle}</Text>
    </>
  );

  const actions = (
    <View style={[styles.actionRow, wide && styles.actionRowWide]}>
      <Pressable
        onPress={onPressCta}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        style={({ pressed }) => [styles.ctaPress, wide && styles.ctaPressWide, pressed && styles.ctaPressed]}
      >
        <LinearGradient
          colors={journeyPalette.gradAccentWide}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cta, wide && styles.ctaWide]}
        >
          <Text style={styles.ctaText} numberOfLines={1}>
            {ctaLabel}
          </Text>
        </LinearGradient>
      </Pressable>

      {secondaryLabel && onPressSecondary ? (
        <Pressable
          onPress={onPressSecondary}
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondary, wide && styles.secondaryWide, pressed && styles.ctaPressed]}
        >
          <Text style={styles.secondaryText} numberOfLines={1}>
            {secondaryLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <LinearGradient
      colors={journeyPalette.gradHeroSurface}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, wide && styles.cardWide]}
    >
      {wide ? (
        <>
          {/* Art sits behind the copy and bleeds off the right edge, so the card's
              height is driven by the text. A side-by-side art column had to be
              centred against a much taller copy column, which is what left a
              large gap above and below the illustration. */}
          <View style={[styles.artLayerWide, isTabletWide && styles.artLayerTabletWide]} pointerEvents="none">
            <JourneyRouteArt fitWidth artwork={artwork} />
          </View>

          <View style={[styles.copyWide, isTabletWide && styles.copyTabletWide]}>
            {copy}
            <TierChips tiers={tiers} wide />
            {actions}
          </View>
        </>
      ) : (
        <>
          {/* Compact: the art leads as a full-width band above the copy. */}
          <View style={styles.artLayerCompact} pointerEvents="none">
            <JourneyRouteArt fitWidth artwork={artwork} />
          </View>

          <View style={styles.copy}>{copy}</View>
          <TierChips tiers={tiers} wide={false} />
          {actions}
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: journeyPalette.border,
    backgroundColor: journeyPalette.surface,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 14,
    overflow: 'hidden',
  },
  cardWide: { paddingHorizontal: 38, paddingTop: 34, paddingBottom: 36, gap: 0 },

  // Absolutely positioned so it never adds height; bleeds past the right edge,
  // which `overflow: hidden` on the card then clips.
  artLayerWide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: -28,
    width: '56%',
    justifyContent: 'center',
    opacity: 0.85,
  },
  artLayerTabletWide: { width: '46%', right: -12, opacity: 0.72 },
  artLayerCompact: { marginHorizontal: -4, marginTop: -2 },

  // Kept in step with HEADLINE_MAX_CHARS in journey-home-redesign.test.mjs: the
  // headline budget is derived from this width and `headlineWide.fontSize`.
  copyWide: { maxWidth: 640, zIndex: 1 },
  copyTabletWide: { maxWidth: 520 },
  copy: { gap: 3 },

  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: journeyPalette.cyan,
    shadowColor: journeyPalette.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  eyebrow: {
    color: journeyPalette.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: journeyPalette.purpleLight, fontSize: 12, lineHeight: 16, fontWeight: '800', marginTop: 6 },

  headline: { color: journeyPalette.textPrimary, fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.4 },
  // The break between the two headline lines is explicit, so this can stay large
  // without risking a third line at narrow widths.
  headlineWide: { fontSize: 46, lineHeight: 50, letterSpacing: -1.4, marginTop: 10 },
  // 36px rather than 38px: at 38 the longest allowed headline cleared the 520px
  // tablet column by only 4%, which wraps under wider system fonts (Segoe UI,
  // Roboto). 36 restores ~9% and keeps both tiers inside one 28-char budget.
  headlineTabletWide: { fontSize: 36, lineHeight: 40, letterSpacing: -1, marginTop: 10 },
  headlineAccent: { color: journeyPalette.cyan, marginTop: 0 },

  subtitle: { color: journeyPalette.textSecondary, fontSize: 13, lineHeight: 19, fontWeight: '500', marginTop: 8 },
  subtitleWide: { fontSize: 15, lineHeight: 23, maxWidth: 520, marginTop: 14 },

  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tiersWide: { marginTop: 20 },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingLeft: 10,
    paddingRight: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: journeyPalette.borderSoft,
    backgroundColor: journeyPalette.glass,
  },
  tierBaseline: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierDot_friends: {
    backgroundColor: journeyPalette.purple,
    shadowColor: journeyPalette.purple,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  tierDot_bot: {
    backgroundColor: journeyPalette.cyan,
    shadowColor: journeyPalette.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  tierDot_baseline: { backgroundColor: journeyPalette.textMuted },
  tierText: { color: journeyPalette.textSecondary, fontSize: 12, fontWeight: '500' },
  tierTextBaseline: { color: journeyPalette.textMuted },
  tierStrong: { color: journeyPalette.textPrimary, fontWeight: '700' },

  actionRow: { gap: 10, marginTop: 16 },
  actionRowWide: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 24 },
  ctaPress: { width: '100%' },
  // Sized by its label on desktop rather than stretched to fill the column.
  ctaPressWide: { width: 'auto' },
  ctaPressed: { opacity: 0.85 },
  cta: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ctaWide: { width: 'auto', paddingHorizontal: 26 },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  secondary: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: journeyPalette.borderSoft,
    backgroundColor: journeyPalette.glass,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondaryWide: { width: 'auto', paddingHorizontal: 26 },
  secondaryText: { color: journeyPalette.textPrimary, fontSize: 15, fontWeight: '700' },
});
