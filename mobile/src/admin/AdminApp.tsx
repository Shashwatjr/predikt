import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemeProvider } from '../context/ThemeContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminLoginScreen from './screens/AdminLoginScreen';
import AdminNavigator from './AdminNavigator';
import { palette } from '../theme/designSystem';

function AdminShell() {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={palette.violet} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AdminLoginScreen />;
  }

  return <AdminNavigator />;
}

export default function AdminApp() {
  return (
    <ThemeProvider>
      <AdminAuthProvider>
        <AdminShell />
      </AdminAuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg,
  },
});
