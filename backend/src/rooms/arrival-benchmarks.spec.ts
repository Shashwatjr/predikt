import { buildArrivalBenchmarks } from './rooms.service';

const anchor = new Date('2026-07-13T20:00:00.000Z'); // journey start anchor

function baseRoom(overrides: Record<string, unknown> = {}) {
  return {
    category: 'arrival_time',
    answerType: 'exact_time',
    roomCategory: 'journey',
    journeyScheduledStartAt: anchor,
    baselineValue: 1800, // 30 min duration
    ...overrides,
  };
}

describe('buildArrivalBenchmarks', () => {
  it('returns null for non-arrival rooms', () => {
    expect(buildArrivalBenchmarks({ category: 'weather_rain' })).toBeNull();
  });

  it('computes the Maps ETA arrival as anchor + eta and honors verified provenance', () => {
    const b = buildArrivalBenchmarks(
      baseRoom({ providerName: 'google', baselineLabel: 'Google Maps' }),
    );
    expect(b?.mapsEta?.verified).toBe(true);
    expect(b?.mapsEta?.label).toBe('Google Maps');
    expect(b?.mapsEta?.provider).toBe('google');
    // 20:00 + 30m = 20:30
    expect(new Date(b!.mapsEta!.arrivalTime).toISOString()).toBe('2026-07-13T20:30:00.000Z');
  });

  it('never attributes a provider label to an approximate estimate (trust rule)', () => {
    const b = buildArrivalBenchmarks(
      baseRoom({ providerName: 'approximate', baselineLabel: 'Google Maps', baselineSnapshot: { isApproximate: true } }),
    );
    expect(b?.mapsEta?.verified).toBe(false);
    expect(b?.mapsEta?.label).toBe('Route estimate');
    expect(b?.mapsEta?.provider).toBeNull();
  });

  it('exposes a distinct Oracle estimate when present', () => {
    const b = buildArrivalBenchmarks(
      baseRoom({
        providerName: 'google',
        oracleBotPrediction: { predictedDurationSeconds: 1980, label: 'Oracle Bot estimate' }, // 33 min
      }),
    );
    expect(new Date(b!.oracle!.arrivalTime).toISOString()).toBe('2026-07-13T20:33:00.000Z');
    // Oracle differs from Maps — two meaningful anchors, not a copy.
    expect(b!.oracle!.arrivalTime).not.toBe(b!.mapsEta!.arrivalTime);
  });

  it('only includes a host prediction when the host explicitly made one', () => {
    expect(buildArrivalBenchmarks(baseRoom({ providerName: 'google' }))?.hostPrediction).toBeNull();
    const withHost = buildArrivalBenchmarks(
      baseRoom({ providerName: 'google', hostPrediction: { arrivalTime: '2026-07-13T20:35:00.000Z' } }),
    );
    expect(withHost?.hostPrediction?.arrivalTime).toBe('2026-07-13T20:35:00.000Z');
    expect(withHost?.hasBenchmark).toBe(true);
  });
});
