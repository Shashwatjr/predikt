import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import TextInputField from '../components/TextInputField';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api, { getApiErrorMessage } from '../services/api';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

const DEV_ACCOUNTS = [
  {
    key: 'pilot',
    label: 'Pilot (first-time MVP)',
    email: 'pilot@predikt.ai',
    password: 'PilotMvp2026!',
  },
  {
    key: 'demo',
    label: 'Demo (pre-filled QA)',
    email: 'test@predikt.ai',
    password: 'Password123!',
  },
] as const;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return Alert.alert('Missing fields', 'Please fill in email and password.');

    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email: normalizedEmail, password });
      if (__DEV__) {
        console.log('[PREDIKT_LOGIN] success user', {
          userId: res.data.user?.userId,
          handle: res.data.user?.prediktHandle,
        });
      }
      await login({
        accessToken: res.data.accessToken,
        accessTokenExpiresAt: res.data.accessTokenExpiresAt,
        refreshToken: res.data.refreshToken,
        refreshTokenExpiresAt: res.data.refreshTokenExpiresAt,
        user: res.data.user,
      });
    } catch (err: unknown) {
      Alert.alert('Login failed', getApiErrorMessage(err, 'Check your credentials and try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Ambient glow */}
      <View style={[styles.glow, { backgroundColor: colors.purpleDim }]} />

      {/* Logo */}
      <View style={styles.logoBlock}>
        <LinearGradient colors={colors.gradPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.logoGradient}>
          <Text style={styles.logoText}>PREDIKT</Text>
        </LinearGradient>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>Predict what's next.</Text>
      </View>

      {/* Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInputField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@example.com"
        />
        <TextInputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          placeholder="Your password"
          rightIcon={showPw ? '🙈' : '👁️'}
          onRightIconPress={() => setShowPw((v) => !v)}
        />

        <View style={styles.gap} />
        <PrimaryButton label="Log In" onPress={handleLogin} loading={loading} />
      </View>

      {__DEV__ ? (
        <View style={[styles.devCard, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
          <Text style={[styles.devTitle, { color: colors.textSecondary }]}>Dev quick login</Text>
          <View style={styles.devRow}>
            {DEV_ACCOUNTS.map((account) => (
              <TouchableOpacity
                key={account.key}
                style={[styles.devChip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
              >
                <Text style={[styles.devChipLabel, { color: colors.textPrimary }]}>{account.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <PrimaryButton
        label="Don't have an account? Sign up"
        onPress={() => navigation.navigate('Register')}
        variant="ghost"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24, justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -80,
    alignSelf: 'center',
    opacity: 0.6,
  },
  logoBlock: { alignItems: 'center', marginBottom: 36 },
  logoGradient: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 8 },
  logoText: { color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: 4 },
  tagline: { fontSize: 16 },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  gap: { height: 8 },
  devCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  devTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  devRow: { gap: 8 },
  devChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  devChipLabel: { fontSize: 13, fontWeight: '700' },
});
