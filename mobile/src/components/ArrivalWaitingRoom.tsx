import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatClock } from '../utils/benchmarks';
import { palette, radius, spacing } from '../theme/designSystem';

/**
 * Pre-tracking "you're all set" waiting room for arrival challenges.
 *
 * Shown after a prediction is locked in and the journey timer is counting down
 * to when tracking becomes visible. Presentational only — the parent owns the
 * lifecycle and passes the target timestamp; this component ticks locally so the
 * countdown stays smooth for both the host and viewers.
 */

type PredictionCard = {
  key: string;
  icon: string;
  name: string;
  nameColor: string;
  date: Date | null;
  chipLabel: string;
  chipColor: string;
  highlight?: boolean;
};

type Props = {
  title: string;
  statusLabel: string;
  targetTime: Date | null;
  startLabel: string;
  destinationLabel: string;
  expectedDurationMinutes: number | null;
  modeLabel: string;
  modeIcon: string;
  safetyMessage: string;
  cards: PredictionCard[];
  onHowItWorks?: () => void;
  onGhostModeDetails?: () => void;
  onEnableNotifications?: () => void;
};

function useCountdown(targetTime: Date | null): number {
  const [seconds, setSeconds] = useState(() =>
    targetTime ? Math.max(0, Math.ceil((targetTime.getTime() - Date.now()) / 1000)) : 0,
  );
  const targetRef = useRef(targetTime);
  targetRef.current = targetTime;

  useEffect(() => {
    const tick = () => {
      const t = targetRef.current;
      setSeconds(t ? Math.max(0, Math.ceil((t.getTime() - Date.now()) / 1000)) : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTime]);

  return seconds;
}

function clockParts(date: Date | null): { time: string; ampm: string } {
  if (!date) return { time: '—', ampm: '' };
  const [time, ampm] = formatClock(date, false).split(' ');
  return { time, ampm: ampm ?? '' };
}

export default function ArrivalWaitingRoom({
  title,
  statusLabel,
  targetTime,
  startLabel,
  destinationLabel,
  expectedDurationMinutes,
  modeLabel,
  modeIcon,
  safetyMessage,
  cards,
  onHowItWorks,
  onGhostModeDetails,
  onEnableNotifications,
}: Props) {
  const seconds = useCountdown(targetTime);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const countdown = `${mm}:${ss}`;

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Text style={styles.headerIcon}>🚗</Text>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusPillText}>{statusLabel}</Text>
        </View>
      </View>

      {/* Countdown hero */}
      <View style={styles.heroCard}>
        <Text style={styles.heroKicker}>Journey starts in</Text>
        <Text style={styles.heroCountdown}>{countdown}</Text>
        <Text style={styles.heroSub}>Tracking begins automatically</Text>

        <View style={styles.routeRow}>
          <View style={styles.routeSide}>
            <Text style={styles.routePin}>📍</Text>
            <Text style={styles.routeText} numberOfLines={2}>
              {startLabel}
            </Text>
          </View>
          <Text style={styles.routeArrow}>→</Text>
          <View style={styles.routeSide}>
            <Text style={styles.routePin}>📍</Text>
            <Text style={styles.routeText} numberOfLines={2}>
              {destinationLabel}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Expected duration</Text>
            <Text style={styles.metaValue}>
              {expectedDurationMinutes ? `${expectedDurationMinutes} min` : '—'}
            </Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Mode</Text>
            <Text style={styles.metaValue}>
              {modeIcon} {modeLabel}
            </Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Privacy</Text>
            <Text style={[styles.metaValue, styles.metaValueGreen]}>🛡 Ghost Mode ON</Text>
          </View>
        </View>
      </View>

      {/* Everyone's prediction */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionTitle}>Everyone's Prediction</Text>
          {onHowItWorks ? (
            <TouchableOpacity onPress={onHowItWorks} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.infoIcon}>ⓘ</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.predictionGrid}>
          {cards.map((card) => {
            const { time, ampm } = clockParts(card.date);
            return (
              <View
                key={card.key}
                style={[styles.predCard, card.highlight && styles.predCardHighlight]}
              >
                <View style={styles.predNameRow}>
                  {card.icon ? <Text style={styles.predIcon}>{card.icon}</Text> : null}
                  <Text style={[styles.predName, { color: card.nameColor }]} numberOfLines={1}>
                    {card.name}
                  </Text>
                </View>
                {card.highlight ? (
                  <View style={styles.youBadge}>
                    <Text style={styles.youBadgeText}>YOU</Text>
                  </View>
                ) : null}
                <View style={styles.predTimeRow}>
                  <Text style={[styles.predTime, card.highlight && styles.predTimeHighlight]}>
                    {time}
                  </Text>
                  <Text style={[styles.predAmPm, card.highlight && styles.predTimeHighlight]}>
                    {ampm}
                  </Text>
                </View>
                <View style={[styles.predChip, { backgroundColor: `${card.chipColor}22` }]}>
                  <Text style={[styles.predChipText, { color: card.chipColor }]}>{card.chipLabel}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.winRow}>
          <Text style={styles.winText}>🎯 Closest to the actual arrival time wins!</Text>
          {onHowItWorks ? (
            <TouchableOpacity onPress={onHowItWorks}>
              <Text style={styles.winLink}>How it works</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Ghost mode callout */}
      <TouchableOpacity
        style={styles.ghostCard}
        activeOpacity={onGhostModeDetails ? 0.85 : 1}
        onPress={onGhostModeDetails}
      >
        <Text style={styles.ghostIcon}>🔒</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.ghostTitle}>Ghost Mode is ON</Text>
          <Text style={styles.ghostCopy}>
            Exact GPS and raw movement are hidden. {safetyMessage}
          </Text>
        </View>
        {onGhostModeDetails ? <Text style={styles.ghostChevron}>›</Text> : null}
      </TouchableOpacity>

      {/* You're all set */}
      <LinearGradient
        colors={['rgba(34,211,238,0.28)', 'rgba(34,211,238,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.setCard}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.setTitle}>You're all set!</Text>
          <Text style={styles.setSub}>We'll start tracking in</Text>
          <View style={styles.setCountdownPill}>
            <Text style={styles.setCountdown}>{countdown}</Text>
          </View>
          <Text style={styles.setFoot}>Sit tight. The journey is about to begin. 🚀</Text>
        </View>
        <Text style={styles.setEmoji}>⏳</Text>
      </LinearGradient>

      {/* Notify footer */}
      {onEnableNotifications ? (
        <View style={styles.notifyRow}>
          <Text style={styles.notifyText}>✨ We'll notify you when tracking begins.</Text>
          <TouchableOpacity style={styles.notifyBtn} onPress={onEnableNotifications}>
            <Text style={styles.notifyBtnText}>🔔 Enable Notifications</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const CARD_BG = palette.surface;
const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon: { fontSize: 22 },
  headerTitle: { color: palette.violetLight, fontSize: 18, fontWeight: '900' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.4)',
    backgroundColor: 'rgba(34,211,238,0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.violetLight },
  statusPillText: { color: palette.violetLight, fontSize: 12, fontWeight: '800' },

  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroKicker: { color: palette.textSecondary, fontSize: 15, fontWeight: '700' },
  heroCountdown: {
    color: palette.violetLight,
    fontSize: 76,
    lineHeight: 84,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroSub: { color: palette.textSecondary, fontSize: 13, marginBottom: spacing.md },

  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bg,
    padding: spacing.md,
  },
  routeSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  routePin: { fontSize: 14 },
  routeText: { color: palette.textPrimary, fontSize: 13, fontWeight: '700', flex: 1 },
  routeArrow: { color: palette.textSecondary, fontSize: 16, fontWeight: '800' },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  metaCell: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  metaDivider: { width: 1, alignSelf: 'stretch', backgroundColor: palette.border },
  metaLabel: { color: palette.textSecondary, fontSize: 11, fontWeight: '600' },
  metaValue: { color: palette.textPrimary, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  metaValueGreen: { color: palette.green },

  sectionCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { color: palette.textPrimary, fontSize: 18, fontWeight: '900' },
  infoIcon: { color: palette.textSecondary, fontSize: 15 },

  predictionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  predCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bg,
    padding: spacing.md,
    gap: 6,
  },
  predCardHighlight: {
    borderColor: 'rgba(34,197,94,0.6)',
    backgroundColor: 'rgba(34,197,94,0.10)',
  },
  predNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  predIcon: { fontSize: 16 },
  predName: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  youBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(34,197,94,0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  youBadgeText: { color: palette.green, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  predTimeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  predTime: { color: palette.textPrimary, fontSize: 30, fontWeight: '900', lineHeight: 34 },
  predAmPm: { color: palette.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  predTimeHighlight: { color: palette.green },
  predChip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
  },
  predChipText: { fontSize: 11, fontWeight: '800' },

  winRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  winText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  winLink: { color: palette.violetLight, fontSize: 13, fontWeight: '800' },

  ghostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    backgroundColor: 'rgba(34,211,238,0.10)',
    padding: spacing.lg,
  },
  ghostIcon: { fontSize: 20 },
  ghostTitle: { color: palette.violetLight, fontSize: 15, fontWeight: '900', marginBottom: 3 },
  ghostCopy: { color: palette.textSecondary, fontSize: 13, lineHeight: 18 },
  ghostChevron: { color: palette.textSecondary, fontSize: 22, fontWeight: '400' },

  setCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.4)',
    padding: spacing.xl,
    overflow: 'hidden',
  },
  setTitle: { color: palette.violetLight, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  setSub: { color: palette.textPrimary, fontSize: 14, textAlign: 'center', marginTop: 4 },
  setCountdownPill: {
    alignSelf: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.5)',
    backgroundColor: 'rgba(34,211,238,0.18)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  setCountdown: { color: palette.violetLight, fontSize: 40, fontWeight: '900', letterSpacing: 1 },
  setFoot: { color: palette.textSecondary, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
  setEmoji: { fontSize: 56 },

  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    padding: spacing.md,
  },
  notifyText: { color: palette.textPrimary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  notifyBtn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.5)',
    backgroundColor: 'rgba(34,211,238,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  notifyBtnText: { color: palette.violetLight, fontSize: 13, fontWeight: '800' },
});
