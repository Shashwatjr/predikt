import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import PrimaryButton from './PrimaryButton';
import { DEMO_SCENARIOS, type DemoScenario } from '../config/demoScenarios';

interface Props {
  visible: boolean;
  onClose: () => void;
  onBrowseAll?: () => void;
  onSelect: (scenario: DemoScenario) => void;
}

export default function DemoScenarioPicker({ visible, onClose, onBrowseAll, onSelect }: Props) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <LinearGradient colors={colors.gradSurface} style={[styles.card, { borderColor: colors.border }]}>
          <Text style={[styles.kicker, { color: colors.purpleLight }]}>Demo walkthrough</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Pick a scenario</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            This account has many seeded rooms for QA. Start with one focused example instead of scrolling the full hub.
          </Text>

          <View style={styles.scenarioList}>
            {DEMO_SCENARIOS.map((scenario) => (
              <TouchableOpacity
                key={scenario.key}
                style={[styles.scenarioRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => onSelect(scenario)}
              >
                <Text style={styles.scenarioIcon}>{scenario.icon}</Text>
                <View style={styles.scenarioCopy}>
                  <Text style={[styles.scenarioTitle, { color: colors.textPrimary }]}>{scenario.title}</Text>
                  <Text style={[styles.scenarioSubtitle, { color: colors.textSecondary }]}>{scenario.subtitle}</Text>
                  <Text style={[styles.scenarioCode, { color: colors.textMuted }]}>{scenario.inviteCode}</Text>
                </View>
                <Text style={[styles.scenarioArrow, { color: colors.purpleLight }]}>→</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.buttonRow}>
            <PrimaryButton
              label="Browse all rooms"
              onPress={() => {
                onBrowseAll?.();
                onClose();
              }}
              variant="secondary"
              fullWidth={false}
            />
            <PrimaryButton label="Skip for now" onPress={onClose} variant="ghost" fullWidth={false} />
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

interface BannerProps {
  roomCount: number;
  hubExpanded: boolean;
  onSelect: (scenario: DemoScenario) => void;
  onToggleHub: () => void;
  onOpenPicker: () => void;
}

export function DemoWalkthroughBanner({
  roomCount,
  hubExpanded,
  onSelect,
  onToggleHub,
  onOpenPicker,
}: BannerProps) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerHeader}>
        <Text style={styles.bannerTitle}>Demo walkthrough</Text>
        <TouchableOpacity onPress={onOpenPicker}>
          <Text style={styles.bannerLink}>All scenarios</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.bannerCopy}>Jump straight into a seeded example.</Text>
      <View style={styles.bannerChipRow}>
        {DEMO_SCENARIOS.map((scenario) => (
          <TouchableOpacity
            key={scenario.key}
            style={styles.bannerChip}
            onPress={() => onSelect(scenario)}
          >
            <Text style={styles.bannerChipText}>
              {scenario.icon} {scenario.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.bannerToggle} onPress={onToggleHub}>
        <Text style={styles.bannerToggleText}>
          {hubExpanded ? 'Hide full demo hub' : `Show all ${roomCount} demo rooms`}
        </Text>
      </TouchableOpacity>
    </View>
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
  card: {
    width: '100%',
    maxWidth: 460,
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
  title: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '900',
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  scenarioList: {
    marginTop: 16,
    gap: 10,
  },
  scenarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  scenarioIcon: {
    fontSize: 22,
  },
  scenarioCopy: {
    flex: 1,
    gap: 2,
  },
  scenarioTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  scenarioSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  scenarioCode: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  scenarioArrow: {
    fontSize: 18,
    fontWeight: '900',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.45)',
    backgroundColor: 'rgba(14,116,144,0.22)',
    padding: 14,
    gap: 8,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  bannerLink: {
    color: '#A5F3FC',
    fontSize: 12,
    fontWeight: '800',
  },
  bannerCopy: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 17,
  },
  bannerChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bannerChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(3,8,22,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bannerChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  bannerToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  bannerToggleText: {
    color: '#A5F3FC',
    fontSize: 12,
    fontWeight: '800',
  },
});
