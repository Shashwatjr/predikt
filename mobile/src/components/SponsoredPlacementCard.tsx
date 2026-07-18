import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { SponsoredPlacement } from '../config/sponsoredPlacements';

type Props = {
  placement: SponsoredPlacement;
};

export default function SponsoredPlacementCard({ placement }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={['rgba(34,211,238,0.22)', 'rgba(14,165,233,0.08)']} style={styles.glow} />
      <Text style={[styles.label, { color: colors.purpleLight }]}>{placement.label}</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{placement.title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{placement.description}</Text>
      {placement.ctaLabel ? (
        <View style={[styles.cta, { borderColor: colors.border }]}>
          <Text style={[styles.ctaText, { color: colors.textPrimary }]}>{placement.ctaLabel}</Text>
        </View>
      ) : null}
      <Text style={[styles.note, { color: colors.textMuted }]}>
        Separate from PREDIKT results.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
    gap: 8,
  },
  glow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 2,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '800',
  },
  note: {
    fontSize: 11,
    lineHeight: 15,
  },
});
