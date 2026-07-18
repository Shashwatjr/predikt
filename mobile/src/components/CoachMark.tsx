import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { keyValueStore } from '../services/keyValueStore';
import { palette, radius, spacing, typography } from '../theme/designSystem';

type Props = {
  storageKey: string;
  title: string;
  body: string;
  visible?: boolean;
};

export default function CoachMark({ storageKey, title, body, visible = true }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let active = true;
    keyValueStore.getItem(storageKey).then((value) => {
      if (active) setDismissed(value === '1');
    });
    return () => {
      active = false;
    };
  }, [storageKey]);

  if (!visible || dismissed) return null;

  return (
    <Pressable
      style={styles.card}
      onPress={async () => {
        setDismissed(true);
        await keyValueStore.setItem(storageKey, '1');
      }}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Text style={styles.dismiss}>Tap to dismiss</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.38)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    color: palette.textPrimary,
    ...typography.caption,
    fontWeight: '900',
  },
  body: {
    color: palette.textSecondary,
    ...typography.caption,
    lineHeight: 18,
  },
  dismiss: {
    color: palette.amber,
    ...typography.micro,
    fontWeight: '800',
  },
});
