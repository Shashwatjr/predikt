import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { featureFlags } from '../config/featureFlags';
import AdminSidebar from './components/AdminSidebar';
import AdminAuditScreen from './screens/AdminAuditScreen';
import AdminDashboardScreen from './screens/AdminDashboardScreen';
import AdminFeatureFlagsScreen from './screens/AdminFeatureFlagsScreen';
import AdminFeedbackScreen from './screens/AdminFeedbackScreen';
import AdminModerationScreen from './screens/AdminModerationScreen';
import AdminRoomsScreen from './screens/AdminRoomsScreen';
import AdminSystemHealthScreen from './screens/AdminSystemHealthScreen';
import AdminUsersScreen from './screens/AdminUsersScreen';
import { useAdminAuth } from './context/AdminAuthContext';
import type { AdminNavItem } from './types/admin';
import { palette } from '../theme/designSystem';

export default function AdminNavigator() {
  const { admin, logout } = useAdminAuth();
  const [active, setActive] = useState<AdminNavItem>('overview');

  if (!featureFlags.adminPortalEnabled) {
    return null;
  }

  const renderScreen = () => {
    switch (active) {
      case 'overview':
        return <AdminDashboardScreen />;
      case 'rooms':
        return <AdminRoomsScreen />;
      case 'users':
        return <AdminUsersScreen />;
      case 'feedback':
        return featureFlags.adminFeedbackQueueEnabled ? <AdminFeedbackScreen /> : <AdminDashboardScreen />;
      case 'moderation':
        return featureFlags.adminModerationEnabled ? <AdminModerationScreen /> : <AdminDashboardScreen />;
      case 'audit':
        return <AdminAuditScreen />;
      case 'health':
        return featureFlags.adminSystemHealthEnabled ? <AdminSystemHealthScreen /> : <AdminDashboardScreen />;
      case 'flags':
        return <AdminFeatureFlagsScreen />;
      default:
        return <AdminDashboardScreen />;
    }
  };

  return (
    <View style={styles.shell}>
      <AdminSidebar
        active={active}
        onNavigate={setActive}
        adminName={admin?.name ?? 'Admin'}
        onLogout={() => void logout()}
      />
      <View style={styles.content}>{renderScreen()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: palette.bg,
    minHeight: '100%',
  },
  content: {
    flex: 1,
    backgroundColor: palette.bg,
  },
});
