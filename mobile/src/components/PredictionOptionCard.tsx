import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  title: string;
  description: string;
  answerType: string;
  example: string;
  icon: string;
  selected?: boolean;
  recommended?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export default function PredictionOptionCard({
  title,
  description,
  answerType,
  example,
  icon,
  selected = false,
  recommended = false,
  disabled = false,
  onPress,
}: Props) {
  const { colors } = useTheme();
  const readableAnswerType =
    answerType === 'exact_time'
      ? 'Arrival time'
      : answerType === 'duration'
        ? 'Journey duration'
        : answerType === 'yes_no'
          ? 'Yes or No'
          : answerType.replace(/_/g, ' ');

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.card,
        {
          backgroundColor: selected ? colors.purpleDim : colors.surface,
          borderColor: selected ? colors.purple : colors.border,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{icon}</Text>
          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.answerType, { color: selected ? colors.purpleLight : colors.textSecondary }]}>
              {readableAnswerType}
            </Text>
          </View>
        </View>
        {selected ? (
          <View style={[styles.selectedBadge, { backgroundColor: colors.purple }]}>
            <Text style={styles.selectedBadgeText}>Selected</Text>
          </View>
        ) : null}
        {recommended ? (
          <View style={[styles.badge, { backgroundColor: colors.greenDim }]}>
            <Text style={[styles.badgeText, { color: colors.green }]}>Recommended</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      <Text style={[styles.example, { color: colors.textMuted }]}>People answer: {example}</Text>
      {disabled ? (
        <Text style={[styles.future, { color: colors.amber }]}>Future option</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
  },
  icon: {
    fontSize: 22,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  answerType: {
    fontSize: 12,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  selectedBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  example: {
    fontSize: 12,
  },
  future: {
    fontSize: 12,
    fontWeight: '700',
  },
});
