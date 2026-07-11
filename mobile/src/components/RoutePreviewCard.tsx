import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  preview: any;
  compact?: boolean;
}

function formatDistance(preview: any) {
  if (preview?.distanceLabel) return preview.distanceLabel;
  const meters = Number(preview?.distanceMeters);
  if (!Number.isFinite(meters)) return '—';
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function RoutePreviewCard({ preview, compact = false }: Props) {
  const { colors } = useTheme();
  if (!preview) return null;

  const warning = Array.isArray(preview.warnings) ? preview.warnings[0] : null;

  if (compact) {
    return (
      <View style={[styles.compactStrip, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
        <View style={styles.compactMetric}>
          <Text style={[styles.compactLabel, { color: colors.textSecondary }]}>ETA</Text>
          <Text style={[styles.compactValue, { color: colors.textPrimary }]}>
            {preview.etaLabel ?? preview.estimatedDurationLabel}
          </Text>
        </View>
        <View style={[styles.compactDivider, { backgroundColor: colors.border }]} />
        <View style={styles.compactMetric}>
          <Text style={[styles.compactLabel, { color: colors.textSecondary }]}>Distance</Text>
          <Text style={[styles.compactValue, { color: colors.textPrimary }]}>{formatDistance(preview)}</Text>
        </View>
        <View style={[styles.compactDivider, { backgroundColor: colors.border }]} />
        <View style={styles.compactMetric}>
          <Text style={[styles.compactLabel, { color: colors.textSecondary }]}>Mode</Text>
          <Text style={[styles.compactValue, { color: colors.textPrimary }]}>
            {preview.travelModeLabel ?? preview.travelMode}
          </Text>
        </View>
        {warning ? (
          <Text style={[styles.compactWarning, { color: colors.amber }]} numberOfLines={1}>
            {warning}
          </Text>
        ) : null}
      </View>
    );
  }

  const oracleLabel =
    preview.oracleBotPrediction?.label ??
    (preview.etaLabel ? `Oracle Bot benchmark: ${preview.etaLabel}` : null);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color: colors.purpleLight }]}>Route Preview</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {preview.startLabel ?? preview.start?.label} → {preview.destinationLabel ?? preview.destination?.label}
      </Text>
      <View style={styles.metricGrid}>
        <View style={[styles.metric, { backgroundColor: colors.surfaceHigh }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Approx. ETA</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {preview.etaLabel ?? preview.estimatedDurationLabel}
          </Text>
        </View>
        <View style={[styles.metric, { backgroundColor: colors.surfaceHigh }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Distance</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{formatDistance(preview)}</Text>
        </View>
        <View style={[styles.metric, { backgroundColor: colors.surfaceHigh }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Mode</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {preview.travelModeLabel ?? preview.travelMode}
          </Text>
        </View>
      </View>
      <Text style={[styles.copy, { color: colors.textSecondary }]}>
        {preview.providerLabel ?? 'Maps'} · {preview.isApproximate ? 'Approx. estimate' : 'High confidence estimate'}
      </Text>
      {warning ? <Text style={[styles.copy, { color: colors.amber }]}>{warning}</Text> : null}
      {oracleLabel ? <Text style={[styles.copyStrong, { color: colors.purpleLight }]}>{oracleLabel}</Text> : null}
      <View style={[styles.safetyBox, { backgroundColor: colors.greenDim }]}>
        <Text style={[styles.safetyText, { color: colors.green }]}>
          Ghost Mode is on. Friends see progress, not your exact route.
        </Text>
        <Text style={[styles.safetyText, { color: colors.green }]}>
          Predictions lock before journey starts. Accuracy wins. Speed does not.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: 18, fontWeight: '900', lineHeight: 24 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flex: 1, minWidth: 130, borderRadius: 14, padding: 12 },
  metricLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  metricValue: { fontSize: 16, fontWeight: '900' },
  copy: { fontSize: 13, lineHeight: 18 },
  copyStrong: { fontSize: 13, lineHeight: 18, fontWeight: '900' },
  safetyBox: { borderRadius: 14, padding: 12, gap: 4 },
  safetyText: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  compactStrip: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  compactMetric: { flex: 1, minWidth: 72, gap: 2 },
  compactLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  compactValue: { fontSize: 15, fontWeight: '900' },
  compactDivider: { width: 1, height: 28 },
  compactWarning: { width: '100%', fontSize: 11, lineHeight: 15, marginTop: 2 },
});
