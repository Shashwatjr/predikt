import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ActivePredictionCard, { type ActivePredictionCardVariant } from './ActivePredictionCard';
import { journeyPalette } from '../theme/journeyPalette';

export const JOURNEY_EMPTY_COPY =
  'No journeys yet — start your first journey and let the predictions begin';

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
            <ActivePredictionCard
              key={journey.roomId}
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
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: journeyPalette.textPrimary, fontSize: 16, fontWeight: '800' },
  viewAll: { color: journeyPalette.purpleLight, fontSize: 13, fontWeight: '700' },
  list: { gap: 12 },
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
