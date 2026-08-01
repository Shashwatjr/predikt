import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  preview: any | null;
  loading?: boolean;
  emptyLabel?: string;
  emptyCopy?: string;
  embedded?: boolean;
}

export default function RouteMapPreview({
  preview,
  loading = false,
  emptyLabel = 'Map preview loading',
  emptyCopy = 'Select both locations to see the route preview.',
  embedded = false,
}: Props) {
  const { colors } = useTheme();
  const previewTitle = preview ? `${preview.startLabel} -> ${preview.destinationLabel}` : emptyLabel;
  const previewCopy = preview
    ? 'Route preview stays lightweight for MVP. Your location is still hidden and the summary below carries the key details.'
    : emptyCopy;

  return (
    <View
      style={[
        embedded ? styles.embedded : styles.fallback,
        { backgroundColor: colors.surfaceHigh, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.fallbackTitle, { color: colors.textPrimary }]}>
        {previewTitle}
      </Text>
      <Text style={[styles.fallbackCopy, { color: colors.textSecondary }]}>
        {loading ? 'Loading route summary…' : previewCopy}
      </Text>
      {preview?.etaLabel ? (
        <Text style={[styles.fallbackCopy, { color: colors.green }]}>
          {preview.travelModeLabel} · {preview.etaLabel} · Accuracy wins. Speed does not.
        </Text>
      ) : null}
      {Platform.OS === 'web' && preview ? (
        <Text style={[styles.fallbackCopy, { color: colors.textMuted }]}>
          First load stays fast on mobile data. Full map rendering is intentionally off for this MVP pass.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    minHeight: 180,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    justifyContent: 'center',
    gap: 8,
  },
  embedded: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  fallbackCopy: {
    fontSize: 13,
    lineHeight: 19,
  },
});
