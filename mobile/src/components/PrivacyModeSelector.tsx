import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export type PrivacyVisibility = 'invite_only' | 'private' | 'public';

type Props = {
  value: PrivacyVisibility;
  onChange: (next: PrivacyVisibility) => void;
  onLearnMore?: () => void;
  onPrivateDetails?: () => void;
};

/**
 * Prominent privacy picker shown at the top of Create Room.
 *
 * Ghost Mode (recommended) keeps live location private — only progress is shared
 * — and maps to invite-only visibility. Private Mode restricts full details to
 * invited friends. Fine-grained visibility (incl. public) still lives in the
 * advanced options; this is the fast, friendly default choice.
 */
export default function PrivacyModeSelector({ value, onChange, onLearnMore, onPrivateDetails }: Props) {
  const { colors } = useTheme();
  const ghostActive = value !== 'private';
  const privateActive = value === 'private';

  return (
    <View style={styles.row}>
      {/* Ghost Mode */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onChange('invite_only')}
        style={[
          styles.card,
          {
            borderColor: ghostActive ? colors.purple : colors.border,
            backgroundColor: ghostActive ? colors.purpleDim : colors.surface,
          },
        ]}
      >
        <View style={styles.cardTop}>
          <View style={[styles.iconBubble, { backgroundColor: colors.purpleDim, borderColor: colors.purple }]}>
            <Text style={styles.iconText}>👻</Text>
          </View>
          <View style={[styles.switch, { backgroundColor: ghostActive ? colors.purple : colors.surfaceHigh }]}>
            <View style={[styles.knob, ghostActive ? styles.knobOn : styles.knobOff]} />
          </View>
        </View>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Ghost Mode</Text>
          <View style={[styles.badge, { backgroundColor: colors.purpleDim, borderColor: colors.purple }]}>
            <Text style={[styles.badgeText, { color: colors.purpleLight }]}>RECOMMENDED</Text>
          </View>
        </View>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          Your live location stays private. Only progress is shown to others.
        </Text>
        {onLearnMore ? (
          <TouchableOpacity onPress={onLearnMore} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={[styles.link, { color: colors.purpleLight }]}>ⓘ Learn more</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {/* Private Mode */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          onChange('private');
          onPrivateDetails?.();
        }}
        style={[
          styles.card,
          {
            borderColor: privateActive ? colors.purple : colors.border,
            backgroundColor: privateActive ? colors.purpleDim : colors.surface,
          },
        ]}
      >
        <View style={styles.cardTop}>
          <View style={[styles.iconBubble, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
            <Text style={styles.iconText}>🔒</Text>
          </View>
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
        </View>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Private Mode</Text>
        </View>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          Only invited friends can see full details.
        </Text>
      </TouchableOpacity>
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
  chevron: { fontSize: 26, fontWeight: '400', paddingHorizontal: 6 },
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
