import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../theme/designSystem';
import { DailySparkState, completeStartupSpark, storeStartupSparkVote } from '../services/startupSpark';
import { SparkRotationResult } from '../utils/sparkRotation';

type Props = {
  payload: { rotation: SparkRotationResult; state: DailySparkState } | null;
  appReady: boolean;
  onDone: () => void;
};

const MIN_VISIBLE_MS = 3600;
const MAX_VISIBLE_MS = 5600;

export default function StartupSpark({ payload, appReady, onDone }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [localState, setLocalState] = useState<DailySparkState | null>(payload?.state ?? null);
  const [finished, setFinished] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(18)).current;
  const logoScale = useRef(new Animated.Value(0.94)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const particleDrift = useRef(new Animated.Value(0)).current;
  const startTimeRef = useRef<number>(Date.now());
  const exitTriggeredRef = useRef(false);

  useEffect(() => {
    setLocalState(payload?.state ?? null);
    setFinished(false);
    startTimeRef.current = Date.now();
    exitTriggeredRef.current = false;
  }, [payload]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (mounted) setScreenReaderEnabled(enabled);
      })
      .catch(() => undefined);

    const reduceSub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    const readerSub = AccessibilityInfo.addEventListener?.('screenReaderChanged', setScreenReaderEnabled);

    return () => {
      mounted = false;
      reduceSub?.remove?.();
      readerSub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!payload || finished) {
      return;
    }

    const animations: Animated.CompositeAnimation[] = [
      Animated.timing(fade, {
        toValue: 1,
        duration: reduceMotion ? 220 : 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: reduceMotion ? 220 : 700,
        delay: reduceMotion ? 0 : 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: reduceMotion ? 220 : 900,
        delay: reduceMotion ? 0 : 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: reduceMotion ? 180 : 650,
        delay: reduceMotion ? 120 : 1700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslate, {
        toValue: 0,
        duration: reduceMotion ? 180 : 650,
        delay: reduceMotion ? 120 : 1700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ];

    Animated.parallel(animations).start();

    if (!reduceMotion) {
      Animated.loop(
        Animated.timing(particleDrift, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ).start();
    }
  }, [cardOpacity, cardTranslate, fade, finished, logoOpacity, logoScale, particleDrift, payload, reduceMotion]);

  useEffect(() => {
    if (!payload || finished || !appReady || exitTriggeredRef.current) {
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    const remaining = elapsed < MIN_VISIBLE_MS ? MIN_VISIBLE_MS - elapsed : 500;
    const timeout = setTimeout(() => {
      void finishExperience();
    }, remaining);

    return () => clearTimeout(timeout);
  }, [appReady, finished, payload]);

  useEffect(() => {
    if (!payload || finished || exitTriggeredRef.current) {
      return;
    }

    const timeout = setTimeout(() => {
      if (appReady) {
        void finishExperience();
      } else {
        setFinished(true);
        onDone();
      }
    }, MAX_VISIBLE_MS);

    return () => clearTimeout(timeout);
  }, [appReady, finished, onDone, payload]);

  const particles = useMemo(
    () =>
      Array.from({ length: reduceMotion ? 4 : 10 }, (_, index) => ({
        key: `particle-${index}`,
        size: 4 + (index % 3) * 3,
        left: `${8 + ((index * 9) % 80)}%` as `${number}%`,
        top: `${10 + ((index * 11) % 70)}%` as `${number}%`,
        opacity: 0.08 + (index % 4) * 0.05,
      })),
    [reduceMotion],
  );

  async function finishExperience() {
    if (!payload || exitTriggeredRef.current) return;
    exitTriggeredRef.current = true;
    await completeStartupSpark(localState ?? payload.state);

    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: reduceMotion ? 180 : 360,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: reduceMotion ? 180 : 420,
        delay: reduceMotion ? 0 : 80,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFinished(true);
      onDone();
    });
  }

  async function handleVote(choice: string) {
    if (!localState) return;
    const nextState = await storeStartupSparkVote(localState, choice);
    setLocalState(nextState);
  }

  if (!payload || finished) {
    return null;
  }

  const { rotation } = payload;
  const particleTranslate = particleDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });
  const accessibleLabel =
    rotation.mode === 'vote'
      ? "Today's Spark. Help choose tomorrow's Spark."
      : `Today's Spark. ${rotation.template.prompt} ${rotation.template.followUp}`;

  return (
    <Animated.View
      accessibilityViewIsModal
      accessible
      accessibilityLabel={accessibleLabel}
      style={[styles.overlay, { opacity: fade }]}
    >
      <LinearGradient colors={['#02050f', '#071126', '#0d1636']} style={StyleSheet.absoluteFill} />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {particles.map((particle, index) => (
        <Animated.View
          key={particle.key}
          style={[
            styles.particle,
            {
              width: particle.size,
              height: particle.size,
              left: particle.left,
              top: particle.top,
              opacity: particle.opacity,
              transform: reduceMotion
                ? undefined
                : [
                    { translateY: particleTranslate },
                    { translateX: index % 2 === 0 ? particleTranslate : Animated.multiply(particleTranslate, -1) },
                  ],
            },
          ]}
        />
      ))}

      <View style={styles.center}>
        <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>P</Text>
          </View>
          <Text style={styles.wordmark}>PREDIKT</Text>
        </Animated.View>

        <Animated.View style={[styles.sparkCard, { opacity: cardOpacity, transform: [{ translateY: cardTranslate }] }]}>
          <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)']} style={styles.cardBorder}>
            <View style={styles.cardInner}>
              <Text style={styles.cardEyebrow}>{rotation.mode === 'vote' ? 'TOMORROW, BUT MAKE IT YOURS' : 'A SMALL THING FOR TODAY'}</Text>
              <Text style={styles.cardIcon}>{rotation.mode === 'vote' ? '✨' : rotation.template.icon}</Text>
              {rotation.mode === 'vote' ? (
                <>
                  <Text style={styles.cardTitle}>Help choose tomorrow&apos;s Spark.</Text>
                  <Text style={styles.cardBody}>Tap one. PREDIKT will keep the ambition tiny.</Text>
                  <View style={styles.voteGrid}>
                    {rotation.choices.map((choice) => {
                      const selected = localState?.voteChoice === choice.key;
                      return (
                        <Pressable
                          key={choice.key}
                          accessibilityRole="button"
                          onPress={() => void handleVote(choice.key)}
                          style={[styles.voteChip, selected && styles.voteChipSelected]}
                        >
                          <Text style={styles.voteIcon}>{choice.icon}</Text>
                          <Text style={styles.voteLabel}>{choice.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.cardTitle}>{rotation.template.prompt}</Text>
                  <Text style={styles.cardBody}>{rotation.template.followUp}</Text>
                </>
              )}
              {screenReaderEnabled ? <Text style={styles.assistiveCopy}>Spark will close automatically when the app is ready.</Text> : null}
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    backgroundColor: '#02050f',
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    left: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(56,189,248,0.14)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -140,
    right: -30,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(34,211,238,0.18)',
  },
  particle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 26,
  },
  logoWrap: { alignItems: 'center', gap: 12 },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  logoText: { color: '#eef2ff', fontSize: 34, fontWeight: '900' },
  wordmark: { color: '#f8fafc', fontSize: 22, fontWeight: '900', letterSpacing: 5 },
  sparkCard: { width: '100%', maxWidth: 360 },
  cardBorder: {
    borderRadius: 26,
    padding: 1,
  },
  cardInner: {
    borderRadius: 25,
    padding: 20,
    gap: 10,
    backgroundColor: 'rgba(7,14,31,0.74)',
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardEyebrow: { color: 'rgba(255,255,255,0.62)', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  cardIcon: { fontSize: 26, marginTop: 4 },
  cardTitle: { color: '#f8fafc', fontSize: 24, lineHeight: 30, fontWeight: '900' },
  cardBody: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  assistiveCopy: { color: palette.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  voteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  voteChip: {
    minWidth: '47%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voteChipSelected: {
    borderColor: 'rgba(125,211,252,0.6)',
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
  voteIcon: { fontSize: 14 },
  voteLabel: { color: '#f8fafc', fontSize: 12, fontWeight: '800' },
});
