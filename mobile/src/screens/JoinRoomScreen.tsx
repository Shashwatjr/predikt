import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import TextInputField from '../components/TextInputField';
import PrimaryButton from '../components/PrimaryButton';
import RoomCard from '../components/RoomCard';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import { savePendingJoinCode } from '../utils/inviteIntent';
import { getCategoryTheme } from '../config/categoryTheme';
import SectionHeader from '../components/SectionHeader';
import StatusPill from '../components/StatusPill';
import { cardStyle, layout, palette, spacing } from '../theme/designSystem';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'JoinRoom'>;
  route: RouteProp<RootStackParamList, 'JoinRoom'>;
};

export default function JoinRoomScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleFind(nextCode?: string) {
    const inviteCode = (nextCode ?? code).trim().toUpperCase();
    if (!inviteCode) return Alert.alert('Enter a code', 'Type the 5-character invite code.');
    setLoading(true);
    try {
      const res = await api.get(`/rooms/invite/${inviteCode}`);
      setRoom(res.data);
      setCode(inviteCode);
    } catch (error: unknown) {
      Alert.alert('Room unavailable', getApiErrorMessage(error, 'No room with that invite code. Check it and try again.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const routeCode = route.params?.joinCode?.trim().toUpperCase();
    if (!routeCode) return;
    setCode(routeCode);
    void handleFind(routeCode);
  }, [route.params?.joinCode]);

  async function handleAction() {
    if (!room) return;
    if (!isAuthenticated) {
      await savePendingJoinCode(room.inviteCode ?? code);
      Alert.alert(
        'Login to join',
        'Preview now. Login to join and make your prediction.',
        [
          { text: 'Keep previewing', style: 'cancel' },
          { text: 'Login', onPress: () => navigation.navigate('Login') },
        ],
      );
      return;
    }
    setLoading(true);
    try {
      const joinResponse = await api.post(`/rooms/${room.roomId}/join`);
      const nextAction = joinResponse.data?.nextAction;
      const normalizedStatus = room.status === 'prediction_open' ? 'predictions_open' : room.status;
      if (nextAction === 'prediction' || normalizedStatus === 'predictions_open') {
        navigation.navigate('Prediction', { roomId: room.roomId, room });
      } else if (nextAction === 'live' || normalizedStatus === 'live' || normalizedStatus === 'predictions_locked') {
        navigation.navigate('LiveRoom', { roomId: room.roomId, isCreator: false });
      } else {
        navigation.navigate('Result', { roomId: room.roomId });
      }
    } catch (error: unknown) {
      Alert.alert('Could not join', getApiErrorMessage(error, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  const actionLabel: Record<string, string> = {
    predictions_open: 'Join and Predict',
    predictions_locked: 'Join Live',
    live: 'Join Live',
    completed: 'View Result',
  };

  const categoryTheme = getCategoryTheme(room?.category ?? room?.templateKey);
  const lockLabel = room?.lockTime || room?.predictionCloseTime
    ? `Locks ${new Date(room.lockTime ?? room.predictionCloseTime).toLocaleString()}`
    : 'Lock time TBD';

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: palette.bg, maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]}
      keyboardShouldPersistTaps="handled"
    >
      <SectionHeader title="Join the Challenge" subtitle="Think they're wrong? Prove it." />

      <View style={[cardStyle('elevated'), { borderColor: `${categoryTheme.primaryColor}33`, gap: spacing.sm }]}>
        <Text style={{ fontSize: 28 }}>{categoryTheme.icon}</Text>
        <Text style={{ color: palette.textPrimary, fontWeight: '800', fontSize: 18 }}>{categoryTheme.label}</Text>
        <Text style={{ color: palette.textSecondary, fontSize: 13 }}>Closest guess wins Aura. No real-money play.</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInputField
          label="Invite Code"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder="e.g. DEMO1"
          autoCapitalize="characters"
          maxLength={5}
        />
        <View style={{ height: 6 }} />
        <PrimaryButton label="Find Room" onPress={handleFind} loading={loading} icon="🔍" />
      </View>

      {room && (
        <View style={styles.result}>
          <View style={[styles.foundPill, { backgroundColor: colors.greenDim }]}>
            <Text style={[styles.foundText, { color: colors.green }]}>Room preview ready</Text>
          </View>
          {!isAuthenticated ? (
            <View style={[styles.previewNotice, { backgroundColor: colors.purpleDim, borderColor: colors.border }]}>
              <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Preview before login</Text>
              <Text style={[styles.previewCopy, { color: colors.textSecondary }]}>
                Room labels are visible. Predictions stay hidden until lock.
              </Text>
            </View>
          ) : null}
          <RoomCard
            roomTitle={room.title ?? room.roomTitle}
            status={room.status}
            startingPointLabel={room.routeSummary?.startLabel ?? room.safePreview?.startingPointLabel ?? 'Start hidden'}
            destinationLabel={room.routeSummary?.destinationLabel ?? room.safePreview?.destinationLabel ?? 'Destination hidden'}
            inviteCode={room.inviteCode}
            predictionCloseTime={room.lockTime ?? room.safePreview?.predictionCloseTime}
          />
          <View style={[styles.previewNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Room snapshot</Text>
            <Text style={[styles.previewCopy, { color: colors.textSecondary }]}>
              {room.question} {room.participantCount ? `${room.participantCount} participants so far.` : 'Be the first to join.'}
            </Text>
            <StatusPill label={lockLabel} tone="warning" />
            <Text style={[styles.funLine, { color: palette.violetLight }]}>Think they're wrong? Prove it.</Text>
          </View>
          {actionLabel[room.status === 'prediction_open' ? 'predictions_open' : room.status] && (
            <PrimaryButton label={actionLabel[room.status === 'prediction_open' ? 'predictions_open' : room.status]} onPress={handleAction} loading={loading} />
          )}
          {!isAuthenticated && actionLabel[room.status === 'prediction_open' ? 'predictions_open' : room.status] ? (
            <PrimaryButton
              label="Login to Submit Prediction"
              onPress={async () => {
                await savePendingJoinCode(room.inviteCode ?? code);
                navigation.navigate('Login');
              }}
              variant="secondary"
            />
          ) : null}
          {!isAuthenticated ? (
            <PrimaryButton
              label="Create Account"
              onPress={async () => {
                await savePendingJoinCode(room.inviteCode ?? code);
                navigation.navigate('Register');
              }}
              variant="ghost"
            />
          ) : null}
          {!actionLabel[room.status === 'prediction_open' ? 'predictions_open' : room.status] && (
            <Text style={[styles.statusMsg, { color: colors.textMuted }]}>
              This room is {room.status.replace(/_/g, ' ')}.
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', padding: 24 },
  heading: { fontSize: 26, fontWeight: '800', marginBottom: 6 },
  sub: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  card: { borderRadius: 18, padding: 18, borderWidth: 1, marginBottom: 24 },
  result: { marginTop: 4 },
  foundPill: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 10 },
  foundText: { fontWeight: '700', fontSize: 13 },
  previewNotice: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  previewTitle: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  previewCopy: { fontSize: 13, lineHeight: 19 },
  funLine: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  statusMsg: { textAlign: 'center', marginTop: 12, fontSize: 14 },
});
