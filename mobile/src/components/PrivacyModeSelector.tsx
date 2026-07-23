import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export type PrivacyVisibility = 'invite_only' | 'private' | 'public';

type Props = {
  value: PrivacyVisibility;
  onChange: (next: PrivacyVisibility) => void;
  onLearnMore?: () => void;
};

type ModeSpec = {
  key: PrivacyVisibility;
  icon: string;
  title: string;
  copy: string;
  badge?: string;
};

/**
 * Prominent privacy picker shown at the top of Create Room. Three modes:
 *
 * - Ghost   (invite_only) — hidden from discovery, but anyone with the link can join.
 * - Private (private)     — hidden from discovery and membership-gated.
 * - Public  (public)      — discoverable and joinable by anyone.
 */
const MODES: ModeSpec[] = [
  {
    key: 'invite_only',
    icon: '👻',
    title: 'Ghost Mode',
    copy: 'Hidden from discovery. Anyone with your link can peek in and join — no sign-in needed.',
    badge: 'RECOMMENDED',
  },
  {
    key: 'private',
    icon: '🔒',
    title: 'Private Mode',
    copy: "Hidden from discovery. People must sign in to open your link, and can't see details until they join.",
  },
  {
    key: 'public',
    icon: '🌐',
    title: 'Public',
    copy: 'Shown in discovery and joinable by anyone.',
  },
];

export default function PrivacyModeSelector({ value, onChange, onLearnMore }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {MODES.map((mode) => {
        const active = value === mode.key;
        return (
          <TouchableOpacity
            key={mode.key}
            activeOpacity={0.9}
            onPress={() => onChange(mode.key)}
            style={[
              styles.card,
              {
                borderColor: active ? colors.purple : colors.border,
                backgroundColor: active ? colors.purpleDim : colors.surface,
              },
            ]}
          >
            <View style={styles.cardTop}>
              <View style={[styles.iconBubble, { backgroundColor: colors.purpleDim, borderColor: colors.purple }]}>
                <Text style={styles.iconText}>{mode.icon}</Text>
              </View>
              <View style={[styles.switch, { backgroundColor: active ? colors.purple : colors.surfaceHigh }]}>
                <View style={[styles.knob, active ? styles.knobOn : styles.knobOff]} />
              </View>
            </View>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{mode.title}</Text>
              {mode.badge ? (
                <View style={[styles.badge, { backgroundColor: colors.purpleDim, borderColor: colors.purple }]}>
                  <Text style={[styles.badgeText, { color: colors.purpleLight }]}>{mode.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.copy, { color: colors.textSecondary }]}>{mode.copy}</Text>
            {mode.key === 'invite_only' && onLearnMore ? (
              <TouchableOpacity onPress={onLearnMore} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={[styles.link, { color: colors.purpleLight }]}>ⓘ Learn more</Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 220,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 22 },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: '900' },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  copy: { fontSize: 13, lineHeight: 18 },
  link: { fontSize: 13, fontWeight: '800', marginTop: 2 },
});
