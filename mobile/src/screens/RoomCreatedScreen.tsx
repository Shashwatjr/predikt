import React, { useMemo, useState } from 'react';
import { Alert, Platform, View, Text, StyleSheet, ScrollView, Share, Linking, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import PrimaryButton from '../components/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import TextInputField from '../components/TextInputField';
import api from '../services/api';
import { buildManualWhatsAppUrl, buildSharePayload, isValidManualPhone } from '../utils/shareRoom';
import { getRoomTheme } from '../config/categoryTheme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RoomCreated'>;
  route: RouteProp<RootStackParamList, 'RoomCreated'>;
};

export default function RoomCreatedScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { room } = route.params;
  const inviteCode = room.inviteCode ?? room.code ?? '';
  const isGroupJourney = room.roomType === 'group_journey';
  const [manualPhone, setManualPhone] = useState('');
  const [showManualShare, setShowManualShare] = useState(false);
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const sharePayload = useMemo(() => buildSharePayload({ ...room, inviteCode }), [room, inviteCode]);
  const creationMeta = room.scoringRule?.creationMeta ?? room.creationMeta ?? {};
  const category = room.category ?? creationMeta.category ?? room.templateKey;
  const isGenericRoom = category === 'open_prediction';
  // Subtype-aware label (Custom Challenge or Sports) from the single source of truth.
  const genericRoomLabel = getRoomTheme(room).label;
  const forecastSnapshot = room.baselineSnapshot ?? creationMeta.baselineSnapshot;
  const oracleBotPrediction = room.oracleBotPrediction ?? creationMeta.oracleBotPrediction;
  const expectedDurationMinutes = Math.round((room.expectedDurationSeconds ?? room.route?.estimatedDurationSeconds ?? room.journeyRoute?.estimatedDurationSeconds ?? 3600) / 60);
  const detailRows = [
    { icon: '🏷️', label: 'Room', value: sharePayload.shareTitle },
    category === 'weather_rain'
      ? { icon: '🌧️', label: 'Forecast', value: forecastSnapshot ? `${forecastSnapshot.forecastChancePercent}% between ${forecastSnapshot.forecastWindow}` : 'Snapshot stored' }
      : null,
    category === 'weather_rain'
      ? { icon: '📌', label: 'Provider', value: forecastSnapshot?.forecastProviderLabel ?? room.baselineSource ?? 'Manual forecast' }
      : null,
    category === 'weather_rain'
      ? { icon: '🤖', label: 'Oracle', value: oracleBotPrediction?.label ?? oracleBotPrediction?.selectedOptionKey?.replace(/_/g, ' ') ?? 'Benchmark stored' }
      : null,
    { icon: '📍', label: category === 'weather_rain' ? 'Place' : 'From', value: room.startingPointLabel },
    { icon: '🏁', label: category === 'weather_rain' ? 'Window' : 'To', value: room.destinationLabel },
    { icon: '🎯', label: 'Prediction', value: room.answerType?.replace('_', ' ') ?? 'exact time' },
    room.answerType === 'multiple_choice'
      ? { icon: '✅', label: 'Options', value: (creationMeta.options ?? room.options ?? []).map((option: string) => option.replace(/_/g, ' ')).join(' / ') }
      : null,
    room.answerType !== 'multiple_choice'
      ? { icon: '⏱️', label: 'Expected', value: `${expectedDurationMinutes} min` }
      : null,
    { icon: '🔒', label: 'Lock', value: room.predictionCloseTime ? new Date(room.predictionCloseTime).toLocaleString() : 'Set on room' },
    room.answerType !== 'multiple_choice'
      ? { icon: '⌛', label: 'Close', value: room.autoCloseAt ? new Date(room.autoCloseAt).toLocaleString() : 'After journey time + grace' }
      : null,
    { icon: '🔒', label: 'Privacy', value: category === 'weather_rain' ? 'No exact address or live map' : 'Location shown with delay for safety' },
  ].filter(Boolean);

  async function trackShare(action: string, channel: string) {
    try {
      await api.post(`/rooms/${room.roomId}/share-events`, { action, channel });
    } catch {
      // Sharing should still work even if analytics/audit is unavailable.
    }
  }

  async function copyText(label: string, value: string) {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        await trackShare('room_shared', label === 'Invite link' ? 'link' : 'copy');
        Alert.alert(`${label} copied`, value);
        return;
      }
      await Share.share({ message: value, title: label });
      await trackShare('room_shared', 'native_share');
    } catch {
      Alert.alert('Copy unavailable', value);
    }
  }

  async function invitePeople() {
    await Share.share({
      message: sharePayload.shareText,
      title: `Join ${sharePayload.shareTitle}`,
    });
    await trackShare('room_shared', 'native_share');
  }

  async function openWhatsAppShare() {
    await trackShare('room_shared', 'whatsapp');
    await Linking.openURL(sharePayload.whatsappUrl);
  }

  async function copyInstagramCaption() {
    await copyText('Instagram caption', sharePayload.instagramCaption);
    await trackShare('room_shared', 'instagram');
  }

  async function openManualWhatsAppInvite() {
    if (!isValidManualPhone(manualPhone)) {
      Alert.alert('Invalid phone number', 'Use digits only with an optional + prefix.');
      return;
    }
    await trackShare('room_shared', 'phone_manual');
    await Linking.openURL(buildManualWhatsAppUrl(manualPhone, sharePayload.whatsappText));
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.topRibbon}>
        <View style={styles.titleBlock}>
          <Text style={styles.emoji}>🎉</Text>
          <View>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>Room Created!</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {isGroupJourney
                ? 'Invite friends to join, opt in as travellers, and predict each other’s arrival time.'
                : isGenericRoom
                  ? `Share the ${genericRoomLabel} link below. Friends can join, predict, forward it onward, and challenge the attested result if needed.`
                  : 'Share the code below. Friends can join from the link and predict right away.'}
            </Text>
          </View>
        </View>
        <View style={styles.ribbonActions}>
          <PrimaryButton
            label="Share"
            onPress={invitePeople}
            icon="📨"
            fullWidth={false}
          />
          {isGenericRoom ? (
            <PrimaryButton
              label="Make my prediction"
              onPress={() => navigation.navigate('Prediction', { roomId: room.roomId, room })}
              variant="secondary"
              icon="🎯"
              fullWidth={false}
            />
          ) : null}
          <PrimaryButton
            label={isGenericRoom ? 'Open Room' : 'Go to Room'}
            onPress={() => navigation.navigate('LiveRoom', { roomId: room.roomId, isCreator: true })}
            variant="secondary"
            icon="▶️"
            fullWidth={false}
          />
        </View>
      </View>

      {/* Invite code hero card */}
      <LinearGradient
        colors={colors.gradPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.codeCard}
      >
        <Text style={styles.codeLabel}>Invite Code</Text>
        <Text style={styles.roomTitleHero}>{sharePayload.shareTitle}</Text>
        <Text style={styles.code}>{inviteCode}</Text>
        <Text style={styles.codeHint}>
          {isGenericRoom
            ? `Anyone with this code can join ${genericRoomLabel}. MVP rule: creator-attest result, Gems/Rizz framing, no screenshot proof upload.`
            : 'Anyone with this code can open the room and predict. No account needed for the first round.'}
        </Text>
      </LinearGradient>

      <View style={styles.copyGrid}>
        <View style={styles.copyAction}>
          <PrimaryButton label="Copy Code" onPress={() => copyText('Room code', inviteCode)} icon="📋" />
        </View>
        <View style={styles.copyAction}>
          <PrimaryButton label="Copy Invite Link" onPress={() => copyText('Invite link', sharePayload.inviteUrl)} variant="secondary" icon="🔗" />
        </View>
      </View>

      <View style={[styles.shareCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.shareTitle, { color: colors.textPrimary }]}>Invite friends</Text>
        <Text style={[styles.shareCopy, { color: colors.textSecondary }]}>
          {isGenericRoom
            ? `Send the link once. Friends can join ${genericRoomLabel}, pick a name, make their call, and forward the same room onward before lock.`
            : 'Send the link once. Friends land straight in the join flow, pick a name, and make their guess.'}
        </Text>
        <View style={styles.shareActions}>
          <View style={styles.shareAction}>
            <PrimaryButton label="WhatsApp" onPress={openWhatsAppShare} icon="💬" />
          </View>
          <View style={styles.shareAction}>
            <PrimaryButton label="Native Share" onPress={invitePeople} variant="secondary" icon="📨" />
          </View>
        </View>
        <View style={styles.shareActions}>
          <View style={styles.shareAction}>
            <PrimaryButton
              label={isGenericRoom ? 'Make my prediction' : 'Open Room'}
              onPress={() =>
                isGenericRoom
                  ? navigation.navigate('Prediction', { roomId: room.roomId, room })
                  : navigation.navigate('LiveRoom', { roomId: room.roomId, isCreator: true })
              }
              icon={isGenericRoom ? '🎯' : '▶️'}
            />
          </View>
          <View style={styles.shareAction}>
            <PrimaryButton label="Copy Instagram Caption" onPress={copyInstagramCaption} variant="secondary" icon="📸" />
          </View>
        </View>
        <TouchableOpacity style={styles.secondaryToggle} onPress={() => setShowManualShare((value) => !value)}>
          <Text style={[styles.secondaryToggleText, { color: colors.purpleLight }]}>
            {showManualShare ? 'Hide extra share options' : 'More ways to share'}
          </Text>
        </TouchableOpacity>
      </View>

      {showManualShare ? (
        <View style={[styles.shareCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.shareTitle, { color: colors.textPrimary }]}>Manual WhatsApp invite</Text>
          <Text style={[styles.shareCopy, { color: colors.textSecondary }]}>
            PREDIKT does not upload your contacts. This opens WhatsApp on your device.
          </Text>
          <TextInputField
            label="Phone number"
            value={manualPhone}
            onChangeText={setManualPhone}
            placeholder="+919876543210"
            keyboardType="phone-pad"
          />
          <PrimaryButton label="Create WhatsApp Invite" onPress={openManualWhatsAppInvite} variant="secondary" icon="📱" />
        </View>
      ) : null}

      <TouchableOpacity style={styles.secondaryToggle} onPress={() => setShowRoomDetails((value) => !value)}>
        <Text style={[styles.secondaryToggleText, { color: colors.purpleLight }]}>
          {showRoomDetails ? 'Hide room details' : 'See room details'}
        </Text>
      </TouchableOpacity>

      {showRoomDetails ? (
        <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {detailRows.map(({ icon, label, value }: any) => (
            <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
              <Text style={styles.detailIcon}>{icon}</Text>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={[styles.safetyCopy, { color: colors.textSecondary }]}>
        Participants see route labels and privacy-safe progress, not exact live GPS.
      </Text>
      <Text style={[styles.safetyCopy, { color: colors.textSecondary }]}>
        If plans change, cancel early so everyone gets a fair closure.
      </Text>

      <PrimaryButton
        label={isGenericRoom ? 'Make my prediction' : 'Start / Go to Room'}
        onPress={() =>
          isGenericRoom
            ? navigation.navigate('Prediction', { roomId: room.roomId, room })
            : navigation.navigate('LiveRoom', { roomId: room.roomId, isCreator: true })
        }
        icon={isGenericRoom ? '🎯' : '▶️'}
      />

      <PrimaryButton
        label="Back to Home"
        onPress={() => navigation.navigate('Home')}
        variant="secondary"
        icon="🏠"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 860, alignSelf: 'center', padding: 24, alignItems: 'center' },
  topRibbon: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    marginBottom: 22,
  },
  titleBlock: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  emoji: { fontSize: 42 },
  heading: { fontSize: 26, fontWeight: '900', marginBottom: 3 },
  sub: { fontSize: 14 },
  ribbonActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeCard: {
    width: '100%',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
  },
  codeLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  roomTitleHero: { color: '#ffffff', fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  code: { color: '#ffffff', fontSize: 52, fontWeight: '900', letterSpacing: 10, marginBottom: 8 },
  codeHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center' },
  copyGrid: { width: '100%', flexDirection: 'row', gap: 12, marginBottom: 12 },
  copyAction: { flex: 1 },
  shareCard: { width: '100%', borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 16 },
  shareTitle: { fontSize: 15, fontWeight: '900', marginBottom: 8 },
  shareCopy: { fontSize: 13, lineHeight: 19 },
  shareActions: { width: '100%', flexDirection: 'row', gap: 12, marginTop: 12 },
  shareAction: { flex: 1 },
  secondaryToggle: { alignSelf: 'center', paddingVertical: 8, marginTop: 2, marginBottom: 10 },
  secondaryToggleText: { fontSize: 13, fontWeight: '800' },
  detailCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  detailIcon: { fontSize: 18, width: 24 },
  detailLabel: { fontSize: 13, width: 50, fontWeight: '600' },
  detailValue: { flex: 1, fontSize: 15, fontWeight: '600' },
  safetyCopy: { width: '100%', textAlign: 'center', fontSize: 13, lineHeight: 18, marginTop: -8, marginBottom: 16 },
});
