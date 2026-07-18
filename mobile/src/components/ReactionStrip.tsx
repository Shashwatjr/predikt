import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette, radius, spacing, typography } from '../theme/designSystem';

type Props = {
  reactions: string[];
  onReact: (emoji: string) => void;
  selected?: string | null;
};

export default function ReactionStrip({ reactions, onReact, selected }: Props) {
  return (
    <View style={styles.strip}>
      {reactions.map((emoji) => (
        <TouchableOpacity
          key={emoji}
          style={[styles.reaction, selected === emoji && styles.reactionSelected]}
          onPress={() => onReact(emoji)}
          accessibilityLabel={`React with ${emoji}`}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reaction: {
    borderRadius: radius.md,
    backgroundColor: palette.surfaceHigh,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reactionSelected: { borderColor: palette.violet, backgroundColor: 'rgba(34,211,238,0.2)' },
  emoji: { fontSize: 20 },
});
