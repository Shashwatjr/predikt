import React, { useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RewardType } from '../services/rewards';

/**
 * Compact balance chips for the three Phase 1 currencies.
 *  - variant="compact": icon + value pills only (Home). No labels, no tooltips.
 *  - variant="labeled": icon + value + name, with a one-line tooltip revealed on
 *    tap (Profile).
 * Purely presentational — callers pass already-fetched numbers.
 */

const TINT: Record<RewardType, string> = {
  AURA: '#22d3ee',
  RIZZ: '#a855f7',
  GEMS: '#34d399',
};

const ICON: Record<RewardType, string> = {
  AURA: '✨',
  RIZZ: '💫',
  GEMS: '💎',
};

const NAME: Record<RewardType, string> = {
  AURA: 'Aura',
  RIZZ: 'RIZZ',
  GEMS: 'Gems',
};

// One-line tooltip copy: "Aura: prediction skill" etc.
const TOOLTIP: Record<RewardType, string> = {
  AURA: 'prediction skill',
  RIZZ: 'social influence',
  GEMS: 'spendable rewards',
};

const ORDER: RewardType[] = ['AURA', 'RIZZ', 'GEMS'];

export type RewardChipsProps = {
  aura: number;
  rizz: number;
  gems: number;
  variant?: 'compact' | 'labeled';
  /** Result screen: drop any currency whose value is 0. */
  onlyNonZero?: boolean;
  /** Result screen: reuse the existing entrance animation. */
  animatedStyle?: any;
  /** Prefix each value with "+" (reward-earned context). */
  showPlus?: boolean;
};

export default function RewardChips({
  aura,
  rizz,
  gems,
  variant = 'compact',
  onlyNonZero = false,
  animatedStyle,
  showPlus = false,
}: RewardChipsProps) {
  const [openTip, setOpenTip] = useState<RewardType | null>(null);

  const values: Record<RewardType, number> = { AURA: aura, RIZZ: rizz, GEMS: gems };
  const shown = ORDER.filter((t) => (onlyNonZero ? values[t] > 0 : true));
  if (shown.length === 0) return null;

  const Container: any = animatedStyle ? Animated.View : View;

  return (
    <Container style={[styles.wrap, animatedStyle]}>
      <View style={styles.row}>
        {shown.map((type) => {
          const value = values[type];
          const display = `${showPlus && value > 0 ? '+' : ''}${value}`;
          if (variant === 'compact') {
            return (
              <View
                key={type}
                style={[styles.compactChip, { borderColor: `${TINT[type]}59` }]}
                accessibilityLabel={`${NAME[type]}: ${value}. ${TOOLTIP[type]}`}
              >
                <Text style={styles.compactText}>
                  {ICON[type]} <Text style={{ color: TINT[type] }}>{display}</Text>
                </Text>
              </View>
            );
          }
          return (
            <TouchableOpacity
              key={type}
              activeOpacity={0.8}
              onPress={() => setOpenTip((prev) => (prev === type ? null : type))}
              style={[styles.labeledChip, { borderLeftColor: TINT[type] }]}
              accessibilityLabel={`${NAME[type]}: ${TOOLTIP[type]}`}
            >
              <Text style={styles.labeledIcon}>{ICON[type]}</Text>
              <Text style={[styles.labeledValue, { color: TINT[type] }]}>{display}</Text>
              <Text style={styles.labeledName}>{NAME[type]}</Text>
              <Text style={styles.labeledTip}>{TOOLTIP[type]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {variant === 'labeled' && openTip ? (
        <Text style={styles.tipLine}>
          {NAME[openTip]}: {TOOLTIP[openTip]}
        </Text>
      ) : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // compact (Home)
  compactChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  compactText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  // labeled (Profile)
  labeledChip: {
    flexGrow: 1,
    flexBasis: 96,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  labeledIcon: { fontSize: 16 },
  labeledValue: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  labeledName: { color: '#fff', fontSize: 12, fontWeight: '800', marginTop: 2 },
  labeledTip: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600', marginTop: 1 },
  tipLine: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
});
