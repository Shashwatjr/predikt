import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

type Props = { route: RouteProp<RootStackParamList, 'Legal'> };

export default function LegalScreen({ route }: Props) {
  const { colors } = useTheme();
  const { slug, title } = route.params;
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/policies/${slug}`)
      .then((res) => setPolicy(res.data))
      .catch(() => setPolicy({ title, summary: 'Policy content is temporarily unavailable.' }))
      .finally(() => setLoading(false));
  }, [slug, title]);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}>
      {loading ? (
        <ActivityIndicator color={colors.purple} />
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{policy.title ?? title}</Text>
          <Text style={[styles.version, { color: colors.textMuted }]}>Version {policy.version ?? 'mvp'}</Text>
          <Text style={[styles.summary, { color: colors.textSecondary }]}>{policy.summary}</Text>
          {(policy.principles ?? []).map((item: string) => (
            <Text key={item} style={[styles.item, { color: colors.textSecondary }]}>- {item}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20 },
  card: { borderRadius: 20, borderWidth: 1, padding: 18 },
  title: { fontSize: 24, fontWeight: '900', marginBottom: 6 },
  version: { fontSize: 12, marginBottom: 16 },
  summary: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  item: { fontSize: 14, lineHeight: 21, marginTop: 6 },
});
