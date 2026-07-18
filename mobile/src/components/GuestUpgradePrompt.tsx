import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import TextInputField from './TextInputField';
import PrimaryButton from './PrimaryButton';
import { useAuth } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import { getStoredGuestKey } from '../services/guestSession';
import { palette, radius, spacing } from '../theme/designSystem';

type Props = {
  /** Slightly different framing on the two surfaces. */
  variant?: 'result' | 'profile';
  onUpgraded?: () => void;
};

/**
 * "Save your Aura" prompt for guests. Converts the current guest (identified by
 * their access token) into a full account via POST /auth/guest/upgrade, preserving
 * all scoring history, then refreshes the auth session in place.
 *
 * The guest is already authenticated as a guest, so the endpoint recognises them
 * from the bearer token. We also read the device guestKey purely to send it along
 * for parity/telemetry; the upgrade itself is token-based.
 */
export default function GuestUpgradePrompt({ variant = 'result', onUpgraded }: Props) {
  const { user, login } = useAuth();
  const [expanded, setExpanded] = useState(variant === 'profile');
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState('');
  const [prediktHandle, setPrediktHandle] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Only guests should ever see this.
  if (!user?.isGuest) return null;

  async function handleUpgrade() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || password.length < 8) {
      Alert.alert('Almost there', 'Add your email and a password of at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      // Persisted guest key (returning-guest recognition); harmless if the backend
      // ignores it — the upgrade is authorised by the guest's bearer token.
      const guestKey = await getStoredGuestKey();
      const res = await api.post('/auth/guest/upgrade', {
        email: normalizedEmail,
        password,
        name: name.trim() || undefined,
        prediktHandle: prediktHandle.trim() || undefined,
        ...(guestKey ? { guestKey } : {}),
      });
      await login({
        accessToken: res.data.accessToken,
        accessTokenExpiresAt: res.data.accessTokenExpiresAt,
        refreshToken: res.data.refreshToken,
        refreshTokenExpiresAt: res.data.refreshTokenExpiresAt,
        user: res.data.user,
      });
      Alert.alert('Aura saved', 'Your account is set. Your streak and Aura carry over.');
      onUpgraded?.();
    } catch (err: unknown) {
      Alert.alert('Could not save', getApiErrorMessage(err, 'Please check your details and try again.'));
    } finally {
      setLoading(false);
    }
  }

  const title = variant === 'result' ? 'Save your Aura' : 'Save your account';
  const subtitle =
    variant === 'result'
      ? "You played as a guest — nice call. Lock in an account so your Aura, streak and history are yours to keep."
      : "You're playing as a guest. Add an email and password to keep your Aura, streak and history for good.";

  return (
    <LinearGradient
      colors={[`${palette.violet}22`, `${palette.cyan}14`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.headerRow}>
        <Text style={styles.spark}>✨</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {!expanded ? (
        <PrimaryButton label="Save my Aura" onPress={() => setExpanded(true)} icon="✨" />
      ) : (
        <View style={styles.form}>
          <TextInputField label="Display name" value={name} onChangeText={setName} placeholder="Your name" />
          <TextInputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@example.com"
          />
          <TextInputField
            label="PREDIKT handle"
            value={prediktHandle}
            onChangeText={setPrediktHandle}
            autoCapitalize="none"
            placeholder="@your.handle"
            hint="Optional."
          />
          <TextInputField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
            placeholder="Min 8 characters"
            rightIcon={showPw ? '🙈' : '👁️'}
            onRightIconPress={() => setShowPw((v) => !v)}
          />
          <PrimaryButton label="Save my Aura" onPress={handleUpgrade} loading={loading} icon="✨" />
          <Text style={styles.footnote}>Your guess history and streak carry over — nothing is lost.</Text>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.4)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  spark: { fontSize: 24 },
  title: { color: palette.textPrimary, fontSize: 17, fontWeight: '900', marginBottom: 3 },
  subtitle: { color: palette.textSecondary, fontSize: 13, lineHeight: 19 },
  form: { gap: spacing.sm },
  footnote: { color: palette.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
