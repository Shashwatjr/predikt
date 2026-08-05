import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'secondary' | 'ghost';
  icon?: string;
  fullWidth?: boolean;
  /** Override the primary-variant gradient (e.g. to match a surface palette). */
  gradientColors?: readonly [string, string];
  /** Override the label color (pairs with gradientColors for contrast). */
  labelColor?: string;
}

export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
  fullWidth = true,
  gradientColors,
  labelColor,
}: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  }

  const isDisabled = disabled || loading;
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';

  const content = loading ? (
    <ActivityIndicator color={labelColor ?? '#fff'} size="small" />
  ) : (
    <View style={styles.contentRow}>
      {icon ? <Text style={styles.iconText}>{icon}</Text> : null}
      <Text
        style={[
          styles.label,
          variant === 'primary' && labelColor ? { color: labelColor } : null,
          isSecondary && { color: colors.purpleLight ?? colors.purple },
          isGhost && { color: colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && { width: '100%' }, styles.wrapper]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        style={{ width: '100%' }}
      >
        {variant === 'primary' && (
          <LinearGradient
            colors={isDisabled ? ['#6b7280', '#4b5563'] : gradientColors ?? colors.gradPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btn}
          >
            {content}
          </LinearGradient>
        )}

        {variant === 'danger' && (
          <LinearGradient
            colors={isDisabled ? ['#6b7280', '#4b5563'] : colors.gradRed}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btn}
          >
            {content}
          </LinearGradient>
        )}

        {variant === 'secondary' && (
          <View
            style={[
              styles.btn,
              styles.outlineBtn,
              {
                borderColor: colors.purple,
                backgroundColor: colors.purpleDim,
              },
            ]}
          >
            {content}
          </View>
        )}

        {variant === 'ghost' && (
          <View style={[styles.btn, styles.ghostBtn]}>
            {content}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 5 },
  contentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  iconText: { fontSize: 16 },
  btn: {
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  outlineBtn: {
    borderWidth: 1,
  },
  ghostBtn: { backgroundColor: 'transparent' },
  label: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
