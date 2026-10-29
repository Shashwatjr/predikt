import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const src = path.resolve(import.meta.dirname, '../src');
const box = ({ children }) => React.createElement('div', null, children);
const colors = new Proxy({}, { get: () => '#ffffff' });

// Run the actual TS/TSX, stubbing only platform/presentation dependencies.
function load(relative, platform = {}, globals = {}) {
  const rn = { Platform: { OS: 'ios' }, Linking: { openURL: async () => {} },
    View: box, Text: box, ScrollView: box, useWindowDimensions: () => ({ width: 390 }),
    Animated: { Value: class { setValue() {} } }, StyleSheet: { create: (value) => value }, ...platform };
  const cache = new Map();
  function moduleAt(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const localRequire = (name) => {
      if (name === 'react') return React;
      if (name === 'react-native') return rn;
      if (name.includes('ThemeContext')) return { useTheme: () => ({ colors }) };
      if (name.includes('AuthContext')) return { useAuth: () => ({ user: null }) };
      if (name.includes('appAlert')) return { appAlert() {} };
      if (name.includes('components/') && !name.endsWith('RouteMapPreview')) {
        return { __esModule: true, default: ({ children, label, title, subtitle }) =>
          React.createElement('div', null, title, subtitle, label, children) };
      }
      if (name.includes('services/api')) return { __esModule: true, default: {} };
      if (name.includes('categoryTheme')) return { getCategoryTheme: () => ({}) };
      if (name.includes('featureFlags')) return { featureFlags: {} };
      if (name.includes('designSystem')) return { layout: {}, palette: {} };
      if (name === 'expo-linear-gradient') return { LinearGradient: box };
      if (name === 'react-native-view-shot') return { __esModule: true, default: box };
      if (name.startsWith('.')) {
        const resolved = path.resolve(path.dirname(file), name);
        return moduleAt(['.ts', '.tsx'].map((ext) => resolved + ext).find(fs.existsSync));
      }
      return require(name);
    };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, { exports: module.exports, module, require: localRequire,
      process: { env: {} }, Date, console, ...globals }, { filename: file });
    return module.exports;
  }
  return moduleAt(path.join(src, relative));
}

const result = load('screens/ResultScreen.tsx');
for (const closure of ['cancelled', 'cancelled_by_host', 'plan_changed', 'auto_closed', 'abandoned']) {
  test(`${closure} is detected in room and result independently`, () => {
    for (const field of ['status', 'journeyStatus', 'closureType']) {
      assert.equal(result.resolveNeutralClosure({ [field]: closure }, { closureType: 'completed' }), closure);
      assert.equal(result.resolveNeutralClosure({ status: 'completed' }, { [field]: closure }), closure);
      assert.equal(result.resolveNeutralClosure({ result: { [field]: closure } }, null), closure);
    }
    assert.equal(result.resolveNeutralClosure(null, { type: closure.toUpperCase() }), closure);
  });
  test(`${closure} exits ResultScreen before podium and scoring UI`, () => {
    const html = renderToStaticMarkup(React.createElement(result.default, {
      navigation: { navigate() {} }, route: { params: { roomId: 'r', result: { closureType: closure,
        winner: { userId: 'x', name: 'Scored winner', totalRoomAura: 99 }, rankings: [{ userId: 'x', pointsAwarded: 99 }],
        predictionEntries: [{ predictionId: 'p', status: 'submitted', selectedOptionKey: 'yes', user: { userId: 'p', name: 'Guest' } }],
      } } },
    }));
    assert.ok(html.includes('Submitted predictions')); assert.ok(html.includes('Guest'));
    assert.ok(!/Pending|Scored winner|Scoreboard|Aura|Rizz|podium|Share receipt|Run It Back/.test(html));
  });
  test(`${closure} renders the neutral record without scored UI or coordinates`, () => {
    const html = renderToStaticMarkup(React.createElement(result.NeutralJourneySummary, {
      closure, room: { startingPointLabel: 'Station', destinationLabel: 'Cafe', creator: { userId: 'host', name: 'Host' },
        closureReasonCode: 'plans_changed', cancelledAt: '2026-10-29T10:00:00Z', route: { latitude: 12.34, longitude: 56.78 } },
      result: { winner: { name: 'Fake winner' } }, roomLoaded: true, predictionsLoaded: true, predictionsError: false, onHome() {},
      predictions: [
        { predictionId: 'p1', user: { userId: 'a', name: 'Alice' }, status: 'visible', predictedReachedTime: '2026-10-29T12:00:00Z', auraEligible: false },
        { predictionId: 'p2', user: { userId: 'b', name: 'Bob' }, status: 'submitted', selectedOptionKey: 'yes' },
        { predictionId: 'p3', user: { userId: 'c', name: 'Chris' }, status: 'submitted' },
      ],
    }));
    for (const expected of ['Station', 'Cafe', 'Host', 'Alice', 'Bob', 'Chris', 'plans changed', 'Closed:', 'yes', 'value unavailable or withheld', 'location is still hidden']) assert.ok(html.includes(expected), expected);
    assert.ok(!/Pending|winner|podium|Aura|Rizz|confetti|Run It Back|Share receipt|12\.34|56\.78/i.test(html));
    assert.ok(!html.includes('Time unavailable'));
  });
}

test('missing metadata and failed prediction fetch stay explicitly unavailable', () => {
  const html = renderToStaticMarkup(React.createElement(result.NeutralJourneySummary, {
    closure: 'auto_closed', room: null, result: {}, predictions: [], roomLoaded: true,
    predictionsLoaded: true, predictionsError: true, onHome() {},
  }));
  for (const expected of ['Not provided', 'Time unavailable', 'Route summary unavailable', 'Participant details unavailable', 'Could not load predictions']) assert.ok(html.includes(expected));
  assert.equal(result.resolveNeutralClosure({ status: 'completed' }, { closureType: 'arrived_verified' }), null);
});

test('share targets preserve the deployed safe card and encode parameters', () => {
  const sharing = load('utils/shareRoom.ts'); const cards = load('share/shareCard.ts');
  const payload = sharing.buildSharePayload({ inviteCode: 'a&42', roomTitle: 'Private home', question: 'Secret question', routeSummary: { startLabel: 'Home', destinationLabel: 'Clinic' } }, 'user&one');
  const card = cards.buildInviteShareCard({ inviteCode: 'a&42', webBaseUrl: 'https://myprediktion.com', forwardedBy: 'user&one', lockLabel: null });
  assert.equal(payload.shareText, card.text); assert.equal(payload.inviteUrl, card.url);
  assert.ok(!/Private home|Secret question|Clinic/.test(payload.shareText));
  assert.equal(new URL(payload.whatsappUrl).origin, 'https://wa.me');
  assert.equal(new URL(payload.whatsappUrl).searchParams.get('text'), payload.shareText);
  for (const key of ['telegramUrl', 'twitterUrl']) {
    const url = new URL(payload[key]); assert.equal(url.searchParams.get('url'), card.url);
    assert.ok(url.searchParams.get('text').includes('Exact location is hidden.'));
  }
  assert.equal(new URL(payload.facebookUrl).searchParams.get('u'), card.url);
  for (const key of ['smsUrl', 'emailUrl']) assert.equal(new URL(payload[key]).searchParams.get('body'), card.text);
  assert.equal(new URL(payload.emailUrl).searchParams.get('subject'), card.title);
});

test('WhatsApp uses wa.me and reports rejected native launches', async () => {
  const opened = [];
  const sharing = load('utils/shareRoom.ts', { Linking: { openURL: async (url) => { opened.push(url); } } });
  const text = 'A & B\nhttps://example.com/?a=1&b=2';
  assert.equal(await sharing.openWhatsAppWithText(text), true);
  assert.equal(new URL(opened[0]).searchParams.get('text'), text);
  const rejected = load('utils/shareRoom.ts', { Linking: { openURL: async () => { throw Error('No handler'); } } });
  assert.equal(await rejected.openWhatsAppWithText('invite'), false);
});

test('web handoff detects blocked popups and detaches opener', async () => {
  const blocked = load('utils/shareRoom.ts', { Platform: { OS: 'web' } }, { window: { open: () => null } });
  assert.equal(await blocked.openShareUrl('https://wa.me/?text=hi'), false);
  const popup = { opener: 'parent', location: {} };
  const sharing = load('utils/shareRoom.ts', { Platform: { OS: 'web' } }, { window: { open: () => popup } });
  assert.equal(await sharing.openShareUrl('mailto:?body=hello'), true);
  assert.equal(popup.opener, null); assert.equal(popup.location.href, 'mailto:?body=hello');
});
