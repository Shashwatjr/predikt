import React from 'react';
import { StyleSheet, View } from 'react-native';
import { screenStyles } from '../theme/designSystem';

type Props = {
  children: React.ReactNode;
  withBottomNav?: boolean;
  narrow?: boolean;
};

export default function ScreenShell({ children, withBottomNav = false, narrow = false }: Props) {
  return (
    <View style={screenStyles.shell}>
      <View style={screenStyles.glowTop} />
      <View style={screenStyles.glowBottom} />
      <View style={[narrow ? screenStyles.narrowContent : screenStyles.content, withBottomNav && { paddingBottom: 112 }]}>
        {children}
      </View>
    </View>
  );
}
