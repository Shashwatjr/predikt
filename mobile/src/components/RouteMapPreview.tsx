import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  preview: any | null;
  loading?: boolean;
  emptyLabel?: string;
  emptyCopy?: string;
}

export default function RouteMapPreview({
  preview,
  loading = false,
  emptyLabel = 'Map preview loading',
  emptyCopy = 'Select both locations to see the route preview.',
}: Props) {
  const { colors } = useTheme();

  if (Platform.OS === 'web') {
    const WebRouteMap = require('./WebRouteMap').default;
    return <WebRouteMap preview={preview} loading={loading} />;
  }

  return (
    <View style={[styles.fallback, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
      <Text style={[styles.fallbackTitle, { color: colors.textPrimary }]}>
        {preview ? `${preview.startLabel} -> ${preview.destinationLabel}` : emptyLabel}
      </Text>
      <Text style={[styles.fallbackCopy, { color: colors.textSecondary }]}>
        {preview
          ? 'Native map can fall back to a route summary for now. Web uses the full visual route preview.'
          : emptyCopy}
      </Text>
      {preview?.etaLabel ? (
        <Text style={[styles.fallbackCopy, { color: colors.green }]}>
          {preview.travelModeLabel} · {preview.etaLabel} · Accuracy wins. Speed does not.
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
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  fallbackCopy: {
    fontSize: 13,
    lineHeight: 19,
  },
});
