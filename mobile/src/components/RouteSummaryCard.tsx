import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  preview: any;
  title?: string;
}

export default function RouteSummaryCard({ preview, title }: Props) {
  const { colors } = useTheme();

  if (!preview) return null;

  const milestones = preview.suggestedMilestones ?? [];
  const travelModeIcon =
    preview.travelMode === 'walking' ? '🚶' : preview.travelMode === 'cycling' ? '🚲' : preview.travelMode === 'transit' ? '🚆' : '🚗';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title ?? preview.suggestedRoomTitle}</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        {preview.start?.label} → {preview.destination?.label}
      </Text>
      <View style={[styles.mapPreview, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
        <View style={styles.mapRow}>
          <View style={[styles.pin, { backgroundColor: colors.greenDim }]}>
            <Text style={[styles.pinText, { color: colors.green }]}>S</Text>
          </View>
          <View style={styles.routeLine}>
            <Text style={[styles.routeDots, { color: colors.purpleLight }]}>• • • • • • •</Text>
            <Text style={styles.travelIcon}>{travelModeIcon}</Text>
          </View>
          <View style={[styles.pin, { backgroundColor: colors.purpleDim }]}>
            <Text style={[styles.pinText, { color: colors.purpleLight }]}>D</Text>
          </View>
        </View>
        <Text style={[styles.mapLabel, { color: colors.textSecondary }]}>
          Map preview · exact live location hidden
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.metaPill, { color: colors.textPrimary, backgroundColor: colors.surfaceHigh }]}>
          {preview.distanceLabel}
        </Text>
        <Text style={[styles.metaPill, { color: colors.textPrimary, backgroundColor: colors.surfaceHigh }]}>
          {preview.estimatedDurationLabel}
        </Text>
        <Text style={[styles.metaPill, { color: colors.textPrimary, backgroundColor: colors.surfaceHigh }]}>
          {preview.travelMode}
        </Text>
      </View>
      <Text style={[styles.privacy, { color: colors.green }]}>
        Privacy-safe progress • delay {preview.privacy?.defaultSafetyDelayMinutes} min
      </Text>
      {milestones.length ? (
        <View style={[styles.milestones, { borderTopColor: colors.border }]}>
          <Text style={[styles.milestoneTitle, { color: colors.textPrimary }]}>Suggested moments</Text>
          {milestones.slice(0, 3).map((milestone: any, index: number) => (
            <Text key={`${milestone.milestoneName}-${index}`} style={[styles.milestoneRow, { color: colors.textSecondary }]}>
              {index + 1}. {milestone.milestoneName} · {milestone.locationLabel}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  sub: {
    fontSize: 14,
  },
  mapPreview: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  mapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: {
    fontSize: 12,
    fontWeight: '900',
  },
  routeLine: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  routeDots: {
    fontSize: 18,
    letterSpacing: 3,
  },
  travelIcon: {
    position: 'absolute',
    fontSize: 22,
  },
  mapLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  privacy: {
    fontSize: 12,
    fontWeight: '700',
  },
  milestones: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 5,
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  milestoneRow: {
    fontSize: 12,
    lineHeight: 17,
  },
});
