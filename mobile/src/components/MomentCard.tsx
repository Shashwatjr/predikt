import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type MomentCardProps = {
  title: string;
  subtitle: string;
  badge: string;
  category: string;
  handle: string;
  predictionLabel: string;
  actualLabel: string;
  differenceLabel: string;
  oracleLabel?: string;
  commentary: string;
  cta: string;
};

export default function MomentCard({ title, subtitle, badge, category, handle, predictionLabel, actualLabel, differenceLabel, oracleLabel, commentary, cta }: MomentCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <Text style={[styles.logo, { color: colors.purpleLight }]}>My Prediktion</Text>
        <Text style={[styles.badge, { color: colors.green }]}>{badge}</Text>
      </View>
      <Text style={[styles.category, { color: colors.textSecondary }]}>{category}</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      <View style={styles.metaRow}>
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>Handle</Text>
          <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{handle}</Text>
        </View>
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>Prediction</Text>
          <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{predictionLabel}</Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>Actual</Text>
          <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{actualLabel}</Text>
        </View>
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>Difference</Text>
          <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{differenceLabel}</Text>
        </View>
      </View>
      {oracleLabel ? (
        <View style={[styles.oracleBox, { borderColor: colors.border }]}>
          <Text style={[styles.oracleLabel, { color: colors.textSecondary }]}>Oracle Bot</Text>
          <Text style={[styles.oracleValue, { color: colors.textPrimary }]}>{oracleLabel}</Text>
        </View>
      ) : null}
      <View style={[styles.commentaryBox, { backgroundColor: colors.surfaceHigh }]}>
        <Text style={[styles.commentaryText, { color: colors.textPrimary }]}>{commentary}</Text>
      </View>
      <Text style={[styles.cta, { color: colors.purpleLight }]}>{cta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },
  badge: { fontSize: 12, fontWeight: '800' },
  category: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaBox: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  metaLabel: { fontSize: 10, textTransform: 'uppercase', fontWeight: '800', opacity: 0.7 },
  metaValue: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  oracleBox: { borderRadius: 14, borderWidth: 1, padding: 12 },
  oracleLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  oracleValue: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  commentaryBox: { borderRadius: 14, padding: 12 },
  commentaryText: { fontSize: 13, lineHeight: 18 },
  cta: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
});
