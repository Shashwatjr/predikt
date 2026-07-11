import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props extends TextInputProps {
  label: string;
  hint?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
}

export default function TextInputField({
  label,
  hint,
  rightIcon,
  onRightIconPress,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: focused ? colors.purple : colors.textSecondary }]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.surface,
            borderColor: focused ? colors.borderFocus : colors.border,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          placeholderTextColor={colors.textMuted}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.icon}>
            <Text style={{ fontSize: 18, color: colors.textMuted }}>{rightIcon}</Text>
          </TouchableOpacity>
        )}
      </View>
      {hint && <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 7 },
  label: { fontSize: 13, marginBottom: 5, fontWeight: '600', letterSpacing: 0.2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 16,
  },
  icon: { padding: 4 },
  hint: { fontSize: 12, marginTop: 4, marginLeft: 2 },
});
