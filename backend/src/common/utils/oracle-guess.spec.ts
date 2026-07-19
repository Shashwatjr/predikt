import { computeOracleGuess } from './oracle-guess';

const T0 = new Date('2026-07-19T10:00:00.000Z');
const at = (mins: number) => new Date(T0.getTime() + mins * 60_000);

describe('computeOracleGuess (frozen read only)', () => {
  const room = { startTime: T0, expectedDurationSeconds: 3600 }; // start ETA -> 11:00

  it('uses the highest reached checkpoint <= 80 (80 over 60/40/20)', () => {
    const checkpoints = [
      { checkpoint: 20, capturedAt: at(12), etaSeconds: 40 * 60 },
      { checkpoint: 40, capturedAt: at(24), etaSeconds: 35 * 60 },
      { checkpoint: 60, capturedAt: at(36), etaSeconds: 24 * 60 },
      { checkpoint: 80, capturedAt: at(48), etaSeconds: 15 * 60 }, // 10:48 + 15m = 11:03
    ];
    const g = computeOracleGuess(room, checkpoints)!;
    expect(g.frozenAtCheckpoint).toBe(80);
    expect(g.arrivalTime.toISOString()).toBe(at(63).toISOString());
  });

  it('falls back to the next-highest <= 80 when 80 has no eta', () => {
    const checkpoints = [
      { checkpoint: 20, capturedAt: at(12), etaSeconds: 40 * 60 },
      { checkpoint: 60, capturedAt: at(36), etaSeconds: 24 * 60 }, // 10:36 + 24m = 11:00
    ];
    const g = computeOracleGuess(room, checkpoints)!;
    expect(g.frozenAtCheckpoint).toBe(60);
    expect(g.arrivalTime.toISOString()).toBe(at(60).toISOString());
  });

  it('ignores 90/100 checkpoints (Oracle is locked out after 80)', () => {
    const checkpoints = [
      { checkpoint: 90, capturedAt: at(54), etaSeconds: 5 * 60 },
      { checkpoint: 100, capturedAt: at(60), etaSeconds: 0 },
    ];
    // No <=80 eta => start-round fallback, NOT the near-perfect 90/100 value.
    const g = computeOracleGuess(room, checkpoints)!;
    expect(g.frozenAtCheckpoint).toBe(0);
    expect(g.arrivalTime.toISOString()).toBe(at(60).toISOString());
  });

  it('falls back to the start-time ETA when no checkpoint has an eta', () => {
    const g = computeOracleGuess(room, [])!;
    expect(g.frozenAtCheckpoint).toBe(0);
    expect(g.arrivalTime.toISOString()).toBe(at(60).toISOString());
  });

  it('returns null when there is no start ETA to fall back to', () => {
    expect(computeOracleGuess({ startTime: null, expectedDurationSeconds: null }, [])).toBeNull();
  });
});
