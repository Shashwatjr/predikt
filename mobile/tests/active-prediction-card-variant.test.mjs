import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const mobileRoot = '/Users/krivikshaaitech/predikt/mobile';
const srcRoot = path.join(mobileRoot, 'src');

function read(relativePath) {
  return fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

test('default ActivePredictionCard variant preserves the existing cyan path', () => {
  const source = read('src/components/ActivePredictionCard.tsx');

  assert.match(source, /variant\?: 'default' \| 'journeyHome'/);
  assert.match(source, /variant = 'default'/);
  assert.match(source, /const primaryActionBackground = isJourneyHome \? journeyPalette\.purple : colors\.purple;/);
  assert.match(source, /const badgeBackgroundColor =[\s\S]*: colors\.purpleDim;/);
  assert.match(source, /const badgeTextColor =[\s\S]*: colors\.purpleLight;/);
  assert.match(source, /const progressAccentColors = isJourneyHome \? journeyPalette\.gradAccent : colors\.gradPrimary;/);
});

test('Home passes journeyHome and JourneyListSection forwards it to ActivePredictionCard', () => {
  const homeSource = read('src/screens/HomeScreen.tsx');
  const listSource = read('src/components/JourneyListSection.tsx');

  assert.match(homeSource, /<JourneyListSection[\s\S]*cardVariant="journeyHome"/);
  assert.match(listSource, /variant=\{cardVariant \?\? 'default'\}/);
});

test('Journey Home removes the standalone Aura stat tile but keeps Aura visible in chips', () => {
  const homeSource = read('src/screens/HomeScreen.tsx');
  const headerSource = read('src/components/JourneyHeader.tsx');

  assert.doesNotMatch(homeSource, /JourneyStatsRow/);
  assert.match(homeSource, /aura=\{totalAura\}/);
  assert.match(homeSource, /desktopAuraChip/);
  assert.match(headerSource, /auraChip/);
});

test('Journey Home hero includes both primary and secondary actions in the compact copy-first layout', () => {
  const homeSource = read('src/screens/HomeScreen.tsx');
  const heroSource = read('src/components/JourneyHeroCard.tsx');

  assert.match(homeSource, /title="Journey ETA"/);
  assert.match(homeSource, /headline="Think you can beat the map\?"/);
  assert.match(homeSource, /secondaryLabel="Join a Journey"/);
  assert.match(heroSource, /actionRow/);
  assert.match(heroSource, /secondaryWide/);
});

test('Journey Home limits cards, uses friendly section naming, and shows view all only past 3 items', () => {
  const homeSource = read('src/screens/HomeScreen.tsx');

  assert.match(homeSource, /const HOME_JOURNEY_LIMIT = 3;/);
  assert.match(homeSource, /title="Your journeys"/);
  assert.doesNotMatch(homeSource, /Your recent journeys/);
  assert.match(homeSource, /journeys\.length > HOME_JOURNEY_LIMIT/);
});

test('journeyHome cards use shortened route labels and friendly actions by status', () => {
  const cardSource = read('src/components/ActivePredictionCard.tsx');

  assert.match(cardSource, /function shortenJourneyPlaceLabel/);
  assert.match(cardSource, /split\(','\)/);
  assert.match(cardSource, /function formatJourneyRoute/);
  assert.match(cardSource, /return 'View Result';/);
  assert.match(cardSource, /return 'Predict now';/);
  assert.match(cardSource, /return 'Open Journey';/);
  assert.match(cardSource, /friendlyRoute = formatJourneyRoute/);
});

test('Journey Home hides technical lifecycle copy such as auto-close messaging', () => {
  const cardSource = read('src/components/ActivePredictionCard.tsx');
  const journeyHomeBlock = cardSource.match(/if \(isJourneyHome\) \{[\s\S]*?return \([\s\S]*?\n  \}/)?.[0] ?? '';

  assert.match(cardSource, /This journey ended automatically/);
  assert.doesNotMatch(cardSource, /Predictions neutralized after auto-close/);
  assert.doesNotMatch(journeyHomeBlock, /Approximate progress/);
  assert.doesNotMatch(journeyHomeBlock, /lifecycleLabel/);
  assert.doesNotMatch(journeyHomeBlock, /Result ready · 1 participants/);
});

test('journeyHome is scoped to the Home journey list flow only', () => {
  const allowedJourneyHomeFiles = new Set([
    path.join(srcRoot, 'components/ActivePredictionCard.tsx'),
    path.join(srcRoot, 'screens/HomeScreen.tsx'),
  ]);
  const journeyListSource = read('src/components/JourneyListSection.tsx');

  const filesWithJourneyHome = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (!fs.readFileSync(fullPath, 'utf8').includes('journeyHome')) continue;
      filesWithJourneyHome.push(fullPath);
    }
  }

  walk(srcRoot);

  assert.match(journeyListSource, /cardVariant\?: ActivePredictionCardVariant/);
  assert.match(journeyListSource, /variant=\{cardVariant \?\? 'default'\}/);
  assert.deepEqual(new Set(filesWithJourneyHome), allowedJourneyHomeFiles);
});

test('Build Journey keeps prediction hidden until a valid route preview exists', () => {
  const createSource = read('src/screens/CreateRoomScreen.tsx');

  assert.match(createSource, /\{preview \? \(/);
  assert.match(createSource, /Make your call/);
  assert.match(createSource, /if \(selectedCategory !== 'arrival_time' \|\| !readyForPreview\)/);
});

test('Build Journey reveals inline route result after preview calculation succeeds', () => {
  const createSource = read('src/screens/CreateRoomScreen.tsx');

  assert.match(createSource, /Journey time/);
  assert.match(createSource, /Distance/);
  assert.match(createSource, /Estimated arrival:/);
  assert.match(createSource, /Approximate estimate based on distance and travel mode/);
});

test('Build Journey maps and bot shortcuts update the same creator prediction value', () => {
  const createSource = read('src/screens/CreateRoomScreen.tsx');

  assert.match(createSource, /const buildJourneyPredictionAdjustments = \[/);
  assert.match(createSource, /label: 'Maps ETA'/);
  assert.match(createSource, /label: 'Bot guess'/);
  assert.match(createSource, /setCreatorPrediction\(new Date\(mapsEtaDate\)\)/);
  assert.match(createSource, /setCreatorPrediction\(new Date\(botEtaDate\)\)/);
});

test('Build Journey offset shortcuts update creator prediction from one source of truth', () => {
  const createSource = read('src/screens/CreateRoomScreen.tsx');

  assert.match(createSource, /label: '−1 min'/);
  assert.match(createSource, /label: '−30 sec'/);
  assert.match(createSource, /label: '\+30 sec'/);
  assert.match(createSource, /label: '\+1 min'/);
  assert.match(createSource, /label: '\+2 min'/);
  assert.match(createSource, /label: '\+5 min'/);
  assert.match(createSource, /setCreatorPrediction\(new Date\(creatorPrediction\.getTime\(\) \+ action\.seconds \* 1000\)\)/);
});

test('Create Journey submits route, mode, host prediction and a real prediction row', () => {
  const createSource = read('src/screens/CreateRoomScreen.tsx');

  assert.match(createSource, /api\.post\('\/rooms\/from-route'/);
  assert.match(createSource, /travelMode,/);
  assert.match(createSource, /hostPrediction: \{\s*arrivalTime: creatorPrediction\.toISOString\(\),\s*\}/);
  assert.match(createSource, /api\.post\(`\/rooms\/\$\{res\.data\.roomId\}\/predictions`/);
  assert.match(createSource, /predictedArrivalTime: creatorPrediction\.toISOString\(\)/);
});

test('Build Journey uses stacked mobile route fields and side-by-side desktop route fields', () => {
  const createSource = read('src/screens/CreateRoomScreen.tsx');

  assert.match(createSource, /const isDesktop = width >= layout\.breakpoints\.tablet;/);
  assert.match(createSource, /isDesktop \? styles\.routeFieldsDesktop : styles\.routeFieldsMobile/);
  assert.match(createSource, /routeFieldsDesktop: \{ flexDirection: 'row' \}/);
  assert.match(createSource, /routeFieldsMobile: \{ flexDirection: 'column' \}/);
});
