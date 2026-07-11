import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import PrimaryButton from '../components/PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import WebSideWingLayout from '../components/WebSideWingLayout';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Help'>;
  route: RouteProp<RootStackParamList, 'Help'>;
};

const howToPlay = [
  'Create or join a Prediction Room.',
  'Submit your guess before the room locks.',
  'Wait for the result.',
  'See who was closest.',
  'Earn Aura, build Clout, unlock Credits, and start a Rematch.',
];

const roomTypes = [
  'Arrival and journey rooms for trips and ETA challenges.',
  'Food delivery rooms for quick yes, no, or exact-time guesses.',
  'Gym and habit challenges for streaks and consistency.',
  'Friend challenges for playful daily moments.',
  'Custom rooms when you want to define your own challenge.',
];

const resultReveal = [
  'Actual result and the Closest Guess',
  'Difference in seconds or minutes',
  'Aura earned and Dot Bonus',
  'Leaderboard movement',
  'Comeback and Rematch options',
  'Friendly reactions and Moment Card energy',
];

const safetyItems = [
  'Report harmful behavior or suspicious rooms.',
  'Block users you do not want to interact with.',
  'Dispute a result if the outcome looks wrong.',
  'Friendly banter is welcome, but harassment is not.',
  'PREDIKT keeps predictions social, privacy-safe, and friendly.',
];

const predictionOptions = [
  'Arrival Time: guess the exact time someone reaches the destination.',
  'Journey Duration: guess how many minutes the trip takes from Start to Destination.',
  'Yes/No: answer a simple Challenge, like whether the trip beats the ETA.',
];

const faq = [
  ['Do I need to pay to play?', 'No. You can join and play without paying to make a prediction.'],
  ['What are Credits?', 'Credits are in-app unlocks only.'],
  ['Can people see my exact location?', 'No. Route rooms show delayed or approximate progress, not exact live GPS.'],
  ['Can I change my prediction?', 'Yes. You can edit or revoke for 2 minutes, as long as the room has not locked.'],
  ['What happens after the room locks?', 'Predictions stay frozen, hidden guesses are revealed later, and the result decides who was closest.'],
  ['What is Dot Bonus?', 'Dot Bonus rewards predictions that land especially close to the actual result.'],
  ['What is a Rematch?', 'A Rematch starts a new round with the same group after results are revealed.'],
  ['Why do I need a PREDIKT handle?', 'Your handle makes leaderboards, follows, and social identity easier to recognize.'],
];

function HelpCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function HelpScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();

  return (
    <WebSideWingLayout rightPlacement="help_right">
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}>
      <LinearGradient colors={colors.gradPrimary} style={styles.hero}>
        <Text style={styles.heroEyebrow}>Help</Text>
        <Text style={styles.heroTitle}>How PREDIKT Works</Text>
        <Text style={styles.heroBody}>
          Beginner-friendly help for Prediction Rooms, Aura, Clout, Credits, fair locks, and privacy-safe route play.
        </Text>
      </LinearGradient>

      <HelpCard title="What is PREDIKT?">
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          PREDIKT lets you create Prediction Rooms with friends and see who gets closest.
        </Text>
      </HelpCard>

      <HelpCard title="How to play">
        {howToPlay.map((item, index) => (
          <Text key={item} style={[styles.listRow, { color: colors.textSecondary }]}>
            {index + 1}. {item}
          </Text>
        ))}
        <Text style={[styles.bulletRow, { color: colors.textSecondary }]}>
          • Choose what people should predict. For journey rooms, select Start and Destination, then choose Arrival Time, Journey Duration, or Beat ETA.
        </Text>
        <Text style={[styles.bulletRow, { color: colors.textSecondary }]}>
          • PREDIKT suggests options so you do not have to build the room manually.
        </Text>
      </HelpCard>

      <HelpCard title="Prediction Room types">
        {roomTypes.map((item) => (
          <Text key={item} style={[styles.bulletRow, { color: colors.textSecondary }]}>
            • {item}
          </Text>
        ))}
      </HelpCard>

      <HelpCard title="Prediction options">
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          When creating a journey room, first choose Start and Destination, then choose what people predict.
        </Text>
        {predictionOptions.map((item) => (
          <Text key={item} style={[styles.bulletRow, { color: colors.textSecondary }]}>
            • {item}
          </Text>
        ))}
      </HelpCard>

      <HelpCard title="Aura, Clout, and Credits">
        <Text style={[styles.bulletRow, { color: colors.textSecondary }]}>
          • Aura = your accuracy and reputation. It is earned by close predictions and cannot be bought or spent.
        </Text>
        <Text style={[styles.bulletRow, { color: colors.textSecondary }]}>
          • Clout = your social and hosting influence. It grows when you create good rooms and bring real participation.
        </Text>
        <Text style={[styles.bulletRow, { color: colors.textSecondary }]}>
          • Credits = in-app feature unlocks.
        </Text>
      </HelpCard>

      <HelpCard title="Hidden predictions until lock">
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          To keep every guess fair, predictions stay hidden until the room locks. Before lock, you will only see who has submitted.
        </Text>
      </HelpCard>

      <HelpCard title="Edit and revoke rule">
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          You can edit or revoke your prediction for 2 minutes after submitting, as long as the room has not locked.
        </Text>
      </HelpCard>

      <HelpCard title="Result reveal">
        {resultReveal.map((item) => (
          <Text key={item} style={[styles.bulletRow, { color: colors.textSecondary }]}>
            • {item}
          </Text>
        ))}
      </HelpCard>

      <HelpCard title="Route and location privacy">
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          Route rooms use location to verify outcomes, not to broadcast your movement. Participants see privacy-safe, delayed or approximate progress, not exact live GPS.
        </Text>
        <Text style={[styles.bulletRow, { color: colors.textSecondary }]}>
          • The map preview is a guide for Start → Destination, distance, ETA, and privacy delay. It is not an exact live map.
        </Text>
        <Text style={[styles.bulletRow, { color: colors.textSecondary }]}>• Ghost Mode keeps the experience privacy-safe.</Text>
        <Text style={[styles.bulletRow, { color: colors.textSecondary }]}>• Progress is delayed before viewers see updates.</Text>
        <Text style={[styles.bulletRow, { color: colors.textSecondary }]}>• Route status is approximate in participant and public views.</Text>
        <Text style={[styles.bulletRow, { color: colors.textSecondary }]}>• Exact GPS is not shown in public or participant view.</Text>
      </HelpCard>

      <HelpCard title="Safety and community">
        {safetyItems.map((item) => (
          <Text key={item} style={[styles.bulletRow, { color: colors.textSecondary }]}>
            • {item}
          </Text>
        ))}
      </HelpCard>

      <HelpCard title="FAQ">
        {faq.map(([question, answer]) => (
          <View key={question} style={styles.faqItem}>
            <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>{question}</Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>{answer}</Text>
          </View>
        ))}
      </HelpCard>

      {route.params?.allowReplayTour ? (
        <PrimaryButton
          label="Replay guided tour"
          onPress={() => navigation.navigate('Home', { replayOnboarding: true })}
        />
      ) : isAuthenticated ? (
        <PrimaryButton
          label="Replay guided tour"
          onPress={() => navigation.navigate('Home', { replayOnboarding: true })}
        />
      ) : (
        <PrimaryButton label="Login to replay guided tour" onPress={() => navigation.navigate('Login')} variant="secondary" />
      )}
    </ScrollView>
    </WebSideWingLayout>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%', maxWidth: 920, alignSelf: 'center', padding: 18, gap: 14 },
  hero: { borderRadius: 24, padding: 22, marginTop: 20 },
  heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 8 },
  heroBody: { color: 'rgba(255,255,255,0.84)', marginTop: 8, fontSize: 14, lineHeight: 20 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: '900', marginBottom: 10 },
  copy: { fontSize: 14, lineHeight: 21 },
  listRow: { fontSize: 14, lineHeight: 22, marginBottom: 4 },
  bulletRow: { fontSize: 14, lineHeight: 21, marginBottom: 4 },
  faqItem: { marginBottom: 12 },
  faqQuestion: { fontSize: 14, fontWeight: '800' },
  faqAnswer: { fontSize: 13, lineHeight: 19, marginTop: 4 },
});
