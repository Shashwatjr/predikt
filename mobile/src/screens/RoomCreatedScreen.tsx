import React, { useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { appAlert } from '../utils/appAlert';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import PrimaryButton from '../components/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import TextInputField from '../components/TextInputField';
import api from '../services/api';
import {
  buildManualWhatsAppUrl,
  buildSharePayload,
  isValidManualPhone,
  openWhatsAppWithText,
  shareViaWebShareApi,
} from '../utils/shareRoom';
import { journeyPalette } from '../theme/journeyPalette';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RoomCreated'>;
  route: RouteProp<RootStackParamList, 'RoomCreated'>;
};

function shortenPlaceLabel(label?: string | null) {
  const raw = (label ?? '').trim();
  if (!raw) return '';
  const firstChunk = raw.split(',')[0]?.trim() || raw;
  return firstChunk.length > 26 ? `${firstChunk.slice(0, 23).trimEnd()}…` : firstChunk;
}

function buildShortRouteLabel(room: any, fallback: string) {
  const start = shortenPlaceLabel(room.startingPointLabel ?? room.routeSummary?.startLabel);
  const end = shortenPlaceLabel(room.destinationLabel ?? room.routeSummary?.destinationLabel);
  if (!start && !end) return fallback;
  return `${start || 'Start'} → ${end || 'Destination'}`;
}

export default function RoomCreatedScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { room } = route.params;
  const inviteCode = room.inviteCode ?? room.code ?? '';
  const [manualPhone, setManualPhone] = useState('');
  const [showManualShare, setShowManualShare] = useState(false);
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [lastCopiedLabel, setLastCopiedLabel] = useState<string | null>(null);
  const sharePayload = useMemo(() => buildSharePayload({ ...room, inviteCode }), [room, inviteCode]);
  const creationMeta = room.scoringRule?.creationMeta ?? room.creationMeta ?? {};
  const category = room.category ?? creationMeta.category ?? room.templateKey;
  const expectedDurationMinutes = Math.round(
    (room.expectedDurationSeconds ??
      room.route?.estimatedDurationSeconds ??
      room.journeyRoute?.estimatedDurationSeconds ??
      3600) / 60,
  );
  const plannedStartAt = room.journeyScheduledStartAt ? new Date(room.journeyScheduledStartAt) : null;
  const predictionCloseAt = room.predictionCloseTime ? new Date(room.predictionCloseTime) : null;
  const expectedArrivalAt =
    plannedStartAt && Number.isFinite(expectedDurationMinutes)
      ? new Date(plannedStartAt.getTime() + expectedDurationMinutes * 60 * 1000)
      : null;
  const shortRouteLabel = buildShortRouteLabel(room, sharePayload.shareTitle);
  const formatDateTime = (value: Date | null) =>
    value && !Number.isNaN(value.getTime())
      ? value.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'Set on room';
  const detailRows = [
    { icon: '🏷️', label: 'Room', value: sharePayload.shareTitle },
    { icon: '📍', label: 'From', value: room.startingPointLabel ?? 'Start' },
    { icon: '🏁', label: 'To', value: room.destinationLabel ?? 'Destination' },
    { icon: '⏱️', label: 'Journey time', value: `${expectedDurationMinutes} min` },
    { icon: '🕒', label: 'Provider arrival', value: formatDateTime(expectedArrivalAt) },
    { icon: '🚦', label: 'Planned start', value: formatDateTime(plannedStartAt) },
    { icon: '🔒', label: 'Predictions close', value: formatDateTime(predictionCloseAt) },
    { icon: '🔐', label: 'Privacy', value: 'Friends see delayed progress, not your exact location' },
  ];

  async function trackShare(action: string, channel: string) {
    try {
      await api.post(`/rooms/${room.roomId}/share-events`, { action, channel });
    } catch {
      // Non-blocking analytics / audit.
    }
  }

  async function copyText(label: string, value: string) {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        await trackShare('room_shared', label === 'Invite link' ? 'link' : 'copy');
        setLastCopiedLabel(label);
        appAlert(`${label} copied`, 'Your invite is ready to send.');
        return;
      }
      await Share.share({ message: value, title: label });
      await trackShare('room_shared', 'native_share');
    } catch {
      appAlert('Copy unavailable', value);
    }
  }

  async function invitePeople() {
    if (Platform.OS === 'web') {
      const shared = await shareViaWebShareApi({
        shareTitle: `Join ${sharePayload.shareTitle}`,
        shareText: sharePayload.shareText,
        inviteUrl: sharePayload.inviteUrl,
      });
      if (shared) {
        await trackShare('room_shared', 'web_share');
        return;
      }
      await copyText('Invite link', sharePayload.inviteUrl);
      return;
    }
    await Share.share({
      message: sharePayload.shareText,
      title: `Join ${sharePayload.shareTitle}`,
    });
    await trackShare('room_shared', 'native_share');
  }

  async function openWhatsAppShare() {
    await trackShare('room_shared', 'whatsapp');
    const opened = await openWhatsAppWithText(sharePayload.whatsappText);
    if (opened) return;
    await copyText('Invite link', sharePayload.inviteUrl);
    appAlert('WhatsApp did not open', 'The invite link was copied — paste it into WhatsApp.');
  }

  async function copyInstagramCaption() {
    await copyText('Instagram caption', sharePayload.instagramCaption);
    await trackShare('room_shared', 'instagram');
  }

  async function openManualWhatsAppInvite() {
    if (!isValidManualPhone(manualPhone)) {
      appAlert('Invalid phone number', 'Use digits only with an optional + prefix.');
      return;
    }
    await trackShare('room_shared', 'phone_manual');
    await Linking.openURL(buildManualWhatsAppUrl(manualPhone, sharePayload.whatsappText));
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <View style={styles.titleWrap}>
          <Text style={[styles.heading, { color: journeyPalette.textPrimary }]}>Your journey is live 🎉</Text>
          <Text style={[styles.subheading, { color: journeyPalette.textSecondary }]}>
            Invite friends before predictions close.
          </Text>
        </View>
        <View style={styles.topBarAction}>
          <PrimaryButton
            label="Share"
            onPress={invitePeople}
            variant="secondary"
            fullWidth={false}
          />
        </View>
      </View>

      <LinearGradient
        colors={journeyPalette.gradHeroSurface}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.codeCard}
      >
        <Text style={styles.codeKicker}>Invite code</Text>
        <Text style={styles.routeTitle}>{shortRouteLabel}</Text>
        <Text style={styles.codeStatus}>Predictions are open</Text>
        <Text style={styles.code}>{inviteCode}</Text>
        <Text style={styles.codeHint}>
          Anyone with this code can open the room and predict. Friends see privacy-safe progress, not exact live GPS.
        </Text>
        <View style={styles.codeActions}>
          <View style={styles.codeAction}>
            <PrimaryButton
              label="Copy Code"
              onPress={() => copyText('Room code', inviteCode)}
              gradientColors={journeyPalette.gradAccent}
            />
          </View>
          <View style={styles.codeAction}>
            <PrimaryButton
              label="Copy Invite Link"
              onPress={() => copyText('Invite link', sharePayload.inviteUrl)}
              variant="secondary"
            />
          </View>
        </View>
      </LinearGradient>

      {lastCopiedLabel ? (
        <View style={[styles.feedbackBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>{lastCopiedLabel} copied</Text>
          <Text style={[styles.feedbackCopy, { color: colors.textSecondary }]}>
            Share it now so friends can lock in their predictions.
          </Text>
        </View>
      ) : null}

      <View style={[styles.shareCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.shareTitle, { color: colors.textPrimary }]}>Invite friends now</Text>
        <Text style={[styles.shareCopy, { color: colors.textSecondary }]}>
          Send the link once. Friends land straight in the join flow.
        </Text>
        <View style={styles.shareGrid}>
          <View style={styles.shareCell}>
            <PrimaryButton label="WhatsApp" onPress={openWhatsAppShare} fullWidth />
          </View>
          <View style={styles.shareCell}>
            <PrimaryButton label="Preview what friends see" onPress={() => setShowRoomDetails((value) => !value)} variant="secondary" fullWidth />
          </View>
        </View>
        <TouchableOpacity style={styles.moreToggle} onPress={() => setShowManualShare((value) => !value)}>
          <Text style={styles.moreToggleText}>
            {showManualShare ? 'Hide extra share options' : 'More ways to share'}
          </Text>
        </TouchableOpacity>

        {showManualShare ? (
          <View style={styles.moreShareStack}>
            <View style={styles.shareGrid}>
              <View style={styles.shareCell}>
                <PrimaryButton label="Native Share" onPress={invitePeople} variant="secondary" fullWidth />
              </View>
              <View style={styles.shareCell}>
                <PrimaryButton label="Instagram Caption" onPress={copyInstagramCaption} variant="secondary" fullWidth />
              </View>
            </View>
            <Text style={[styles.manualShareLabel, { color: colors.textPrimary }]}>Manual WhatsApp invite</Text>
            <Text style={[styles.manualShareCopy, { color: colors.textSecondary }]}>
              My Prediktion does not upload your contacts. This opens WhatsApp on your device.
            </Text>
            <TextInputField
              label="Phone number"
              value={manualPhone}
              onChangeText={setManualPhone}
              placeholder="+919876543210"
              keyboardType="phone-pad"
            />
            <PrimaryButton label="Create WhatsApp Invite" onPress={openManualWhatsAppInvite} variant="secondary" />
          </View>
        ) : null}
      </View>

      {showRoomDetails ? (
        <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {detailRows.map(({ icon, label, value }) => (
            <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
              <Text style={styles.detailIcon}>{icon}</Text>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <PrimaryButton
        label="Go to Room"
        onPress={() => navigation.navigate('LiveRoom', { roomId: room.roomId, isCreator: true })}
        gradientColors={journeyPalette.gradAccent}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 14,
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleWrap: { flex: 1, gap: 4 },
  heading: { fontSize: 28, lineHeight: 32, fontWeight: '900' },
  subheading: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  topBarAction: { minWidth: 108 },
  codeCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: journeyPalette.borderStrong,
    backgroundColor: journeyPalette.surface,
    padding: 20,
    gap: 12,
  },
  codeKicker: {
    color: journeyPalette.purpleLight,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  routeTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 26, fontWeight: '900' },
  codeStatus: { color: '#34D399', fontSize: 14, fontWeight: '800' },
  code: {
    color: '#FFFFFF',
    fontSize: 48,
    lineHeight: 54,
    fontWeight: '900',
    letterSpacing: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  codeHint: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  codeActions: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  codeAction: { flex: 1, minWidth: 180 },
  feedbackBanner: { width: '100%', borderRadius: 18, borderWidth: 1, padding: 14 },
  feedbackTitle: { fontSize: 14, fontWeight: '900', marginBottom: 3 },
  feedbackCopy: { fontSize: 13, lineHeight: 18 },
  shareCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  shareTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900' },
  shareCopy: { fontSize: 13, lineHeight: 18 },
  shareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  shareCell: { flex: 1, minWidth: 180 },
  moreToggle: { alignSelf: 'center', paddingVertical: 6 },
  moreToggleText: { color: journeyPalette.purpleLight, fontSize: 13, fontWeight: '800' },
  moreShareStack: { gap: 12, paddingTop: 4 },
  manualShareLabel: { fontSize: 15, fontWeight: '900' },
  manualShareCopy: { fontSize: 13, lineHeight: 18 },
  detailCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  detailIcon: { fontSize: 16, width: 22 },
  detailLabel: { width: 96, fontSize: 13, fontWeight: '700' },
  detailValue: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '600' },
});
