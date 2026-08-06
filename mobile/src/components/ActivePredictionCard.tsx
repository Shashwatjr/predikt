import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ProgressBar from './ProgressBar';
import { botEtaTeaser, botEtaRead } from '../utils/botVoice';
import { palette, radius, spacing } from '../theme/designSystem';
import { journeyMono, journeyPalette } from '../theme/journeyPalette';
import {
  formatJourneyRoute,
  journeyPillLabel,
  journeyPillTone,
  shouldShowStatusSentence,
  JOURNEY_HOME_PLACE_MAX,
  type JourneyPillTone,
} from '../utils/journeyCardStatus';

type ActivePrediction = {
  roomId: string;
  title: string;
  status: string;
  winnerName?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  isCreator?: boolean;
  participantCount: number;
  hasSubmittedPrediction: boolean;
  routeSummary?: {
    startLabel?: string | null;
    destinationLabel?: string | null;
    travelMode?: string | null;
  } | null;
  journeyStatus?: string | null;
  liveProgress: {
    statusLabel: string;
    progressPercentApprox: number;
    etaLabel: string;
    etaTime?: string | null;
    etaVsMyPredictionLabel?: string | null;
    timeToDestinationLabel?: string | null;
    lifecycleLabel?: string | null;
  };
  quickAction: {
    label: string;
  };
  pinned: boolean;
};

type Props = {
  item: ActivePrediction;
  onOpen: () => void;
  onDelete?: () => void;
  onTogglePin: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
  variant?: 'default' | 'journeyHome';
};

export type ActivePredictionCardVariant = NonNullable<Props['variant']>;

function journeyPillColor(tone: JourneyPillTone): string {
  if (tone === 'live') return journeyPalette.green;
  if (tone === 'wait') return journeyPalette.orange;
  if (tone === 'done') return journeyPalette.cyan;
  return journeyPalette.blueLight;
}

function friendlyActionLabel(item: ActivePrediction) {
  const status = item.status.toLowerCase();
  const journeyStatus = String(item.journeyStatus ?? '').toLowerCase();

  if (
    ['result_ready', 'completed', 'reached'].includes(status) ||
    ['auto_closed', 'abandoned', 'plan_changed', 'cancelled_by_host'].includes(journeyStatus)
  ) {
    return 'View Result';
  }
  if (status === 'predictions_open' && !item.hasSubmittedPrediction) {
    return 'Predict now';
  }
  return 'Open Journey';
}

function formatJourneyDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

function formatJourneyTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function friendlyStatusText(item: ActivePrediction) {
  const status = item.status.toLowerCase();
  const journeyStatus = String(item.journeyStatus ?? '').toLowerCase();

  if (status === 'live') return 'LIVE';
  if (status === 'predictions_open' && !item.hasSubmittedPrediction) return 'Waiting for your prediction';
  if (status === 'predictions_open' && item.hasSubmittedPrediction) return 'Prediction locked in';
  if (['result_ready', 'completed', 'reached'].includes(status)) return 'Result ready';
  if (['auto_closed', 'abandoned', 'plan_changed', 'cancelled_by_host'].includes(journeyStatus)) {
    return 'This journey ended automatically';
  }
  if (status === 'predictions_locked') return 'Predictions closed';
  return 'Journey ready';
}

function friendlyParticipantLabel(count: number) {
  if (!Number.isFinite(count) || count <= 1) return null;
  return `${count} ${count === 1 ? 'friend' : 'friends'} joined`;
}

export default function ActivePredictionCard({
  item,
  onOpen,
  onDelete,
  onTogglePin,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
  variant = 'default',
}: Props) {
  const { colors } = useTheme();
  const isJourneyHome = variant === 'journeyHome';
  const normalizedStatus = item.status.toLowerCase();
  const isSuccessState = ['result_ready', 'completed', 'reached'].includes(normalizedStatus);
  const isLiveState = normalizedStatus === 'live';
  const isWarningState = ['locked', 'overdue', 'cancelled'].includes(normalizedStatus);
  const isDangerState = ['failed', 'error'].includes(normalizedStatus);
  // Live-Now cards speak in the bot's voice instead of dropping a bare ETA number,
  // so a first-timer instantly reads it as "the mark to beat".
  const botLine =
    item.status === 'live'
      ? item.hasSubmittedPrediction
        ? botEtaRead(item.liveProgress.etaTime ?? item.liveProgress.etaLabel)
        : botEtaTeaser(item.liveProgress.etaTime ?? item.liveProgress.etaLabel)
      : null;
  const cardBorderColor = isJourneyHome ? journeyPalette.borderStrong : palette.border;
  const cardBackgroundColor = isJourneyHome ? journeyPalette.surface : palette.surface;
  const pillTone = journeyPillTone(item.status, item.hasSubmittedPrediction);
  const pillColor = journeyPillColor(pillTone);
  const badgeBackgroundColor = isJourneyHome
    ? isDangerState
      ? 'rgba(239,68,68,0.16)'
      : isWarningState
        ? 'rgba(251,191,36,0.16)'
        : isLiveState || isSuccessState
          ? 'rgba(34,197,94,0.16)'
          : 'rgba(139,92,246,0.18)'
    : colors.purpleDim;
  const badgeTextColor = isJourneyHome
    ? isDangerState
      ? '#FCA5A5'
      : isWarningState
        ? '#FCD34D'
        : isLiveState || isSuccessState
          ? '#86EFAC'
          : journeyPalette.blueLight
    : colors.purpleLight;
  const badgeBorderColor = isJourneyHome
    ? isDangerState
      ? 'rgba(239,68,68,0.35)'
      : isWarningState
        ? 'rgba(251,191,36,0.35)'
        : isLiveState || isSuccessState
          ? 'rgba(34,197,94,0.35)'
          : 'rgba(96,165,250,0.32)'
    : 'transparent';
  const primaryActionBackground = isJourneyHome ? journeyPalette.purple : colors.purple;
  const secondaryActionBorder = isJourneyHome ? journeyPalette.border : 'rgba(255,255,255,0.18)';
  const secondaryActionBackground = isJourneyHome ? 'rgba(24,26,66,0.78)' : 'rgba(255,255,255,0.04)';
  const botLineColor = isJourneyHome ? journeyPalette.purpleLight : palette.violetLight;
  const progressAccentColors = isJourneyHome ? journeyPalette.gradAccent : colors.gradPrimary;
  const progressPercentColor = isJourneyHome
    ? isLiveState || isSuccessState
      ? colors.green
      : journeyPalette.blueLight
    : colors.purple;
  const progressTrackColor = isJourneyHome ? 'rgba(68,76,120,0.92)' : colors.border;
  const progressTickColor = isJourneyHome ? 'rgba(20,22,45,0.95)' : colors.bg;
  const progressDotColor = isJourneyHome ? journeyPalette.textPrimary : '#fff';
  const cardAccentShadow = isJourneyHome ? styles.journeyHomeShadow : null;
  const badgeBorderStyle = isJourneyHome ? styles.journeyBadge : null;
  const friendlyRoute = formatJourneyRoute(
    item.routeSummary?.startLabel,
    item.routeSummary?.destinationLabel,
    isJourneyHome ? JOURNEY_HOME_PLACE_MAX : undefined,
  );
  const homeStatusText = friendlyStatusText(item);
  const homeActionLabel = friendlyActionLabel(item);
  const participantLabel = friendlyParticipantLabel(item.participantCount);
  const isTerminalJourney =
    ['result_ready', 'completed', 'reached', 'cancelled'].includes(item.status.toLowerCase()) ||
    ['auto_closed', 'abandoned', 'plan_changed', 'cancelled_by_host', 'completed'].includes(
      String(item.journeyStatus ?? '').toLowerCase(),
    );
  const completedDateLabel = formatJourneyDate(item.completedAt ?? item.updatedAt ?? item.createdAt);
  const completedTimeLabel = formatJourneyTime(item.completedAt ?? item.updatedAt);
  const compactPredictionLabel =
    item.hasSubmittedPrediction && item.liveProgress.etaTime
      ? item.liveProgress.etaTime
      : item.liveProgress.etaVsMyPredictionLabel === 'Prediction submitted'
        ? 'Prediction locked'
        : null;
  const primaryTimingLine =
    item.status.toLowerCase() === 'live'
      ? `Map ETA: ${item.liveProgress.timeToDestinationLabel ?? item.liveProgress.etaTime ?? 'Updating'}`
      : item.status.toLowerCase() === 'predictions_open' && !item.hasSubmittedPrediction
        ? null
        : ['result_ready', 'completed', 'reached'].includes(item.status.toLowerCase())
          ? 'Journey complete'
          : item.liveProgress.timeToDestinationLabel || item.liveProgress.etaTime
            ? `ETA: ${item.liveProgress.timeToDestinationLabel ?? item.liveProgress.etaTime}`
            : null;
  const secondaryTimingLine =
    item.status.toLowerCase() === 'live' && item.hasSubmittedPrediction
      ? `Your prediction: ${item.liveProgress.etaVsMyPredictionLabel === 'Prediction submitted'
          ? 'Submitted'
          : item.liveProgress.etaVsMyPredictionLabel === 'ETA is close to your prediction'
            ? 'Very close'
            : item.liveProgress.etaVsMyPredictionLabel?.replace(/^ETA is about\s*/i, '').replace(/\slater than your prediction$/i, ' later').replace(/\searlier than your prediction$/i, ' earlier') ?? 'Locked in'}`
      : null;

  if (isJourneyHome) {
    return (
      <View
        style={[
          styles.card,
          cardAccentShadow,
          styles.journeyHomeCard,
          { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor },
        ]}
      >
        <View style={styles.journeyHomeTopRow}>
          <View style={styles.journeyHomeRouteCluster}>
            <View style={styles.journeyHomeIconOrb}>
              <Text style={styles.journeyHomeIconGlyph}>
                {item.status.toLowerCase() === 'live'
                  ? '🏙'
                  : ['result_ready', 'completed', 'reached'].includes(item.status.toLowerCase())
                    ? '✈️'
                    : '☕'}
              </Text>
            </View>
            <View style={styles.journeyHomeRouteCopy}>
              <Text style={styles.journeyHomeRoute} numberOfLines={2}>
                {friendlyRoute}
              </Text>
              {compactPredictionLabel ? (
                <Text style={styles.journeyHomePredictionChip}>{compactPredictionLabel}</Text>
              ) : null}
            </View>
          </View>
          <View
            style={[
              styles.journeyHomePill,
              {
                backgroundColor: `${pillColor}1F`,
                borderColor: `${pillColor}47`,
              },
            ]}
          >
            <View style={[styles.journeyHomePillDot, { backgroundColor: pillColor }]} />
            <Text style={[styles.journeyHomePillText, { color: pillColor }]} numberOfLines={1}>
              {journeyPillLabel(pillTone, item.status, item.hasSubmittedPrediction, item.journeyStatus)}
            </Text>
          </View>
        </View>

        {/* Only when the short pill label doesn't already say it — otherwise the
            card repeated "Result ready" twice in a row. */}
        {shouldShowStatusSentence(pillTone) ? (
          <Text style={styles.journeyHomeStatus}>{homeStatusText}</Text>
        ) : null}

        {primaryTimingLine ? (
          <Text style={styles.journeyHomeTiming}>{primaryTimingLine}</Text>
        ) : null}

        {secondaryTimingLine ? (
          <Text style={styles.journeyHomeSecondaryTiming}>{secondaryTimingLine}</Text>
        ) : null}

        {isTerminalJourney ? (
          <View style={styles.journeyHomeSummary}>
            {completedDateLabel ? <Text style={styles.journeyHomeMeta}>{completedDateLabel}</Text> : null}
            {item.winnerName ? (
              <Text style={styles.journeyHomeMeta}>Winner: {item.winnerName}</Text>
            ) : null}
            {completedTimeLabel ? (
              <Text style={styles.journeyHomeMeta}>Completed: {completedTimeLabel}</Text>
            ) : null}
            <Text style={styles.journeyHomeMeta}>
              {item.participantCount} {item.participantCount === 1 ? 'participant' : 'participants'}
            </Text>
          </View>
        ) : participantLabel ? (
          <Text style={styles.journeyHomeMeta}>{participantLabel}</Text>
        ) : null}

        {item.status.toLowerCase() === 'live' ? (
          <ProgressBar
            percentage={item.liveProgress.progressPercentApprox}
            accentColors={progressAccentColors}
            percentColor={progressPercentColor}
            trackColor={progressTrackColor}
            tickColor={progressTickColor}
            dotColor={progressDotColor}
            showSegments={false}
          />
        ) : null}

        <TouchableOpacity
          style={[
            styles.primaryAction,
            styles.journeyHomePrimaryAction,
            styles.journeyHomeSingleAction,
            { backgroundColor: primaryActionBackground },
          ]}
          onPress={onOpen}
        >
          <Text style={styles.primaryActionText}>{homeActionLabel}</Text>
        </TouchableOpacity>

        {onDelete ? (
          <TouchableOpacity
            style={styles.journeyHomeDeleteAction}
            onPress={onDelete}
            accessibilityRole="button"
          >
            <Text style={styles.journeyHomeDeleteText}>Delete journey</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        cardAccentShadow,
        { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={[styles.meta, { color: 'rgba(255,255,255,0.68)' }]}>
            {item.liveProgress.statusLabel} • {item.participantCount} participants
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            badgeBorderStyle,
            { backgroundColor: badgeBackgroundColor, borderColor: badgeBorderColor },
          ]}
        >
          <Text style={[styles.badgeText, { color: badgeTextColor }]}>{item.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      <Text style={[styles.route, { color: 'rgba(255,255,255,0.82)' }]}>
        {item.routeSummary?.startLabel ?? 'Start'} → {item.routeSummary?.destinationLabel ?? 'Destination'}
      </Text>

      <ProgressBar
        percentage={item.liveProgress.progressPercentApprox}
        label="Approximate progress"
        accentColors={progressAccentColors}
        percentColor={progressPercentColor}
        trackColor={progressTrackColor}
        tickColor={progressTickColor}
        dotColor={progressDotColor}
      />

      <View style={styles.infoRow}>
        <Text style={[styles.infoText, { color: 'rgba(255,255,255,0.72)' }]}>
          {item.liveProgress.etaLabel}{item.liveProgress.etaTime ? `: ${item.liveProgress.etaTime}` : ''}
        </Text>
        <Text style={[styles.infoText, { color: 'rgba(255,255,255,0.58)' }]}>
          {item.liveProgress.timeToDestinationLabel ?? (item.hasSubmittedPrediction ? 'Prediction submitted' : 'Needs your prediction')}
        </Text>
      </View>

      <Text style={[styles.predictionLabel, { color: item.hasSubmittedPrediction ? colors.green : '#fbbf24' }]}>
        {item.liveProgress.etaVsMyPredictionLabel ?? (item.hasSubmittedPrediction ? 'Prediction submitted' : 'Needs your prediction')}
      </Text>

      {botLine ? (
        <Text style={[styles.botLine, { color: botLineColor }]}>🤖 {botLine}</Text>
      ) : null}

      {item.liveProgress.lifecycleLabel ? (
        <Text style={[styles.lifecycleLabel, { color: '#A5F3FC' }]}>{item.liveProgress.lifecycleLabel}</Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryAction, isJourneyHome ? styles.journeyHomePrimaryAction : null, { backgroundColor: primaryActionBackground }]}
          onPress={onOpen}
        >
          <Text style={styles.primaryActionText}>{item.quickAction.label}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconAction, { borderColor: secondaryActionBorder, backgroundColor: secondaryActionBackground }]}
          onPress={onTogglePin}
        >
          <Text style={styles.iconActionText}>{item.pinned ? 'Unpin' : 'Pin'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.iconAction,
            { borderColor: secondaryActionBorder, backgroundColor: secondaryActionBackground },
            disableMoveUp && styles.iconActionDisabled,
          ]}
          onPress={onMoveUp}
          disabled={disableMoveUp}
        >
          <Text style={styles.iconActionText}>Up</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.iconAction,
            { borderColor: secondaryActionBorder, backgroundColor: secondaryActionBackground },
            disableMoveDown && styles.iconActionDisabled,
          ]}
          onPress={onMoveDown}
          disabled={disableMoveDown}
        >
          <Text style={styles.iconActionText}>Down</Text>
        </TouchableOpacity>
        {onDelete ? (
          <TouchableOpacity style={[styles.iconAction, styles.deleteAction]} onPress={onDelete}>
            <Text style={styles.iconActionText}>Delete</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  journeyHomeCard: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 9,
  },
  header: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  headerText: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '900' },
  meta: { fontSize: 11, marginTop: 3, fontWeight: '700' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  journeyBadge: { borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '900', textTransform: 'capitalize' },
  journeyHomeTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  journeyHomeRouteCluster: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minWidth: 0 },
  journeyHomeRouteCopy: { flex: 1, gap: 6 },
  journeyHomeIconOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: journeyPalette.borderStrong,
  },
  journeyHomeIconGlyph: { fontSize: 26 },
  journeyHomeRoute: { flex: 1, color: journeyPalette.textPrimary, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  journeyHomePredictionChip: {
    alignSelf: 'flex-start',
    color: journeyPalette.blueLight,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  journeyHomeStatus: { color: journeyPalette.textSecondary, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  // Times are monospaced so digits line up between stacked cards in the grid.
  journeyHomeTiming: {
    color: journeyPalette.textPrimary,
    fontFamily: journeyMono,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  journeyHomeSecondaryTiming: { color: journeyPalette.textSecondary, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  journeyHomeSummary: { gap: 2 },
  journeyHomeMeta: { color: journeyPalette.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  journeyHomePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 11,
    flexShrink: 0,
  },
  journeyHomePillDot: { width: 7, height: 7, borderRadius: 3.5 },
  journeyHomePillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  route: { fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  infoText: { fontSize: 11, flex: 1 },
  predictionLabel: { fontSize: 12, fontWeight: '800' },
  botLine: { color: palette.violetLight, fontSize: 12, fontWeight: '800', fontStyle: 'italic' },
  lifecycleLabel: { fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  primaryAction: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  journeyHomePrimaryAction: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 3,
  },
  journeyHomeSingleAction: {
    width: '100%',
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyHomeDeleteAction: {
    alignSelf: 'flex-end',
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  journeyHomeDeleteText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  primaryActionText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  iconAction: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  iconActionText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  iconActionDisabled: { opacity: 0.45 },
  deleteAction: { borderColor: 'rgba(248,113,113,0.45)', backgroundColor: 'rgba(127,29,29,0.18)' },
  journeyHomeShadow: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
  },
});
