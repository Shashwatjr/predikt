import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ActivePredictionCard, { type ActivePredictionCardVariant } from './ActivePredictionCard';
import { journeyPalette } from '../theme/journeyPalette';

export const JOURNEY_EMPTY_COPY =
  'No journeys yet — start your first journey and let the predictions begin';

/**
 * Auto-fitting card grid: each card wants ~320px and grows to share the row, so
 * the same two rules give three across on the desktop dashboard and a single
 * column on mobile, with no breakpoint. `alignItems: flex-start` keeps cards at
 * their natural height instead of stretching short ones to match the tallest.
 *
 * Exported so the Home loading skeleton lays out on the identical grid — if these
 * drift, the dashboard visibly reflows when real data arrives.
 */
export const journeyGridStyles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 },
  item: { flexGrow: 1, flexBasis: 320, minWidth: 280 },
});

type Props = {
  title: string;
  journeys: any[];
  onOpen: (journey: any) => void;
  onDelete: (journey: any) => void;
  onTogglePin: (roomId: string) => void;
  onMove: (roomId: string, direction: -1 | 1) => void;
  /** Desktop shows a "View all" affordance next to the section title. */
  onViewAll?: () => void;
  cardVariant?: ActivePredictionCardVariant;
};

export default function JourneyListSection({
  title,
  journeys,
  onOpen,
  onDelete,
  onTogglePin,
  onMove,
  onViewAll,
  cardVariant,
}: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onViewAll ? (
          <Pressable onPress={onViewAll} accessibilityRole="button">
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        ) : null}
      </View>

      {journeys.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🧭</Text>
          <Text style={styles.emptyCopy}>{JOURNEY_EMPTY_COPY}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {journeys.map((journey, index) => (
            <View key={journey.roomId} style={styles.gridItem}>
              <ActivePredictionCard
                item={journey}
                variant={cardVariant ?? 'default'}
                onOpen={() => onOpen(journey)}
                onDelete={() => onDelete(journey)}
                onTogglePin={() => onTogglePin(journey.roomId)}
                onMoveUp={() => onMove(journey.roomId, -1)}
                onMoveDown={() => onMove(journey.roomId, 1)}
                disableMoveUp={index === 0}
                disableMoveDown={index === journeys.length - 1}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { color: journeyPalette.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  viewAll: { color: journeyPalette.cyan, fontSize: 13, fontWeight: '700' },

  list: journeyGridStyles.list,
  gridItem: journeyGridStyles.item,
  empty: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: journeyPalette.borderStrong,
    backgroundColor: 'rgba(139,92,246,0.05)',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: { fontSize: 30 },
  emptyCopy: {
    color: journeyPalette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 320,
  },
});
