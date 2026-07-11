import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { getActiveSponsoredPlacement, SponsoredPlacement } from '../config/sponsoredPlacements';
import SponsoredPlacementCard from './SponsoredPlacementCard';

type Props = {
  children: React.ReactNode;
  leftPlacement?: SponsoredPlacement['placement'];
  rightPlacement?: SponsoredPlacement['placement'];
};

const WIDE_WEB_BREAKPOINT = 1280;

export default function WebSideWingLayout({ children, leftPlacement, rightPlacement }: Props) {
  const { width } = useWindowDimensions();
  const showWings = Platform.OS === 'web' && width >= WIDE_WEB_BREAKPOINT;
  const left = leftPlacement ? getActiveSponsoredPlacement(leftPlacement) : undefined;
  const right = rightPlacement ? getActiveSponsoredPlacement(rightPlacement) : undefined;

  if (!showWings || (!left && !right)) {
    return <>{children}</>;
  }

  return (
    <View style={styles.shell}>
      <View style={styles.side}>{left ? <SponsoredPlacementCard placement={left} /> : null}</View>
      <View style={styles.main}>{children}</View>
      <View style={styles.side}>{right ? <SponsoredPlacementCard placement={right} /> : null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 12,
    width: '100%',
  },
  main: {
    flex: 5,
    minWidth: 390,
  },
  side: {
    flex: 1,
    minWidth: 160,
    paddingTop: 42,
    paddingHorizontal: 0,
  },
});
