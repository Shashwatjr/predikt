import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '../theme/designSystem';

type Props = {
  visible: boolean;
  categoryLabel: string | null;
  onVote: () => void;
  onClose: () => void;
};

/**
 * Lightweight, dismissable "want this next?" prompt for locked ("Coming Soon")
 * categories. Presentational only — the parent owns the recording via
 * `voteCategoryInterest` and decides when to show it.
 */
export default function CategoryVotePrompt({ visible, categoryLabel, onVote, onClose }: Props) {
  const [voted, setVoted] = useState(false);

  function handleVote() {
    setVoted(true);
    onVote();
  }

  function handleClose() {
    setVoted(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {voted ? (
            <>
              <Text style={styles.emoji}>🎉</Text>
              <Text style={styles.title}>Thanks — noted!</Text>
              <Text style={styles.body}>
                We'll prioritise {categoryLabel ?? 'this'} based on interest like yours.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={handleClose}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.emoji}>✨</Text>
              <Text style={styles.title}>Want {categoryLabel ?? 'this'} next?</Text>
              <Text style={styles.body}>Tap to let us know — it helps us pick what ships next.</Text>
              <Pressable style={styles.primaryBtn} onPress={handleVote}>
                <Text style={styles.primaryBtnText}>Yes, I'd play this</Text>
              </Pressable>
              <Pressable style={styles.ghostBtn} onPress={handleClose}>
                <Text style={styles.ghostBtnText}>Not now</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,8,22,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  emoji: { fontSize: 34 },
  title: { color: palette.textPrimary, ...typography.bodyBold, fontSize: 18, textAlign: 'center' },
  body: { color: palette.textSecondary, ...typography.caption, textAlign: 'center', marginBottom: spacing.sm },
  primaryBtn: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    backgroundColor: palette.violet,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  ghostBtn: { alignSelf: 'stretch', paddingVertical: spacing.sm, alignItems: 'center' },
  ghostBtnText: { color: palette.textMuted, fontWeight: '800', fontSize: 13 },
});
