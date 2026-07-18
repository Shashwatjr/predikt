import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { useTheme } from './src/context/ThemeContext';
import { useAuth } from './src/context/AuthContext';
import StartupSpark from './src/components/StartupSpark';
import { getStartupSparkPayload } from './src/services/startupSpark';
import { featureFlags } from './src/config/featureFlags';

const AdminApp = lazy(() => import('./src/admin/AdminApp'));

function isAdminWebRoute() {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/admin')
  );
}

function AppShell() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { isLoading } = useAuth();
  const [sparkPayload, setSparkPayload] = useState<Awaited<ReturnType<typeof getStartupSparkPayload>> | null>(null);
  const [sparkDone, setSparkDone] = useState(false);

  useEffect(() => {
    let active = true;

    void getStartupSparkPayload().then((payload) => {
      if (active) {
        setSparkPayload(payload);
        if (!payload) {
          setSparkDone(true);
        }
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1 }}>
        <AppNavigator />
        {!sparkDone ? <StartupSpark payload={sparkPayload} appReady={!isLoading} onDone={() => setSparkDone(true)} /> : null}
      </View>
    );
  }

  const isLargeScreen = width >= 1024;
  const webFrameWidth = isLargeScreen ? Math.min(width, 1360) : '100%';

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
        {!sparkDone ? <StartupSpark payload={sparkPayload} appReady={!isLoading} onDone={() => setSparkDone(true)} /> : null}
      </View>
    </View>
  );
}

export default function App() {
  if (featureFlags.adminPortalEnabled && isAdminWebRoute()) {
    return (
      <Suspense fallback={<View style={styles.adminLoading} />}>
        <AdminApp />
      </Suspense>
    );
  }

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
  adminLoading: {
    flex: 1,
    backgroundColor: '#060816',
  },
});
