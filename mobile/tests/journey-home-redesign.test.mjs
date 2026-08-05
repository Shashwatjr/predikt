import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

import {
  ENDED_JOURNEY_STATUSES,
  JOURNEY_HOME_PLACE_MAX,
  SETTLED_STATUSES,
  formatJourneyRoute,
  journeyPillLabel,
  journeyPillTone,
  shortenJourneyPlaceLabel,
  shouldShowStatusSentence,
} from '../src/utils/journeyCardStatus.ts';

const mobileRoot = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(mobileRoot, rel), 'utf8');

/** Minimal PNG header reader — dimensions, colour type, and whether alpha varies. */
function readPng(rel) {
  const buf = fs.readFileSync(path.join(mobileRoot, rel));
  assert.equal(buf.readUInt32BE(0), 0x89504e47, `${rel} is not a PNG`);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];

  const idat = [];
  let offset = 8;
  let hasTrns = false;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(buf.subarray(offset + 8, offset + 8 + len));
    if (type === 'tRNS') hasTrns = true;
    offset += 12 + len;
  }
  return { width, height, bitDepth, colorType, hasTrns, idat: Buffer.concat(idat) };
}

/** Decodes an 8-bit RGBA PNG far enough to sample the first row's alpha values. */
function firstRowAlpha(png) {
  const raw = zlib.inflateSync(png.idat);
  const stride = png.width * 4;
  const filter = raw[0];
  assert.ok(filter === 0 || filter === 1, `unexpected filter ${filter} on row 0`);
  const row = Buffer.alloc(stride);
  for (let i = 0; i < stride; i++) {
    const left = i >= 4 ? row[i - 4] : 0;
    row[i] = (raw[1 + i] + (filter === 1 ? left : 0)) & 255;
  }
  const alphas = [];
  for (let x = 0; x < png.width; x++) alphas.push(row[x * 4 + 3]);
  return alphas;
}

// ── status pill: tone ────────────────────────────────────────────────────────

test('pill tone maps each status to exactly one meaning', () => {
  assert.equal(journeyPillTone('live', false), 'live');
  assert.equal(journeyPillTone('live', true), 'live', 'live wins regardless of prediction');

  for (const status of SETTLED_STATUSES) {
    assert.equal(journeyPillTone(status, false), 'done', `${status} should settle`);
    assert.equal(journeyPillTone(status, true), 'done', `${status} should settle`);
  }

  // Waiting is specifically "open AND the viewer hasn't called it yet".
  assert.equal(journeyPillTone('predictions_open', false), 'wait');
  assert.equal(journeyPillTone('predictions_open', true), 'neutral');

  assert.equal(journeyPillTone('predictions_locked', false), 'neutral');
  assert.equal(journeyPillTone('anything_else', false), 'neutral');
});

test('pill tone is case-insensitive and survives absent status', () => {
  assert.equal(journeyPillTone('LIVE', false), 'live');
  assert.equal(journeyPillTone('Result_Ready', false), 'done');
  assert.equal(journeyPillTone(undefined, false), 'neutral');
  assert.equal(journeyPillTone(null, false), 'neutral');
  assert.equal(journeyPillTone('', false), 'neutral');
});

// ── status pill: label ──────────────────────────────────────────────────────

test('pill labels stay short enough to sit beside the route in a grid card', () => {
  const cases = [
    ['live', 'live', false, null, 'Live'],
    ['done', 'result_ready', false, null, 'Result ready'],
    ['wait', 'predictions_open', false, null, 'Waiting'],
    ['neutral', 'predictions_open', true, null, 'Locked in'],
    ['neutral', 'predictions_locked', false, null, 'Closed'],
    ['neutral', 'unknown', false, 'auto_closed', 'Ended'],
    ['neutral', 'unknown', false, null, 'Ready'],
  ];

  for (const [tone, status, submitted, journeyStatus, expected] of cases) {
    const label = journeyPillLabel(tone, status, submitted, journeyStatus);
    assert.equal(label, expected, `${tone}/${status}`);
    // Two words at most, so the pill never squeezes the route into extra lines.
    assert.ok(label.split(' ').length <= 2, `"${label}" is too long for the pill`);
  }
});

test('every ended journey status resolves to a single terminal pill label', () => {
  for (const journeyStatus of ENDED_JOURNEY_STATUSES) {
    assert.equal(journeyPillLabel('neutral', 'unknown', false, journeyStatus), 'Ended', journeyStatus);
  }
});

test('the full status sentence renders only when the pill does not already say it', () => {
  // This is what stopped the card printing "Result ready" twice in a row.
  assert.equal(shouldShowStatusSentence('neutral'), true);
  for (const tone of ['live', 'wait', 'done']) {
    assert.equal(shouldShowStatusSentence(tone), false, tone);
  }
});

// ── route labels ────────────────────────────────────────────────────────────

test('place labels keep the first comma component and cap with an ellipsis', () => {
  assert.equal(shortenJourneyPlaceLabel('Koramangala, Bengaluru, KA'), 'Koramangala');
  assert.equal(shortenJourneyPlaceLabel('  Indiranagar  '), 'Indiranagar');
  assert.equal(shortenJourneyPlaceLabel(''), '');
  assert.equal(shortenJourneyPlaceLabel(null), '');
  assert.equal(shortenJourneyPlaceLabel(undefined), '');

  const long = shortenJourneyPlaceLabel('Harohalli Avalahalli Kaval', JOURNEY_HOME_PLACE_MAX);
  assert.ok(long.length <= JOURNEY_HOME_PLACE_MAX, `"${long}" exceeded the cap`);
  assert.ok(long.endsWith('…'), 'truncated labels should be marked with an ellipsis');
});

test('grid route lines stay short enough for two lines in a ~370px card', () => {
  const route = formatJourneyRoute(
    'Harohalli Avalahalli Kaval, Bengaluru',
    'Jan Aushadhi Kendra Bengaluru, KA',
    JOURNEY_HOME_PLACE_MAX,
  );
  // Two capped places plus " → ".
  assert.ok(route.length <= JOURNEY_HOME_PLACE_MAX * 2 + 3, `"${route}" is too long for a grid card`);
  assert.match(route, / → /);
});

test('route falls back to placeholders rather than rendering a bare arrow', () => {
  assert.equal(formatJourneyRoute(null, null), 'Start → Destination');
  assert.equal(formatJourneyRoute('Home', null), 'Home → Destination');
  assert.equal(formatJourneyRoute(null, 'Office'), 'Start → Office');
});

test('the default cap is looser than the grid cap, so other surfaces keep detail', () => {
  const full = shortenJourneyPlaceLabel('Harohalli Avalahalli Kaval');
  const grid = shortenJourneyPlaceLabel('Harohalli Avalahalli Kaval', JOURNEY_HOME_PLACE_MAX);
  assert.ok(full.length > grid.length);
});

// ── brand logo assets ───────────────────────────────────────────────────────

test('both wordmark variants are RGBA and share one pixel size', () => {
  const brand = readPng('assets/logo-wordmark.png');
  const onDark = readPng('assets/logo-wordmark-ondark.png');

  for (const [name, png] of [['brand', brand], ['onDark', onDark]]) {
    // Colour type 6 = truecolour + alpha. The original asset was type 2 (no alpha),
    // which rendered the logo as an opaque navy rectangle on every card surface.
    assert.equal(png.colorType, 6, `${name} wordmark must carry an alpha channel`);
    assert.equal(png.bitDepth, 8, `${name} wordmark should be 8-bit`);
  }

  assert.equal(brand.width, onDark.width, 'variants must be interchangeable');
  assert.equal(brand.height, onDark.height, 'variants must be interchangeable');
});

test('BrandLogo aspect ratio matches the real asset dimensions', () => {
  const png = readPng('assets/logo-wordmark-ondark.png');
  const source = read('src/components/BrandLogo.tsx');

  const match = source.match(/const ASPECT_RATIO = (\d+) \/ (\d+);/);
  assert.ok(match, 'BrandLogo should declare ASPECT_RATIO as width / height');
  assert.equal(Number(match[1]), png.width, 'declared width drifted from the asset');
  assert.equal(Number(match[2]), png.height, 'declared height drifted from the asset');
});

test('the wordmark is transparent at its edges, not matted onto a dark box', () => {
  const png = readPng('assets/logo-wordmark-ondark.png');
  const alphas = firstRowAlpha(png);
  assert.equal(alphas[0], 0, 'top-left pixel should be fully transparent');
  assert.equal(alphas.at(-1), 0, 'top-right pixel should be fully transparent');
  assert.ok(
    alphas.every((a) => a === 0),
    'the top row sits above the artwork, so it should be entirely transparent',
  );
});

// ── layout invariants ───────────────────────────────────────────────────────

test('route art derives height from width so the SVG cannot letterbox itself', () => {
  const source = read('src/components/JourneyRouteArt.tsx');

  const declared = source.match(/JOURNEY_ROUTE_ART_ASPECT = (\d+) \/ (\d+);/);
  assert.ok(declared, 'the art should export its aspect ratio');

  const viewBox = source.match(/viewBox="0 0 (\d+) (\d+)"/);
  assert.ok(viewBox, 'the art should declare a viewBox');
  assert.equal(declared[1], viewBox[1], 'aspect width must track the viewBox');
  assert.equal(declared[2], viewBox[2], 'aspect height must track the viewBox');

  // fitWidth swaps the fixed height for an aspect-locked box.
  assert.match(source, /fitWidth \? \{ aspectRatio: JOURNEY_ROUTE_ART_ASPECT \} : \{ height \}/);
});

test('the wide hero floats its art behind the copy so copy drives card height', () => {
  const source = read('src/components/JourneyHeroCard.tsx');

  assert.match(source, /artLayerWide:\s*\{[\s\S]*?position: 'absolute'/);
  // No fixed height on the wide art — that was the source of the vertical gap.
  assert.doesNotMatch(source, /<JourneyRouteArt fitWidth[^>]*height=/);
  assert.match(source, /overflow: 'hidden'/, 'the card must clip the bleeding art');
  assert.match(source, /<JourneyRouteArt fitWidth/);
});

test('the hero headline break is explicit rather than dependent on wrapping', () => {
  const heroSource = read('src/components/JourneyHeroCard.tsx');
  const homeSource = read('src/screens/HomeScreen.tsx');

  assert.match(heroSource, /headlineAccent\?: string;/);
  assert.match(homeSource, /headlineAccent="/, 'Home should supply the second line explicitly');
});

/**
 * Each wide headline line must fit on ONE line, because the two-line break is
 * explicit — a line that wraps makes the hero three lines tall and reopens the
 * vertical gap beside the artwork.
 *
 * Budget measured in a browser at the declared sizes (worst case ~22.2px/char at
 * 46px, ~17.6px/char at 36px):
 *   desktop     46px in a 640px column -> 28 chars (~7% slack at 27)
 *   tabletWide  36px in a 520px column -> 29 chars (~9% slack at 27)
 * The binding limit is therefore 28. The style assertions below pin the values the
 * budget was derived from, so changing a font size or column width fails here
 * rather than silently invalidating the limit.
 */
const HEADLINE_MAX_CHARS = 28;

test('hero headline lines fit one line at both wide tiers', () => {
  const heroSource = read('src/components/JourneyHeroCard.tsx');
  const homeSource = read('src/screens/HomeScreen.tsx');

  assert.match(heroSource, /headlineWide: \{ fontSize: 46,/, 'desktop headline size changed');
  assert.match(heroSource, /headlineTabletWide: \{ fontSize: 36,/, 'tablet headline size changed');
  assert.match(heroSource, /copyWide: \{ maxWidth: 640,/, 'desktop copy column changed');
  assert.match(heroSource, /copyTabletWide: \{ maxWidth: 520 \}/, 'tablet copy column changed');

  const lines = [...homeSource.matchAll(/\bheadline(?:Accent)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(lines.length >= 2, 'expected Home to supply both headline lines');

  for (const line of lines) {
    assert.ok(
      line.length <= HEADLINE_MAX_CHARS,
      `headline "${line}" is ${line.length} chars, over the ${HEADLINE_MAX_CHARS}-char one-line budget`,
    );
  }
});

test('hero tier chips encode friends / bot / baseline with the baseline de-emphasised', () => {
  const source = read('src/components/JourneyHeroCard.tsx');

  assert.match(source, /JourneyTierTone = 'friends' \| 'bot' \| 'baseline'/);
  assert.match(source, /tierDot_friends:/);
  assert.match(source, /tierDot_bot:/);
  assert.match(source, /tierDot_baseline:/);
  // The baseline is a yardstick, never a competitor: dashed and muted.
  assert.match(source, /tierBaseline:\s*\{[\s\S]*?borderStyle: 'dashed'/);
  assert.match(source, /tierTextBaseline:\s*\{ color: journeyPalette\.textMuted \}/);
});

test('the journeys grid and the loading skeleton share one set of styles', () => {
  const listSource = read('src/components/JourneyListSection.tsx');
  const homeSource = read('src/screens/HomeScreen.tsx');

  assert.match(listSource, /export const journeyGridStyles = StyleSheet\.create/);
  assert.match(listSource, /flexWrap: 'wrap'/);
  assert.match(listSource, /list: journeyGridStyles\.list/);
  assert.match(listSource, /gridItem: journeyGridStyles\.item/);

  // The skeleton must lay out on the same grid or the dashboard reflows on load.
  assert.match(homeSource, /journeyGridStyles/);
  assert.match(homeSource, /style=\{journeyGridStyles\.list\}/);
  assert.match(homeSource, /style=\{journeyGridStyles\.item\}/);
});

test('the loading skeleton and the loaded screen show the same bottom nav tabs', () => {
  const homeSource = read('src/screens/HomeScreen.tsx');
  // A stale hiddenTabs on the skeleton made the "+" tab appear only after load.
  assert.doesNotMatch(homeSource, /hiddenTabs/);
});

test('the sidebar skeleton is exactly as wide as the real rail', () => {
  const homeSource = read('src/screens/HomeScreen.tsx');
  const railSource = read('src/components/JourneySidebar.tsx');

  const railWidth = railSource.match(/rail:\s*\{\s*width: (\d+)/);
  const skeletonWidth = homeSource.match(/sidebarSkeleton:\s*\{[\s\S]*?width: (\d+)/);
  assert.ok(railWidth && skeletonWidth, 'both the rail and its skeleton should pin a width');
  assert.equal(skeletonWidth[1], railWidth[1], 'skeleton rail width drifted from the real rail');
});

test('every sidebar destination has an icon and a handler', () => {
  const railSource = read('src/components/JourneySidebar.tsx');
  const homeSource = read('src/screens/HomeScreen.tsx');

  const union = railSource.match(/export type JourneySidebarItem =([^;]+);/);
  assert.ok(union, 'the rail should export its item union');
  const items = [...union[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(items, ['Home', 'StartJourney', 'JoinJourney', 'MyJourneys']);

  // Each union member appears in ITEMS with a typed icon name (no emoji glyphs).
  const itemsBlock = railSource.match(/const ITEMS[\s\S]*?\];/)[0];
  for (const item of items) {
    assert.ok(itemsBlock.includes(`key: '${item}'`), `${item} missing from ITEMS`);
  }
  assert.match(itemsBlock, /icon: '(home|plus|link|list)'/);
  assert.doesNotMatch(railSource, /navIcon/, 'emoji nav glyphs should be gone');

  // Home routes every non-Home destination somewhere.
  const handler = homeSource.match(/function handleSidebar[\s\S]*?\n  \}/)[0];
  for (const item of items.filter((i) => i !== 'Home')) {
    assert.ok(handler.includes(`'${item}'`), `handleSidebar does not handle ${item}`);
  }
});

test('every bottom nav tab is handled, including the raised create action', () => {
  const homeSource = read('src/screens/HomeScreen.tsx');
  const navSource = read('src/components/BottomNav.tsx');

  const union = navSource.match(/export type NavTab =([^;]+);/);
  const tabs = [...union[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['Home', 'Create', 'Profile']);

  const handler = homeSource.match(/function handleBottomNav[\s\S]*?\n  \}/)[0];
  // Create must open the create flow, not fall through to Profile.
  assert.match(handler, /tab === 'Create'[\s\S]*?startJourney\(\)/);
});

test('status accents are declared once in the palette and reused', () => {
  const paletteSource = read('src/theme/journeyPalette.ts');
  const cardSource = read('src/components/ActivePredictionCard.tsx');

  for (const token of ['cyan', 'green', 'orange']) {
    assert.match(paletteSource, new RegExp(`${token}: '#`), `${token} accent missing`);
  }

  // The pill reads its colour from the palette rather than inlining hex codes.
  assert.match(cardSource, /journeyPalette\.green/);
  assert.match(cardSource, /journeyPalette\.orange/);
  assert.match(cardSource, /journeyPalette\.cyan/);
});
