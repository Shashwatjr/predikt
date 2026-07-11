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
}

export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
  fullWidth = true,
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

  const content = loading ? (
    <ActivityIndicator color="#fff" size="small" />
  ) : (
    <Text style={[styles.label, variant === 'secondary' && { color: colors.purple }, variant === 'ghost' && { color: colors.textSecondary }]}>
      {icon ? `${icon}  ${label}` : label}
    </Text>
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
            colors={isDisabled ? ['#6b7280', '#4b5563'] : colors.gradPrimary}
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
          <View style={[styles.btn, styles.outlineBtn, { borderColor: colors.purple }]}>
            {content}
          </View>
        )}

        {variant === 'ghost' && (
          <View style={[styles.btn, { backgroundColor: 'transparent' }]}>
            {content}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 5 },
  btn: {
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  outlineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  label: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
