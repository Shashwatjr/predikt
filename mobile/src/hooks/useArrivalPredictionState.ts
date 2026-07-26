import { useEffect, useMemo, useRef, useState } from 'react';
import { deriveArrivalBenchmarks } from '../utils/benchmarks';

/**
 * Shared arrival-prediction state for the two screens that let a user make an
 * arrival call: PredictionScreen and the merged "Predict now" path in
 * JoinRoomScreen. Owns the picked time (seeded once from the primary benchmark)
 * and the optional hot take, so neither screen duplicates the seeding logic.
 */
export function useArrivalPredictionState(room: any) {
  const benchmarks = useMemo(() => deriveArrivalBenchmarks(room), [room]);

  const [predicted, setPredicted] = useState<Date>(
    () => benchmarks?.primary.date ?? new Date(Date.now() + 30 * 60 * 1000),
  );

  // Seed the picker from the primary benchmark exactly once, when it first
  // becomes available (the room is often fetched after mount).
  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current && benchmarks?.primary) {
      setPredicted(new Date(benchmarks.primary.date));
      seededRef.current = true;
    }
  }, [benchmarks]);

  const [hotTake, setHotTake] = useState('');

  return { benchmarks, predicted, setPredicted, hotTake, setHotTake };
}
