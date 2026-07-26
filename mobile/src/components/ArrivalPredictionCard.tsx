import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import TimePickerSegments from './TimePickerSegments';
import InfoTip from './InfoTip';
import {
  Benchmark,
  deriveArrivalBenchmarks,
  diffLabel,
  formatClock,
} from '../utils/benchmarks';
import { botGuessTeaser } from '../utils/botVoice';
import { palette, radius, spacing } from '../theme/designSystem';

const ADJUSTMENTS: Array<{ label: string; seconds: number }> = [
  { label: '−1m', seconds: -60 },
  { label: '−30s', seconds: -30 },
  { label: '+30s', seconds: 30 },
  { label: '+1m', seconds: 60 },
  { label: '+2m', seconds: 120 },
  { label: '+5m', seconds: 300 },
];

function benchmarkChipLabel(b: Benchmark): string {
  if (b.key === 'maps') return b.verified ? b.label : 'Estimate';
  if (b.key === 'host') return 'Host';
  return 'The bot';
}

type Props = {
  room: any;
  predicted: Date;
  onPredictedChange: (next: Date) => void;
  hotTake: string;
  onHotTakeChange: (next: string) => void;
  /**
   * Compact drops the snap/nudge chips and the per-benchmark diff rows so the
   * whole card fits without scrolling on the merged "Predict now" screen. The
   * time picker and optional hot take are always shown.
   */
  compact?: boolean;
};

/**
 * The arrival-call controls shared by PredictionScreen (full) and the merged
 * JoinRoom "Predict now" path (compact): benchmark reference, time picker,
 * "your call" echo, and the optional hot take.
 */
export default function ArrivalPredictionCard({
  room,
  predicted,
  onPredictedChange,
  hotTake,
  onHotTakeChange,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const benchmarks = deriveArrivalBenchmarks(room);
  const ordered = benchmarks?.ordered ?? [];

  const adjust = (seconds: number) => onPredictedChange(new Date(predicted.getTime() + seconds * 1000));

  return (
    <View style={styles.wrap}>
      {ordered.length ? (
        compact ? (
          <View style={styles.benchPanelCompact}>
            {ordered.map((b) => (
              <View key={b.key} style={styles.benchRow}>
                <Text style={styles.benchLabel}>{benchmarkChipLabel(b)}</Text>
                <Text style={styles.benchTimeSmall}>{formatClock(b.date, false)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.benchPanel}>
            <Text style={styles.benchLegend}>
              Maps is the neutral baseline. The bot's guess is just for fun. Closest to the real
              arrival wins — that's the number to beat.
            </Text>
            {benchmarks?.maps ? (
              <View style={styles.benchRow}>
                <View style={styles.benchLabelWrap}>
                  <Text style={styles.benchLabel}>🌍 Maps baseline</Text>
                  <Text style={styles.benchSub}>{benchmarks.maps.verified ? 'Verified estimate' : 'Neutral estimate'}</Text>
                </View>
                <Text style={styles.benchTimeSmall}>{formatClock(benchmarks.maps.date, false)}</Text>
              </View>
            ) : null}
            {benchmarks?.host ? (
              <View style={styles.benchRow}>
                <Text style={styles.benchLabel}>👑 Host's call</Text>
                <Text style={styles.benchTimeSmall}>{formatClock(benchmarks.host.date, false)}</Text>
              </View>
            ) : null}
            {benchmarks?.oracle ? (
              <Text style={styles.botLine}>🤖 {botGuessTeaser(formatClock(benchmarks.oracle.date, false))}</Text>
            ) : null}
          </View>
        )
      ) : (
        <InfoTip
          title="Heads up"
          body="This room has no benchmark yet, so use your best judgement — arrival time only."
        />
      )}

      {/* Snap-to-benchmark + nudge chips — full view only. */}
      {!compact ? (
        <View style={styles.chipsWrap}>
          {ordered.map((b) => (
            <TouchableOpacity
              key={`snap-${b.key}`}
              style={[styles.chip, styles.chipAnchor]}
              onPress={() => onPredictedChange(new Date(b.date))}
            >
              <Text style={styles.chipAnchorText}>{benchmarkChipLabel(b)}</Text>
            </TouchableOpacity>
          ))}
          {ADJUSTMENTS.map((a) => (
            <TouchableOpacity key={a.label} style={styles.chip} onPress={() => adjust(a.seconds)}>
              <Text style={styles.chipText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <TimePickerSegments value={predicted} onChange={onPredictedChange} showSeconds />

      {/* "Your call" — with diffs in full view, just the time when compact. */}
      <View style={compact ? styles.callCardCompact : styles.callCard}>
        <Text style={styles.callLabel}>Your call · the one that counts</Text>
        <Text style={compact ? styles.callTimeCompact : styles.callTime}>{formatClock(predicted, true)}</Text>
        {!compact && ordered.length ? (
          <View style={styles.diffRows}>
            {ordered.map((b) => {
              const d = diffLabel(predicted, b.date);
              const tone = d === 'same' ? colors.textSecondary : d.startsWith('+') ? colors.amber : colors.green;
              return (
                <Text key={`diff-${b.key}`} style={[styles.diffText, { color: tone }]}>
                  {d} vs {benchmarkChipLabel(b)}
                </Text>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Optional 1-line hot take, shown next to your entry on the leaderboard + The Tea. */}
      <View style={styles.hotTakeCard}>
        <Text style={styles.hotTakeLabel}>Add a hot take (optional)</Text>
        <TextInput
          value={hotTake}
          onChangeText={(t) => onHotTakeChange(t.slice(0, 80))}
          placeholder="e.g. Traffic clears after 8pm 🚗"
          placeholderTextColor={colors.textMuted}
          maxLength={80}
          style={[styles.hotTakeInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
        />
        <Text style={[styles.hotTakeCount, { color: colors.textMuted }]}>{hotTake.length}/80</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  benchPanel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  benchPanelCompact: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  benchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  benchLabelWrap: { gap: 1 },
  benchLabel: { color: palette.textSecondary, fontSize: 13, fontWeight: '700' },
  benchSub: { color: palette.textMuted, fontSize: 11, fontWeight: '600' },
  benchLegend: { color: palette.textMuted, fontSize: 12, lineHeight: 17, marginBottom: spacing.xs },
  benchTimeSmall: { color: palette.textSecondary, fontSize: 16, fontWeight: '800' },
  botLine: { color: palette.violetLight, fontSize: 13, fontWeight: '800', fontStyle: 'italic' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceHigh,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { color: palette.textPrimary, fontSize: 13, fontWeight: '800' },
  chipAnchor: { borderColor: 'rgba(34,211,238,0.5)', backgroundColor: 'rgba(34,211,238,0.16)' },
  chipAnchorText: { color: palette.violetLight, fontSize: 13, fontWeight: '900' },
  callCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    backgroundColor: 'rgba(34,211,238,0.08)',
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  callCardCompact: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    backgroundColor: 'rgba(34,211,238,0.08)',
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  callLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  callTime: { color: palette.textPrimary, fontSize: 32, fontWeight: '900' },
  callTimeCompact: { color: palette.textPrimary, fontSize: 26, fontWeight: '900' },
  diffRows: { alignItems: 'center', gap: 2, marginTop: spacing.xs },
  diffText: { fontSize: 13, fontWeight: '800' },
  hotTakeCard: { gap: spacing.xs },
  hotTakeLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  hotTakeInput: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15 },
  hotTakeCount: { fontSize: 11, textAlign: 'right' },
});
