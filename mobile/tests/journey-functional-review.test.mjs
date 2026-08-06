import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const mobileRoot = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(mobileRoot, rel), 'utf8');

/**
 * Regression tests for the Journey full-functional review.
 *
 * These assert on source shape rather than a rendered tree: the app has no React
 * renderer in its test setup, and every defect below was a structural one (a Modal
 * that captured pointers, a timer defeated by a closure, an unguarded fetch) that
 * is visible and stable in the source.
 */

// ── Today's Tea must never block Home ────────────────────────────────────────
test("Today's Tea is an overlay, not a Modal that swallows taps on Home", () => {
  const src = read('src/components/TodaysTeaOverlay.tsx');

  assert.ok(
    !/<Modal[\s>]/.test(src),
    'Today\'s Tea must not render inside a Modal: on react-native-web and native alike ' +
      'a Modal creates a full-viewport pointer-capturing layer, which made every Home ' +
      'control unclickable until the banner was dismissed.',
  );
  assert.ok(
    /pointerEvents=\{?["']box-none["']\}?/.test(src),
    'the banner container must stay pointer-transparent so only the card itself is interactive',
  );
  assert.ok(
    /position:\s*'absolute'/.test(src),
    'the banner must float above Home rather than take part in its layout',
  );
});

test("Today's Tea does not dim the screen it no longer blocks", () => {
  const src = read('src/components/TodaysTeaOverlay.tsx');
  const scrim = src.slice(src.indexOf('scrim: {'), src.indexOf('cardWrap: {'));
  assert.ok(
    !/backgroundColor:\s*'rgba\(3,8,22,0\.\d+\)'/.test(scrim),
    'a dimming scrim promises modality that the box-none overlay deliberately does not have',
  );
});

test("Today's Tea auto-hide is keyed on its own visibility, not on the effect that shows it", () => {
  const src = read('src/screens/HomeScreen.tsx');

  // The bug: the show-effect armed the timer, and its cleanup flipped an `active`
  // flag the timer closed over. Any dashboard refetch re-ran the effect, so the
  // timer fired into a dead closure and the banner stayed up all session.
  const showEffect = src.slice(
    src.indexOf('async function maybeShowTodaysTea'),
    src.indexOf('void maybeShowTodaysTea();'),
  );
  assert.ok(showEffect.length > 0, 'expected to find the Today\'s Tea show effect');
  assert.ok(
    !/setTimeout/.test(showEffect),
    'the show effect must not own the auto-hide timer; its cleanup invalidates the closure',
  );

  assert.ok(
    /useEffect\(\(\) => \{\s*if \(!teaVisible \|\| !todaysTea\) return;/.test(src),
    'a dedicated effect keyed on [teaVisible, todaysTea] must own the auto-hide timer',
  );
  assert.ok(
    /setTeaVisible\(false\)\), duration\)|setTimeout\(\(\) => setTeaVisible\(false\), duration\)/.test(src),
    'the auto-hide must hide the banner unconditionally rather than behind a stale flag',
  );
});

// ── Live room polling: terminal stop + out-of-order protection ───────────────
test('live-room polling stops once the room reaches a terminal state', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');

  assert.ok(
    /roomIsTerminal\s*=\s*useRef\(false\)/.test(src),
    'a ref must record that the room has settled',
  );
  const interval = src.slice(src.indexOf('const interval = setInterval('), src.indexOf('}, 5000);'));
  assert.ok(
    /if \(roomIsTerminal\.current\)\s*\{[\s\S]*clearInterval\(interval\)/.test(interval),
    'the 5s poll must clear itself once the room is terminal instead of polling a settled room forever',
  );
});

test('a terminal response latches, so a later poll cannot un-settle the room', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  const liveState = src.slice(src.indexOf('async function fetchLiveState'), src.indexOf('async function fetchCheckpointBoards'));
  assert.ok(
    /isTerminalJourneyState\(res\.data\?\.status, res\.data\?\.journeyStatus\)/.test(liveState) &&
      /roomIsTerminal\.current = true/.test(liveState),
    'live-state must latch terminality so a stale "still live" body cannot revive the room',
  );
});

test('every polled fetcher drops replies that are older than one already applied', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');

  assert.ok(
    /function beginRequest\(key: string\)/.test(src),
    'expected a request-sequencing helper guarding out-of-order poll replies',
  );

  // Each fetcher on the 5s tick must stamp its request and bail if overtaken.
  for (const fn of ['fetchRoom', 'fetchLiveState', 'fetchCheckpointBoards', 'fetchLiveLeaderboard', 'fetchPredictions']) {
    const start = src.indexOf(`async function ${fn}(`);
    assert.ok(start > -1, `expected ${fn} to exist`);
    const body = src.slice(start, start + 900);
    assert.ok(
      /const isFresh = beginRequest\('/.test(body),
      `${fn} must stamp its request so a slow reply cannot overwrite newer state`,
    );
    assert.ok(
      /if \(!isFresh\(\)\) return;/.test(body),
      `${fn} must discard its reply once a newer one has been applied`,
    );
  }
});

test('the 5s poll does not re-download the room record and its route geometry', () => {
  const src = read('src/screens/LiveRoomScreen.tsx');
  const interval = src.slice(src.indexOf('const interval = setInterval('), src.indexOf('}, 5000);'));
  assert.ok(
    !/fetchRoom\(\)/.test(interval),
    'GET /rooms/:id carries the full route polyline; lifecycle comes from live-state, ' +
      'so polling the room record would cost hundreds of KB per minute for static data',
  );
  assert.ok(/fetchLiveState\(\)/.test(interval), 'live-state is the endpoint that must be polled');
});

// ── Duplicate submit protection ──────────────────────────────────────────────
test('a second tap cannot file a duplicate prediction while the first is completing', () => {
  const src = read('src/screens/PredictionScreen.tsx');

  assert.ok(/const submittingRef = useRef\(false\)/.test(src), 'expected a submit re-entry guard');
  const handler = src.slice(src.indexOf('async function handleSubmit()'), src.indexOf('// Late-join banner'));
  assert.ok(
    /if \(submittingRef\.current\) return;/.test(handler),
    'handleSubmit must refuse re-entry via a ref — React state is too stale to gate it',
  );
  assert.ok(
    !/\}\s*finally\s*\{\s*setLoading\(false\);\s*\}/.test(handler),
    'the button must not re-enable in a finally block: navigation happens later, inside ' +
      'the confirm animation callback, leaving a window for a second submit',
  );
  assert.ok(
    /navigation\.addListener\('focus'/.test(src) && /submittingRef\.current = false/.test(src),
    'the guard must be released when the screen is returned to, or the button stays stuck',
  );
});

// ── Result screen: real values, not placeholders ─────────────────────────────
test('a reopened result shows the recorded finish instead of the "Result recorded" placeholder', () => {
  const src = read('src/screens/ResultScreen.tsx');

  assert.ok(
    /initialResult\?\.actualOutcome \?\? room\?\.actualEndTime/.test(src),
    'the finish time must fall back to room.actualEndTime, which survives a reopen — the ' +
      'navigation param only exists when arriving straight from confirming arrival',
  );

  const formatter = src.slice(src.indexOf('function formatActualOutcome'), src.indexOf('function buildMomentCardFromResult'));
  assert.ok(
    /room\?\.actualEndTime/.test(formatter),
    'formatActualOutcome must consult the room record before giving up',
  );
  assert.ok(
    (formatter.match(/'Result recorded'/g) || []).length >= 1,
    '"Result recorded" stays only as a genuine last resort for a room with no outcome',
  );
});

test('the result screen does not carry a RIZZ tile that only says RIZZ is not awarded', () => {
  const src = read('src/screens/ResultScreen.tsx');
  assert.ok(
    !/eyebrow="RIZZ"/.test(src),
    'the RIZZ stat card existed only to state that prediction outcomes do not mint RIZZ',
  );
  assert.ok(
    !/Prediction outcomes do not mint RIZZ/.test(src),
    'the accompanying note must go with the tile',
  );
  assert.ok(/eyebrow="Aura"/.test(src), 'Aura is the currency this screen should still report');
});

// ── Invite links ─────────────────────────────────────────────────────────────
test('invite URLs carry the code as a joinCode query parameter on the canonical host', () => {
  // shareRoom.ts imports react-native, which Node cannot parse, so this asserts on
  // the builder's source. The shape matters because the guest entry point reads
  // `?joinCode=` straight off the URL.
  const src = read('src/utils/shareRoom.ts');

  assert.ok(
    /const CANONICAL_WEB_BASE_URL = 'https:\/\/myprediktion\.com'/.test(src),
    'the canonical public domain is a locked product rule',
  );
  assert.ok(
    /\$\{getWebBaseUrl\(\)\}\?joinCode=\$\{encodeURIComponent\(inviteCode\)\}/.test(src),
    'the invite code must ride in ?joinCode= so resolveInviteJoinCode can pick it up',
  );
  assert.ok(
    /forwardedBy\s*\?\s*`\$\{base\}&forwardedBy=\$\{encodeURIComponent\(forwardedBy\)\}`/.test(src),
    'a forwarded invite must append forwardedBy without displacing joinCode',
  );
});

test('invite codes are normalised to upper case before they are looked up', () => {
  const join = read('src/screens/JoinRoomScreen.tsx');
  assert.ok(
    /\(nextCode \?\? code\)\.trim\(\)\.toUpperCase\(\)/.test(join),
    'a typed or pasted code must be trimmed and upper-cased before the invite lookup',
  );
  assert.ok(
    /route\.params\?\.joinCode\?\.trim\(\)\.toUpperCase\(\)/.test(join),
    'a code arriving from a tapped link must be normalised the same way',
  );

  const intent = read('src/utils/inviteIntent.ts');
  assert.ok(
    /params\.get\('joinCode'\)\?\.trim\(\)\.toUpperCase\(\)/.test(intent),
    'the code read out of the URL must be normalised at the source too',
  );
});

// ── Errors must be visible on web ────────────────────────────────────────────
test('journey screens report errors through appAlert, which works on web', () => {
  // react-native-web does not implement Alert.alert — it is a silent no-op, so an
  // invalid invite or a failed lock gave the user no feedback at all in a browser.
  for (const screen of [
    'JoinRoomScreen',
    'LiveRoomScreen',
    'CreateRoomScreen',
    'RoomCreatedScreen',
    'LoginScreen',
    'RegisterScreen',
    'PredictionScreen',
  ]) {
    const src = read(`src/screens/${screen}.tsx`);
    assert.ok(
      !/\bAlert\.alert\(/.test(src),
      `${screen} must not call Alert.alert: it silently does nothing on web`,
    );
    assert.ok(
      /appAlert/.test(src),
      `${screen} should surface messages through appAlert`,
    );
  }
});

// ── Landing page offers nothing that does not exist ──────────────────────────
test('the landing example journey is not a tappable link to a room that never existed', () => {
  const src = read('src/screens/LandingScreen.v2.tsx');

  const section = src.slice(src.indexOf('What a journey looks like'), src.indexOf('Legal Footer'));
  assert.ok(section.length > 0, 'expected the example-journey section');
  assert.ok(
    !/onPress=\{\(\) => handleJoinLobby\(socialProofExample\.code\)\}/.test(section),
    'the illustrative card must not navigate to a join flow for a fabricated invite code',
  );
  assert.ok(
    !/sectionTitle\}>Recent Journeys</.test(src),
    'a fabricated card must not be titled as recent real activity',
  );
  assert.ok(
    /sectionTitle\}>What a journey looks like</.test(src),
    'the section should read as an illustration',
  );
  assert.ok(
    />EXAMPLE</.test(src) && !/>LIVE</.test(src),
    'the card must be badged as an example rather than claiming to be a live room',
  );
});

test('the landing rail only offers destinations that exist', () => {
  const src = read('src/components/LandingDashboardLayout.tsx');
  const navBlock = src.slice(src.indexOf('const NAV_ITEMS'), src.indexOf('const DESKTOP_BREAKPOINT'));

  assert.ok(!/'streams'/.test(navBlock), '"Streams" had no destination and no handler');
  assert.ok(!/'messages'/.test(navBlock), '"Messages" had no destination and no handler');
  assert.ok(/'home'/.test(navBlock) && /'lobbies'/.test(navBlock), 'the real destinations stay');
});

test('empty side panels are hidden rather than rendered as empty cards', () => {
  const src = read('src/components/LandingDashboardLayout.tsx');
  assert.ok(
    /\{onlineFriends\.length \?/.test(src),
    'the Online Friends panel must not render as an empty titled card',
  );
  assert.ok(
    /\{activeLobbies\.length \?/.test(src),
    'the Active Game Lobbies panel must not render as an empty titled card',
  );
});
