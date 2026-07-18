import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import TextInputField from '../components/TextInputField';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getLandingPalette } from '../theme/landingPalette';
import api, { getApiErrorMessage } from '../services/api';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Register'> };

export default function RegisterScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { isDark } = useTheme();
  const p = getLandingPalette(isDark);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [prediktHandle, setPrediktHandle] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedHandle = prediktHandle.trim();
    if (!normalizedName || !normalizedEmail || !password) return Alert.alert('Missing fields', 'Fill in all fields.');

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        name: normalizedName,
        email: normalizedEmail,
        password,
        prediktHandle: normalizedHandle || undefined,
      });
      await login({
        accessToken: res.data.accessToken,
        accessTokenExpiresAt: res.data.accessTokenExpiresAt,
        refreshToken: res.data.refreshToken,
        refreshTokenExpiresAt: res.data.refreshTokenExpiresAt,
        user: res.data.user,
      });
    } catch (err: unknown) {
      Alert.alert('Registration failed', getApiErrorMessage(err, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: p.bg }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.glow, { backgroundColor: p.coralSoft }]} />

      <View style={styles.logoBlock}>
        <LinearGradient colors={p.gradPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.logoGradient}>
          <Text style={[styles.logoText, { color: p.onSurfaceDark }]}>PREDIKT</Text>
        </LinearGradient>
        <Text style={[styles.tagline, { color: p.textSoft }]}>Create your account</Text>
      </View>

      <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
        <TextInputField label="Your Name" value={name} onChangeText={setName} placeholder="Shashwat" />
        <TextInputField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@example.com"
        />
        <TextInputField
          label="PREDIKT Handle"
          value={prediktHandle}
          onChangeText={setPrediktHandle}
          autoCapitalize="none"
          placeholder="@your.handle"
          hint="Optional. Letters, numbers, underscore, and dot."
        />
        <TextInputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          placeholder="Min 8 characters"
          hint="Use at least 8 characters"
          rightIcon={showPw ? '🙈' : '👁️'}
          onRightIconPress={() => setShowPw((v) => !v)}
        />
        <View style={{ height: 8 }} />
        <PrimaryButton
          label="Create Account"
          onPress={handleRegister}
          loading={loading}
          gradientColors={p.gradPrimary}
          labelColor={p.onSurfaceDark}
        />
      </View>

      <PrimaryButton
        label="Already have an account? Log in"
        onPress={() => navigation.navigate('Login')}
        variant="ghost"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: 24, justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -80,
    alignSelf: 'center',
    opacity: 0.6,
  },
  logoBlock: { alignItems: 'center', marginBottom: 32 },
  logoGradient: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 8 },
  logoText: { color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: 4 },
  tagline: { fontSize: 16 },
  card: { borderRadius: 20, padding: 20, borderWidth: 1, marginBottom: 8 },
});
