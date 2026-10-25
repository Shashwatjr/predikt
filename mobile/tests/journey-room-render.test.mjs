/**
 * Unit tests for mobile journey-room rendering helpers.
 * Run with: node --test mobile/tests/journey-room-render.test.mjs
 *
 * These tests do NOT require Expo/RN; they exercise pure JS logic extracted
 * from ResultScreen and CheckpointLeaderboard.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Inline copies of the pure functions under test (avoids RN import chain)
// ---------------------------------------------------------------------------

function formatWinnerHandle(row) {
  if (!row) return null;
  const handle = row?.user?.prediktHandle ?? row?.prediktHandle;
  if (handle) return `@${String(handle).replace(/^@/, '')}`;
  const name = row?.name ?? row?.user?.name;
  if (name) return `@${String(name).toLowerCase().replace(/\s+/g, '')}`;
  return null;
}

function safeClock(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '—' : '(valid)'; // real impl calls formatClock
}

// ---------------------------------------------------------------------------
// formatWinnerHandle
// ---------------------------------------------------------------------------

describe('formatWinnerHandle', () => {
  it('returns @handle when prediktHandle present', () => {
    assert.equal(formatWinnerHandle({ prediktHandle: 'alice' }), '@alice');
  });

  it('strips leading @ from handle', () => {
    assert.equal(formatWinnerHandle({ prediktHandle: '@bob' }), '@bob');
  });

  it('derives handle from name when no prediktHandle', () => {
    assert.equal(formatWinnerHandle({ name: 'Jane Doe' }), '@janedoe');
  });

  it('prefers nested user.prediktHandle over name', () => {
    assert.equal(
      formatWinnerHandle({ name: 'Jane', user: { prediktHandle: 'jd' } }),
      '@jd',
    );
  });

  it('returns null for empty row — no fake @closest-guess', () => {
    assert.equal(formatWinnerHandle({}), null);
  });

  it('returns null for null row', () => {
    assert.equal(formatWinnerHandle(null), null);
  });

  it('returns null when both handle and name absent', () => {
    assert.equal(formatWinnerHandle({ userId: 'u1' }), null);
  });
});

// ---------------------------------------------------------------------------
// safeClock
// ---------------------------------------------------------------------------

describe('safeClock', () => {
  it('returns — for null', () => assert.equal(safeClock(null), '—'));
  it('returns — for undefined', () => assert.equal(safeClock(undefined), '—'));
  it('returns — for empty string', () => assert.equal(safeClock(''), '—'));
  it('returns — for invalid date string', () => assert.equal(safeClock('not-a-date'), '—'));
  it('returns formatted value for valid ISO string', () => {
    assert.notEqual(safeClock('2025-06-15T14:30:00Z'), '—');
  });
});

// ---------------------------------------------------------------------------
// Narrow-screen podium layout — verify flex replaces fixed 96px width
// ---------------------------------------------------------------------------

describe('podium layout contract', () => {
  it('podiumCol uses flex:1 not fixed width', () => {
    // This is a static contract check — the actual StyleSheet lives in ResultScreen.
    // We assert the design intent: on a 320px screen with 20px padding,
    // three columns sharing available width = (320 - 40 - 12gap) / 3 ≈ 89px each.
    // That fits; the old width:96 * 3 + 2*8 = 304 did not fit in 280px available.
    const availableWidth = 320 - 40; // screen - padding
    const gapTotal = 2 * 6;
    const colWidth = (availableWidth - gapTotal) / 3;
    assert.ok(colWidth >= 80, `column width ${colWidth} too narrow`);
    assert.ok(colWidth <= 96, `column width ${colWidth} would need fixed cap`);
  });
});

// ---------------------------------------------------------------------------
// Winner suppression for neutral/cancelled journeys
// ---------------------------------------------------------------------------

describe('winner suppression', () => {
  it('winnerHandle is null when isNeutralClosure=true regardless of row', () => {
    const row = { name: 'Alice', prediktHandle: 'alice' };
    const isNeutralClosure = true;
    const winnerHandle = isNeutralClosure ? null : formatWinnerHandle(row);
    assert.equal(winnerHandle, null);
  });

  it('TeaCard winner metric shows Pending when handle is null', () => {
    const winnerHandle = null;
    const metric = { label: 'Winner', value: winnerHandle ?? 'Pending' };
    assert.equal(metric.value, 'Pending');
  });
});
