import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { motion, palette, radius, spacing, typography } from '../theme/designSystem';

type Props = {
  label: string;
  helper: string;
  icon?: string;
  selected?: boolean;
  onPress: () => void;
};

export default function ModeCard({ label, helper, icon, selected, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, ...motion.spring }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring }).start()}
        style={[styles.card, selected && styles.selected]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.helper}>{helper}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  selected: {
    borderColor: palette.violet,
    backgroundColor: 'rgba(139,92,246,0.15)',
  },
  icon: { fontSize: 24 },
  label: { color: palette.textPrimary, ...typography.bodyBold },
  helper: { color: palette.textSecondary, ...typography.caption },
});
