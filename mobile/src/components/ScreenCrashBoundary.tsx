import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PrimaryButton from './PrimaryButton';
import { dark } from '../theme/tokens';

type Props = {
  screenName: string;
  onHome?: () => void;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

function CrashFallback({
  screenName,
  onRetry,
  onHome,
}: {
  screenName: string;
  onRetry: () => void;
  onHome?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Something went wrong</Text>
        <Text style={styles.title}>We could not open this {screenName.toLowerCase()} right now.</Text>
        <Text style={styles.copy}>
          The screen hit an unexpected error. Retry once, or go back home and open it again.
        </Text>
        <PrimaryButton label="Try again" onPress={onRetry} gradientColors={dark.gradPrimary} />
        {onHome ? <PrimaryButton label="Back to Home" onPress={onHome} variant="secondary" /> : null}
      </View>
    </View>
  );
}

export default class ScreenCrashBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(`[PREDIKT_SCREEN_CRASH] ${this.props.screenName}`, error);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <CrashFallback
          screenName={this.props.screenName}
          onRetry={this.handleRetry}
          onHome={this.props.onHome}
        />
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: dark.bg,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    padding: 20,
    gap: 12,
  },
  kicker: {
    color: dark.purpleLight,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    color: dark.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  copy: {
    color: dark.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
});
