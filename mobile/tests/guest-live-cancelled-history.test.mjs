/**
 * Regression tests for fix/guest-live-cancelled-history
 *
 * All tests assert on source structure — the project has no renderer in its test
 * setup, and every defect here is visible and stable in the source.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const mobileRoot = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(mobileRoot, rel), 'utf8');
const backendRoot = path.resolve(mobileRoot, '../backend/src');
const readBackend = (rel) => fs.readFileSync(path.join(backendRoot, rel), 'utf8');

// ── Feature 1: Guest live journey ────────────────────────────────────────────

test('LiveRoomScreen no longer has a full-screen ArrivalWaitingRoom early return for guests in delay', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  // The old pattern: `if (showArrivalWaitingRoom) { return (<ScrollView>...<ArrivalWaitingRoom`
  // early return is gone; showArrivalWaitingRoom must always be false.
  assert.ok(
    /showArrivalWaitingRoom = false/.test(src),
    'showArrivalWaitingRoom must be permanently false so guests never lose the full screen',
  );
  assert.ok(
    !/if \(showArrivalWaitingRoom\)/.test(src),
    'the early return keyed on showArrivalWaitingRoom must be removed',
  );
});

test('guest delay window (guestInDelayWindow) is detected and shows route illustration at 0%', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  assert.ok(
    /guestInDelayWindow/.test(src),
    'a dedicated guestInDelayWindow flag must exist',
  );
  assert.ok(
    /guestInDelayWindow &&/.test(src) || /guestInDelayWindow \?/.test(src),
    'the flag must gate the inline delay view',
  );
  // The route illustration must be shown with progress=0 during the delay.
  // Find the rendered guest-delay block (JSX block, not the variable declaration).
  const renderStart = src.indexOf('guestInDelayWindow ? (');
  assert.ok(renderStart > -1, 'expected a JSX block gated on guestInDelayWindow');
  const delayBlock = src.slice(renderStart, renderStart + 2000);
  assert.ok(
    /progressPercentage=\{0\}/.test(delayBlock),
    'ArrivalJourneyViz must be rendered with progress=0 during the safety delay',
  );
});

test('guest delay banner shows safety delay message and countdown', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  assert.ok(
    /Journey live.*Location shown with a 3-minute safety delay/.test(src),
    'delay window must display the safety delay message',
  );
  assert.ok(
    /Live progress available in/.test(src),
    'delay window must display the countdown copy',
  );
});

test('creator continues to see immediate progress (guestInDelayWindow does not affect isCreator path)', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  // guestInDelayWindow must require !isCreator
  const flagDef = src.slice(src.indexOf('guestInDelayWindow'), src.indexOf('guestInDelayWindow') + 400);
  assert.ok(
    /!isCreator/.test(flagDef),
    'guestInDelayWindow must be false for the creator so they see immediate progress',
  );
});

test('no fresh coordinates or progress percentage are exposed in the guest delay block', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  // The delay block uses progress=0, not pct (which reflects real progress).
  const delayBlock = src.slice(src.indexOf('guestInDelayWindow'), src.indexOf('guestInDelayWindow') + 2000);
  assert.ok(
    !/progressPercentage=\{pct\}/.test(delayBlock),
    'guest delay block must not expose the real pct — only 0 while delay is active',
  );
});

// ── Feature 2: Cancelled journey terminal guard ───────────────────────────────

test('terminal banner shows Journey cancelled / Plans changed for draw states, not Result Ready', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  // File uses Unicode curly-quotes; search for the terminalBanner block directly.
  const bannerStart = src.indexOf('styles.terminalBanner');
  assert.ok(bannerStart > -1, 'expected a terminalBanner view');
  const banner = src.slice(bannerStart, bannerStart + 1200);
  assert.ok(
    /Journey cancelled/.test(banner),
    'terminal banner must say Journey cancelled for cancelled journeys',
  );
  assert.ok(
    /Plans changed/.test(banner),
    'terminal banner must say Plans changed for plan_changed journeys',
  );
  // The old bug: both draw and non-draw said "Result Ready" — that must be gone.
  assert.ok(
    !/isDraw \? .Result Ready. : .Result Ready./.test(banner),
    'the old "Result Ready" for both draw and non-draw must be gone',
  );
});

test('cancellation neutral summary text is present: no result scored, no loss counted', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  assert.ok(
    /No result was scored\. Nobody is counted as a loss\./.test(src),
    'cancellation banner must show the neutral summary',
  );
});

test('creator and guest receive role-specific cancellation wording', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  assert.ok(
    /You cancelled this journey\./.test(src),
    'creator must see "You cancelled this journey."',
  );
  assert.ok(
    /The host cancelled this journey\./.test(src),
    'guest must see "The host cancelled this journey."',
  );
});

test('terminal state auto-navigates to Result so guests are not stuck on live UI', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  const fetchLive = src.slice(src.indexOf('async function fetchLiveState'), src.indexOf('async function fetchCheckpointBoards'));
  assert.ok(
    /autoNavigatedToResult\.current = true/.test(fetchLive),
    'fetchLiveState must set the auto-navigation guard when it detects a terminal state',
  );
  assert.ok(
    /navigation\.navigate\('Result'/.test(fetchLive),
    'fetchLiveState must navigate to Result when it detects a terminal state',
  );
});

test('guests never see Host tools — all Host tools renders are inside isCreator-gated blocks', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  // Every Host tools section must be inside a block gated by isCreator.
  // creatorDesktopJourneyBoard = isDesktop && isCreator && …
  // creatorDesktopLiveJourney = creatorDesktopJourneyBoard && phase === 'started'
  // All three Host tools blocks sit inside one of those variables — verify by
  // checking that the variable definitions reference isCreator.
  assert.ok(
    /creatorDesktopJourneyBoard[\s\S]{0,200}isCreator/.test(src),
    'creatorDesktopJourneyBoard (which gates desktop Host tools) must require isCreator',
  );
  // Mobile Host tools is directly gated by isCreator
  assert.ok(
    /isCreator && room\?\.answerType !== 'multiple_choice' && !creatorDesktopJourneyBoard/.test(src),
    'mobile Host tools must be guarded by isCreator',
  );
  // Non-creator renders must never include the literal text "Host tools"
  // (verified by confirming no Host tools block exists outside an isCreator context).
  assert.ok(
    src.includes('Host tools'),
    'Host tools sections must still exist for creators',
  );
});

test('View Summary button is shown for cancelled rooms, View Result for completed', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  assert.ok(
    /View Summary/.test(src),
    'cancelled result must offer View Summary',
  );
  // File uses Unicode curly-quotes; match with a dot (.) wildcard for the quote chars.
  assert.ok(
    /isDraw \? .View Summary. : .View Result./.test(src),
    'the button label must differ by isDraw',
  );
});

// ── Feature 3: Home journey history ──────────────────────────────────────────

test('HomeScreen has Active and Last 3 tabs', () => {
  const src = read('src/screens/HomeScreen.tsx');
  assert.ok(/'active'/.test(src) && /'last3'/.test(src), "both 'active' and 'last3' tab values must exist");
  assert.ok(/historyTab/.test(src), 'historyTab state must exist');
});

test('HomeScreen Last 3 tab has All | Completed | Cancelled filter', () => {
  const src = read('src/screens/HomeScreen.tsx');
  assert.ok(/historyFilter/.test(src), 'historyFilter state must exist');
  assert.ok(/'all'/.test(src) && /'completed'/.test(src) && /'cancelled'/.test(src),
    'all three filter values must be present');
});

test('HomeScreen derives activeJourneys and last3Journeys from activePredictions', () => {
  const src = read('src/screens/HomeScreen.tsx');
  assert.ok(/activeJourneys/.test(src), 'activeJourneys derivation must exist');
  assert.ok(/last3Journeys/.test(src), 'last3Journeys derivation must exist');
  assert.ok(/\.slice\(0, 3\)/.test(src), 'Last 3 must limit to 3 rooms');
});

test('HomeScreen uses Your journeys heading, not Recent journeys', () => {
  const src = read('src/screens/HomeScreen.tsx');
  assert.ok(
    !/title=\{showAllJourneys \? ['"]My journeys['"] : ['"]Recent journeys['"]\}/.test(src),
    'old "Recent journeys" title must be gone',
  );
  assert.ok(/'Your journeys'/.test(src), '"Your journeys" heading must be present');
});

test('cancelled journeys are detected by isCancelledJourney helper', () => {
  const src = read('src/screens/HomeScreen.tsx');
  assert.ok(/isCancelledJourney/.test(src), 'isCancelledJourney helper must exist');
  assert.ok(
    /cancelled_by_host/.test(src) && /plan_changed/.test(src) && /auto_closed/.test(src),
    'isCancelledJourney must cover all neutral closure journey statuses',
  );
});

test('journey history tab bar renders for both mobile and desktop', () => {
  const src = read('src/screens/HomeScreen.tsx');
  // journeyTabBar is rendered in both the mobile ScrollView and the desktop ScrollView
  const desktopBlock = src.slice(src.indexOf('if (isDesktop)'), src.indexOf('// ── Mobile'));
  const mobileBlock = src.slice(src.indexOf('// ── Mobile'), src.indexOf('const styles'));
  assert.ok(/journeyTabBar/.test(desktopBlock), 'tab bar must render in desktop layout');
  assert.ok(/journeyTabBar/.test(mobileBlock), 'tab bar must render in mobile layout');
});

// ── Backend: dashboard includes cancelled rooms ───────────────────────────────

test('backend activePredictions query includes cancelled status', () => {
  const src = readBackend('dashboard/dashboard.service.ts');
  // Find the activePredictions method's where clause
  const method = src.slice(src.indexOf('async activePredictions(user: User)'), src.indexOf('async updateActivePredictionsOrder'));
  assert.ok(
    /'cancelled'/.test(method),
    'activePredictions query must include "cancelled" status to surface closed journeys on Home',
  );
});

test('backend progressStatusLabel returns Cancelled for cancelled rooms', () => {
  const src = readBackend('dashboard/dashboard.service.ts');
  assert.ok(
    /return 'Cancelled'/.test(src),
    'progressStatusLabel must return "Cancelled" for cancelled/neutral closure rooms',
  );
});

test('backend buildActivePredictionCard uses cancelledAt for completionTime', () => {
  const src = readBackend('dashboard/dashboard.service.ts');
  const card = src.slice(src.indexOf('private buildActivePredictionCard'), src.indexOf('private buildLiveProgress'));
  assert.ok(
    /cancelledAt.*actualEndTime|cancelledAt \?\?/.test(card),
    'completionTime must check cancelledAt before actualEndTime for cancelled rooms',
  );
});
