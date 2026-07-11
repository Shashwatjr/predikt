import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { useTheme } from './src/context/ThemeContext';

function AppShell() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <AppNavigator />;
  }

  const isLargeScreen = width >= 1024;
  const webFrameWidth = isLargeScreen ? Math.min(width, 1200) : '100%';

  return (
    <View style={[styles.webRoot, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.webFrame,
          {
            width: webFrameWidth,
            backgroundColor: colors.bg,
            borderColor: colors.border,
          },
        ]}
      >
        <AppNavigator />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  webRoot: {
    flex: 1,
    alignItems: 'center',
    minHeight: '100%',
  },
  webFrame: {
    flex: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
});
