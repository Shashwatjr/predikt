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
};

export default function CategoryTile({ theme, selected, onPress, compact }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }], flex: compact ? undefined : 1, minWidth: compact ? 140 : undefined }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, ...motion.spring }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring }).start()}
        accessibilityRole="button"
        accessibilityLabel={`${theme.label} category`}
      >
        <LinearGradient
          colors={selected ? theme.gradient : ['rgba(18,26,53,0.95)', 'rgba(10,16,40,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.tile, selected && styles.tileSelected, compact && styles.compact]}
        >
          <Text style={styles.icon}>{theme.icon}</Text>
          <Text style={styles.label}>{compact ? theme.quickStartLabel : theme.label}</Text>
          {!compact ? <Text style={styles.hint} numberOfLines={2}>{theme.emptyStateCopy}</Text> : null}
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
  compact: { minHeight: 88, padding: spacing.md },
  icon: { fontSize: 28 },
  label: { color: palette.textPrimary, ...typography.bodyBold },
  hint: { color: palette.textSecondary, ...typography.caption },
});
