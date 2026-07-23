import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import TextInputField from '../../components/TextInputField';
import { palette, spacing, typography } from '../../theme/designSystem';
import { getAdminApiErrorMessage, useAdminAuth } from '../context/AdminAuthContext';

export default function AdminLoginScreen() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(getAdminApiErrorMessage(err, 'Admin login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>My Prediktion Admin</Text>
        <Text style={styles.subtitle}>Private beta operations portal</Text>
        <TextInputField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <TextInputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.h2, color: palette.textPrimary },
  subtitle: { ...typography.caption, color: palette.textMuted },
  button: {
    backgroundColor: palette.violet,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: { ...typography.body, color: '#fff', fontWeight: '700' },
  error: { ...typography.caption, color: '#f87171' },
});
