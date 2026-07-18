import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import PrimaryButton from './PrimaryButton';

export interface DashboardOnboardingStep {
  title: string;
  body: string;
  sectionLabel: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

const steps: DashboardOnboardingStep[] = [
  {
    title: 'Welcome to PREDIKT',
    body: 'This is your prediction arena. Create rooms, join challenges, and see who gets closest.',
    sectionLabel: 'Dashboard overview',
  },
  {
    title: 'Aura',
    body: 'Aura shows your prediction accuracy and reputation. The closer your guess, the more Aura you can earn.',
    sectionLabel: 'Aura stat',
  },
  {
    title: 'Clout',
    body: 'Clout reflects your hosting and social influence. Create engaging rooms and bring real players to build Clout.',
    sectionLabel: 'Clout stat',
  },
  {
    title: 'Credits',
    body: 'Credits unlock in-app features.',
    sectionLabel: 'Credits and feature unlocks',
  },
  {
    title: 'Leaderboard',
    body: 'See how you rank among people you follow. Move up by making closer predictions.',
    sectionLabel: 'Following leaderboard',
  },
  {
    title: 'Active predictions',
    body: 'Join active rooms before they lock. Predictions stay hidden until lock to keep it fair.',
    sectionLabel: 'Active rooms',
  },
  {
    title: 'Create room',
    body: 'Start your own Prediction Room. Try arrival, delivery, gym, friend challenge, or custom.',
    sectionLabel: 'Create and join actions',
  },
  {
    title: 'Prediction Options',
    body: 'PREDIKT gives you simple choices like Arrival Time, Duration, or Yes/No so creating a room is fast.',
    sectionLabel: 'Guided setup',
  },
  {
    title: 'Route room privacy',
    body: 'Route rooms are privacy-safe. Participants see delayed or approximate progress, not exact live GPS.',
    sectionLabel: 'Journey privacy',
  },
  {
    title: 'Daily challenge and Drops',
    body: 'Daily challenges and Drops keep the game fun with virtual rewards.',
    sectionLabel: 'Daily challenge and Drops',
  },
  {
    title: 'Help and safety',
    body: 'Use Help anytime to learn the app, report issues, block users, or review privacy controls.',
    sectionLabel: 'Help and safety',
  },
];

export default function DashboardOnboardingOverlay({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);

  const step = useMemo(() => steps[stepIndex] ?? steps[0], [stepIndex]);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  function closeTour() {
    setStepIndex(0);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeTour}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeTour} />
        <View style={[styles.spotlight, { borderColor: colors.purple }]} />
        <LinearGradient colors={colors.gradSurface} style={[styles.card, { borderColor: colors.border }]}>
          <Text style={[styles.kicker, { color: colors.purpleLight }]}>
            Step {stepIndex + 1} of {steps.length}
          </Text>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{step.sectionLabel}</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{step.title}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{step.body}</Text>
          <View style={styles.progressRow}>
            {steps.map((tourStep, index) => (
              <View
                key={tourStep.title}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: index <= stepIndex ? colors.purple : colors.border,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.buttonRow}>
            <PrimaryButton
              label="Skip"
              onPress={closeTour}
              variant="ghost"
              fullWidth={false}
            />
            {!isFirst ? (
              <PrimaryButton
                label="Back"
                onPress={() => setStepIndex((current) => Math.max(0, current - 1))}
                variant="secondary"
                fullWidth={false}
              />
            ) : null}
            <PrimaryButton
              label={isLast ? 'Done' : 'Next'}
              onPress={() => {
                if (isLast) {
                  closeTour();
                  return;
                }
                setStepIndex((current) => current + 1);
              }}
              fullWidth={false}
            />
          </View>
          {isLast ? <Text style={[styles.footer, { color: colors.textMuted }]}>Start predicting</Text> : null}
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  spotlight: {
    position: 'absolute',
    top: '16%',
    width: 240,
    height: 120,
    borderRadius: 28,
    borderWidth: 2,
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '900',
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  progressRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 18,
  },
  progressDot: {
    width: 18,
    height: 6,
    borderRadius: 999,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  footer: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
});
