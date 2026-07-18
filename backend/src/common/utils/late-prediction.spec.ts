import {
  buildPredictionWindow,
  isLatePredictionWindowOpen,
  projectLiveArrival,
} from './late-prediction';

const MIN = 60 * 1000;

describe('late-prediction util', () => {
  it('projects arrival from real progress (pace), not the plan', () => {
    const now = Date.now();
    const startedAt = new Date(now - 20 * MIN);
    // 40% done after 20 min => full trip ~50 min => arrival ~30 min from now.
    const room = {
      status: 'live',
      journeyStartedAt: startedAt,
      expectedDurationSeconds: 30 * 60, // plan says 30 min total (would be ~10 min out)
      locationEvents: [{ progressPercentage: 40, createdAt: new Date(now) }],
    };
    const arrival = projectLiveArrival(room)!;
    expect(Math.round((arrival.getTime() - now) / MIN)).toBe(30);
  });

  it('falls back to the planned duration without a progress signal', () => {
    const now = Date.now();
    const startedAt = new Date(now - 10 * MIN);
    const room = { status: 'live', journeyStartedAt: startedAt, expectedDurationSeconds: 30 * 60 };
    const arrival = projectLiveArrival(room)!;
    expect(Math.round((arrival.getTime() - now) / MIN)).toBe(20);
  });

  it('stays open long after start when arrival is far off (no 10-min gate)', () => {
    const startedAt = new Date(Date.now() - 45 * MIN);
    const room = { status: 'live', journeyStartedAt: startedAt, expectedDurationSeconds: 60 * 60 };
    expect(isLatePredictionWindowOpen(room)).toBe(true);
  });

  it('closes within 3 minutes of the projected arrival', () => {
    const startedAt = new Date(Date.now() - 28 * MIN);
    const room = { status: 'live', journeyStartedAt: startedAt, expectedDurationSeconds: 30 * 60 };
    const window = buildPredictionWindow(room);
    expect(window.open).toBe(false); // arrival ~2 min out, inside the 3-min buffer
    expect(window.projectedArrivalAt).not.toBeNull();
    expect(window.deadlineAt).not.toBeNull();
  });

  it('is closed before the journey is live', () => {
    const room = { status: 'predictions_open', plannedStartTime: new Date(), expectedDurationSeconds: 1800 };
    expect(isLatePredictionWindowOpen(room)).toBe(false);
  });

  it('stays open during the start-delay when startTime is still in the future', () => {
    // Room just went live with a 3-min start delay: startTime is 3 min from now,
    // traveller has not moved. A joining participant must still be able to predict.
    const startedAt = new Date(Date.now() + 3 * MIN);
    const room = {
      status: 'live',
      journeyStartedAt: startedAt,
      startTime: startedAt,
      expectedDurationSeconds: 30 * 60,
    };
    expect(isLatePredictionWindowOpen(room)).toBe(true);
    expect(projectLiveArrival(room)).not.toBeNull();
  });
});
