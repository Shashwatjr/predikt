import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  DashboardState,
  fetchDashboardData,
  updateActivePredictionOrder as patchActivePredictionOrder,
} from '../services/dashboard';
import { getApiErrorMessage } from '../services/api';

export function useDashboardData() {
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);
  const [activePredictions, setActivePredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async (options?: { silent?: boolean }) => {
    // Silent refreshes (e.g. when the screen regains focus) skip the skeleton so the
    // hub doesn't flash on every return — the live section just updates in place.
    if (!options?.silent) setLoading(true);
    try {
      const { dashboard: nextDashboard, failedSections } = await fetchDashboardData();
      setDashboard(nextDashboard);
      setActivePredictions(nextDashboard.activePredictions ?? []);
      if (failedSections.length > 0 && __DEV__) {
        console.warn('[PREDIKT_DASHBOARD] sections failed to load', failedSections);
      }
    } catch (err) {
      Alert.alert('Dashboard unavailable', 'We could not load your dashboard right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const reorderActivePredictions = useCallback(
    (transform: (items: any[]) => any[]) => {
      const previous = activePredictions;
      const next = transform([...previous]).map((item, index) => ({ ...item, displayOrder: index }));

      setActivePredictions(next);

      void patchActivePredictionOrder(
        next.map((item, index) => ({
          roomId: item.roomId,
          displayOrder: index,
          pinned: !!item.pinned,
        })),
      ).catch((error: unknown) => {
        setActivePredictions(previous);
        Alert.alert('Order not saved', getApiErrorMessage(error, 'We kept your previous room order.'));
      });
    },
    [activePredictions],
  );

  return { dashboard, activePredictions, loading, loadDashboard, reorderActivePredictions };
}
