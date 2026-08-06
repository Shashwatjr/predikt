import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { motion, palette } from '../theme/designSystem';
import { TodaysTea } from '../utils/todaysTea';

type Props = {
  visible: boolean;
  tea: TodaysTea | null;
  onClose: () => void;
};

export default function TodaysTeaOverlay({ visible, tea, onClose }: Props) {
  const translateY = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      translateY.setValue(-24);
      opacity.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: motion.normal,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.normal,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  if (!tea || !visible) return null;

  // Today's Tea is a passing banner, not a decision the user has to clear. It must
  // never sit between them and Home's actions, so it is a `box-none` overlay rather
  // than a Modal — Modal renders a full-viewport pointer-capturing layer on both
  // react-native-web and native, which swallowed every tap on Home underneath it.
  return (
    <View style={styles.scrim} pointerEvents="box-none">
      <Animated.View style={[styles.cardWrap, { opacity, transform: [{ translateY }] }]}>
        <LinearGradient colors={tea.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <View style={styles.topRow}>
            <View style={styles.eyebrowRow}>
              <Text style={styles.icon}>{tea.icon}</Text>
              <Text style={styles.eyebrow}>TODAY'S TEA</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.dismiss}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>{tea.label}</Text>
          <Text style={styles.headline}>{tea.headline}</Text>
          <Text style={styles.body}>{tea.body}</Text>
          <Text style={styles.kicker}>{tea.kicker}</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 16,
    // No dimming tint: the screen behind stays live and tappable, so shading it
    // would promise a modality that no longer exists.
  },
  cardWrap: {
    width: '100%',
    maxWidth: 720,
  },
  card: {
    borderRadius: 24,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 16 },
  eyebrow: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  dismiss: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(3,8,22,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  dismissText: { color: palette.textPrimary, fontSize: 11, fontWeight: '800' },
  label: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '800' },
  headline: { color: '#fff', fontSize: 24, lineHeight: 30, fontWeight: '900' },
  body: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  kicker: { color: 'rgba(255,255,255,0.76)', fontSize: 12, lineHeight: 17, fontWeight: '700' },
});
