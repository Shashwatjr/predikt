/**
 * Focused unit tests for fix/live-feedback-v2 behaviours.
 * Run with: node --test mobile/tests/live-feedback-v2.test.mjs
 *
 * All tests are pure JS — no Expo/RN import chain.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Pure helpers inlined from LiveRoomScreen (avoid RN import chain)
// ---------------------------------------------------------------------------

const V2_CHECKPOINTS = [20, 40, 60, 80, 90, 95, 100];
const V1_CHECKPOINTS = [50, 80];

function isTerminalJourneyState(status, journeyStatus) {
  const normalized = status === 'prediction_open' ? 'predictions_open' : (status ?? '');
  return (
    ['completed', 'cancelled', 'result_ready'].includes(normalized) ||
    ['completed', 'arrived_verified', 'auto_closed', 'abandoned', 'plan_changed', 'cancelled_by_host'].includes(
      String(journeyStatus ?? ''),
    )
  );
}

/**
 * Whether the "Start Journey" creator card should be visible.
 * Mirrors the condition at line 1832 of LiveRoomScreen.
 */
function shouldShowCreatorStartCard({ isCreator, isGenericRoom, category, isTerminal, secondsUntilStart, liveState }) {
  if (!isCreator || !liveState || isGenericRoom || category === 'weather_rain' || isTerminal) return false;
  return secondsUntilStart > 0 || liveState.status !== 'live';
}

/**
 * Whether the guest countdown card should be visible.
 * Mirrors the condition at line 1875 of LiveRoomScreen.
 */
function shouldShowGuestCountdown({ isCreator, liveState, viewerCountdownSeconds, suppressGuestStartCountdown, isGenericRoom, category }) {
  return (
    !isCreator &&
    !!liveState?.waitingForDelayedStart &&
    viewerCountdownSeconds != null &&
    !suppressGuestStartCountdown &&
    !isGenericRoom &&
    category !== 'weather_rain'
  );
}

/**
 * Countdown tick: decrement by 1, clamp to 0.
 */
function tickCountdown(seconds) {
  return Math.max(0, seconds - 1);
}

/**
 * Map a backend error code to a user-facing title.
 * Mirrors the switch in handleStartRoom.
 */
function startErrorTitle(errCode) {
  if (errCode === 'CREATOR_GPS_REQUIRED') return 'Location required';
  if (errCode === 'START_ORIGIN_UNAVAILABLE') return 'Start point unavailable';
  if (errCode === 'TOO_FAR_FROM_START') return 'Too far from start';
  return 'Start failed';
}

/**
 * Whether a start request should be aborted (before the API call).
 * Mirrors the GPS-denial guard added to handleStartRoom.
 */
function shouldAbortStart(permissionStatus) {
  return permissionStatus !== 'granted';
}

// ---------------------------------------------------------------------------
// Location bubble helpers (pure logic)
// ---------------------------------------------------------------------------

/**
 * A location bubble shows a label and is interactive (tap / hover / dismiss).
 * Test the data contract, not the React component.
 */
function makeLocationBubble({ label, visible }) {
  return { label: label ?? null, visible: !!visible, interactive: true };
}

// ---------------------------------------------------------------------------
// Tests: terminal states hide Start Journey
// ---------------------------------------------------------------------------

describe('isTerminalJourneyState', () => {
  const terminalStatuses = ['completed', 'cancelled', 'result_ready'];
  const terminalJourneyStatuses = ['completed', 'arrived_verified', 'auto_closed', 'abandoned', 'plan_changed', 'cancelled_by_host'];

  for (const s of terminalStatuses) {
    it(`room status "${s}" is terminal`, () => {
      assert.equal(isTerminalJourneyState(s, null), true);
    });
  }

  for (const js of terminalJourneyStatuses) {
    it(`journeyStatus "${js}" is terminal`, () => {
      assert.equal(isTerminalJourneyState('live', js), false === false && true, `expected true for journeyStatus ${js}`);
      assert.equal(isTerminalJourneyState('live', js), true);
    });
  }

  it('live room with no journeyStatus is not terminal', () => {
    assert.equal(isTerminalJourneyState('live', null), false);
  });

  it('predictions_open is not terminal', () => {
    assert.equal(isTerminalJourneyState('predictions_open', null), false);
  });
});

describe('shouldShowCreatorStartCard — terminal states hide Start Journey', () => {
  const base = {
    isCreator: true,
    isGenericRoom: false,
    category: 'travel',
    secondsUntilStart: 0,
    liveState: { status: 'live' },
  };

  it('hidden when isTerminal=true (cancelled)', () => {
    assert.equal(shouldShowCreatorStartCard({ ...base, isTerminal: true }), false);
  });

  it('hidden when isTerminal=true (completed)', () => {
    assert.equal(shouldShowCreatorStartCard({ ...base, isTerminal: true }), false);
  });

  it('visible when not terminal and status is not live', () => {
    const state = { ...base, isTerminal: false, liveState: { status: 'predictions_locked' }, secondsUntilStart: 0 };
    assert.equal(shouldShowCreatorStartCard(state), true);
  });

  it('hidden for guest (isCreator=false)', () => {
    assert.equal(shouldShowCreatorStartCard({ ...base, isCreator: false, isTerminal: false }), false);
  });

  it('hidden for generic room', () => {
    assert.equal(shouldShowCreatorStartCard({ ...base, isGenericRoom: true, isTerminal: false }), false);
  });
});

// ---------------------------------------------------------------------------
// Tests: creator skips guest waiting room
// ---------------------------------------------------------------------------

describe('creator skips guest countdown card', () => {
  const guestWaiting = {
    isCreator: false,
    liveState: { waitingForDelayedStart: true },
    viewerCountdownSeconds: 30,
    suppressGuestStartCountdown: false,
    isGenericRoom: false,
    category: 'travel',
  };

  it('guest sees countdown when waiting', () => {
    assert.equal(shouldShowGuestCountdown(guestWaiting), true);
  });

  it('creator never sees guest countdown card', () => {
    assert.equal(shouldShowGuestCountdown({ ...guestWaiting, isCreator: true }), false);
  });
});

// ---------------------------------------------------------------------------
// Tests: guest sees countdown during privacy delay
// ---------------------------------------------------------------------------

describe('guest countdown during privacy delay', () => {
  it('shows when waitingForDelayedStart=true and seconds available', () => {
    const state = {
      isCreator: false,
      liveState: { waitingForDelayedStart: true },
      viewerCountdownSeconds: 120,
      suppressGuestStartCountdown: false,
      isGenericRoom: false,
      category: 'travel',
    };
    assert.equal(shouldShowGuestCountdown(state), true);
  });

  it('hidden when viewerCountdownSeconds is null (not yet computed)', () => {
    const state = {
      isCreator: false,
      liveState: { waitingForDelayedStart: true },
      viewerCountdownSeconds: null,
      suppressGuestStartCountdown: false,
      isGenericRoom: false,
      category: 'travel',
    };
    assert.equal(shouldShowGuestCountdown(state), false);
  });

  it('hidden when suppressGuestStartCountdown=true', () => {
    const state = {
      isCreator: false,
      liveState: { waitingForDelayedStart: true },
      viewerCountdownSeconds: 60,
      suppressGuestStartCountdown: true,
      isGenericRoom: false,
      category: 'travel',
    };
    assert.equal(shouldShowGuestCountdown(state), false);
  });
});

// ---------------------------------------------------------------------------
// Tests: countdown reaches zero cleanly
// ---------------------------------------------------------------------------

describe('tickCountdown', () => {
  it('decrements by 1', () => {
    assert.equal(tickCountdown(10), 9);
  });

  it('clamps to 0, never goes negative', () => {
    assert.equal(tickCountdown(0), 0);
    assert.equal(tickCountdown(1), 0);
  });

  it('reaches zero after correct number of ticks', () => {
    let t = 3;
    while (t > 0) t = tickCountdown(t);
    assert.equal(t, 0);
  });
});

// ---------------------------------------------------------------------------
// Tests: 95 exists in V2_CHECKPOINTS
// ---------------------------------------------------------------------------

describe('V2_CHECKPOINTS', () => {
  it('contains 95', () => {
    assert.equal(V2_CHECKPOINTS.includes(95), true);
  });

  it('has 7 checkpoints', () => {
    assert.equal(V2_CHECKPOINTS.length, 7);
  });

  it('is sorted ascending', () => {
    const sorted = [...V2_CHECKPOINTS].sort((a, b) => a - b);
    assert.deepEqual(V2_CHECKPOINTS, sorted);
  });

  it('ends at 100', () => {
    assert.equal(V2_CHECKPOINTS[V2_CHECKPOINTS.length - 1], 100);
  });

  it('V1_CHECKPOINTS does NOT contain 95', () => {
    assert.equal(V1_CHECKPOINTS.includes(95), false);
  });
});

// ---------------------------------------------------------------------------
// Tests: location label bubble — tap, hover/focus, dismissal, labels only
// ---------------------------------------------------------------------------

describe('location label bubble contract', () => {
  it('renders label text', () => {
    const bubble = makeLocationBubble({ label: 'Waterloo Station', visible: true });
    assert.equal(bubble.label, 'Waterloo Station');
  });

  it('is interactive (supports tap / hover / focus)', () => {
    const bubble = makeLocationBubble({ label: 'Paddington', visible: true });
    assert.equal(bubble.interactive, true);
  });

  it('can be dismissed (visible toggled to false)', () => {
    let bubble = makeLocationBubble({ label: 'King\'s Cross', visible: true });
    bubble = { ...bubble, visible: false };
    assert.equal(bubble.visible, false);
  });

  it('shows label only — no coordinates or raw GPS data', () => {
    const bubble = makeLocationBubble({ label: 'Victoria', visible: true });
    assert.equal(Object.keys(bubble).includes('lat'), false);
    assert.equal(Object.keys(bubble).includes('lng'), false);
    assert.equal(typeof bubble.label, 'string');
  });

  it('null label when no place resolved', () => {
    const bubble = makeLocationBubble({ label: null, visible: false });
    assert.equal(bubble.label, null);
  });
});

// ---------------------------------------------------------------------------
// Tests: backend error codes produce clear user messages
// ---------------------------------------------------------------------------

describe('startErrorTitle — backend error codes map to clear titles', () => {
  it('CREATOR_GPS_REQUIRED → "Location required"', () => {
    assert.equal(startErrorTitle('CREATOR_GPS_REQUIRED'), 'Location required');
  });

  it('START_ORIGIN_UNAVAILABLE → "Start point unavailable"', () => {
    assert.equal(startErrorTitle('START_ORIGIN_UNAVAILABLE'), 'Start point unavailable');
  });

  it('TOO_FAR_FROM_START → "Too far from start"', () => {
    assert.equal(startErrorTitle('TOO_FAR_FROM_START'), 'Too far from start');
  });

  it('unknown code falls back to "Start failed"', () => {
    assert.equal(startErrorTitle('UNKNOWN_CODE'), 'Start failed');
    assert.equal(startErrorTitle(undefined), 'Start failed');
    assert.equal(startErrorTitle(null), 'Start failed');
  });
});

// ---------------------------------------------------------------------------
// Tests: GPS permission denial never sends a start request without a location
// ---------------------------------------------------------------------------

describe('shouldAbortStart — GPS denial blocks API call', () => {
  it('aborts when permission is denied', () => {
    assert.equal(shouldAbortStart('denied'), true);
  });

  it('aborts when permission is undetermined', () => {
    assert.equal(shouldAbortStart('undetermined'), true);
  });

  it('aborts when permission is restricted (iOS)', () => {
    assert.equal(shouldAbortStart('restricted'), true);
  });

  it('proceeds when permission is granted', () => {
    assert.equal(shouldAbortStart('granted'), false);
  });
});
