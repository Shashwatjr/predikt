import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CategoryTheme } from '../config/categoryTheme';
import { motion, palette, radius, spacing, typography } from '../theme/designSystem';

type Props = {
  theme: CategoryTheme;
  selected?: boolean;
  onPress: () => void;
  compact?: boolean;
  centered?: boolean;
  fill?: boolean;
  badge?: string;
  /**
   * Locked = the category exists in the theme but isn't selectable yet. It stays
   * fully visible with a "Coming Soon" label; tapping calls onPress (the caller
   * opens the vote prompt) instead of selecting it.
   */
  locked?: boolean;
};

export default function CategoryTile({ theme, selected, onPress, compact, centered, fill, badge, locked }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        flex: fill ? 1 : compact ? undefined : 1,
        minWidth: compact ? 140 : undefined,
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, ...motion.spring }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring }).start()}
        accessibilityRole="button"
        accessibilityState={{ disabled: locked, selected: !!selected }}
        accessibilityLabel={locked ? `${theme.label} category, coming soon` : `${theme.label} category`}
      >
        <LinearGradient
          colors={selected ? theme.gradient : ['rgba(18,26,53,0.95)', 'rgba(10,16,40,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.tile, selected && styles.tileSelected, compact && styles.compact, locked && styles.tileLocked]}
        >
          {locked ? (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>COMING SOON</Text>
            </View>
          ) : badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
          <Text style={[styles.icon, centered && styles.centeredText, locked && styles.dimmed]}>{theme.icon}</Text>
          <Text style={[styles.label, centered && styles.centeredText, locked && styles.dimmed]}>{compact ? theme.quickStartLabel : theme.label}</Text>
          {!compact ? (
            <Text style={[styles.hint, centered && styles.centeredText, locked && styles.dimmed]} numberOfLines={2}>
              {locked ? 'Coming soon — tap to vote for it.' : theme.emptyStateCopy}
            </Text>
          ) : null}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    minHeight: 110,
    gap: spacing.sm,
  },
  tileSelected: { borderColor: 'rgba(255,255,255,0.35)' },
  tileLocked: { opacity: 0.72 },
  compact: { minHeight: 88, padding: spacing.md },
  badge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: palette.amber,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { color: '#1A1206', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  comingSoonBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  comingSoonText: { color: palette.textSecondary, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  icon: { fontSize: 28 },
  label: { color: palette.textPrimary, ...typography.bodyBold },
  hint: { color: palette.textSecondary, ...typography.caption },
  centeredText: { textAlign: 'center' },
  dimmed: { opacity: 0.85 },
});
