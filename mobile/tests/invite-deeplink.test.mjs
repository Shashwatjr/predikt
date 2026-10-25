import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';

register('./resolve-ts.mjs', import.meta.url);

test('invite routing, share card, and preview HTML', async () => {
  const routing = await import('../src/navigation/inviteRouting.ts');
  const cards = await import('../src/share/shareCard.ts');
  const htmlMod = await import('../src/share/invitePreviewHtml.ts');

  const parsed = routing.parseInviteTarget(
    'http://127.0.0.1:8091/?joinCode=%50%31%35%48%58&forwardedBy=user-1',
  );
  assert.deepEqual(parsed, { joinCode: 'P15HX', forwardedBy: 'user-1' });
  assert.equal(routing.parseInviteTarget('http://127.0.0.1:8091/?joinCode=%255031354858').joinCode, null);

  assert.deepEqual(routing.parseInviteTarget('http://127.0.0.1:8091/join?joinCode=ab12&forwardedBy=abc'), {
    joinCode: 'AB12',
    forwardedBy: 'abc',
  });
  assert.equal(routing.parseInviteTarget('http://127.0.0.1:8091/join/p15hx?forwardedBy=abc').joinCode, 'P15HX');
  assert.equal(routing.inviteStateFromPath('/join/p15hx')?.routes[0].name, 'JoinRoom');
  assert.equal(routing.inviteStateFromPath('/'), null);

  assert.deepEqual(
    routing.selectInviteForLoad({ joinCode: null, forwardedBy: null }, parsed, 'reload'),
    parsed,
  );
  assert.deepEqual(
    routing.selectInviteForLoad({ joinCode: null, forwardedBy: null }, parsed, 'navigate'),
    { joinCode: null, forwardedBy: null },
  );

  const now = Date.parse('2026-10-25T00:00:00Z');
  assert.equal(routing.classifyInvitePreview(null, 404, now), 'invalid');
  assert.equal(
    routing.classifyInvitePreview(
      { status: 'created', lockTime: '2026-10-01T00:00:00Z', visibility: 'invite_only' },
      200,
      now,
    ),
    'expired',
  );
  assert.equal(routing.classifyInvitePreview({ status: 'cancelled', visibility: 'invite_only' }, 200, now), 'closed');
  assert.equal(
    routing.classifyInvitePreview(
      { status: 'predictions_open', visibility: 'private', safePreview: { journeyStatus: 'auto_closed' } },
      200,
      now,
    ),
    'closed',
  );
  assert.equal(
    routing.classifyInvitePreview({ status: 'predictions_open', visibility: 'private' }, 200, now),
    'private',
  );
  assert.equal(routing.describeInviteEntry({ preview: null, httpStatus: 404 }).allowJoin, false);
  assert.equal(
    routing.describeInviteEntry({
      preview: { status: 'predictions_open', visibility: 'invite_only' },
      httpStatus: 200,
      now,
    }).allowJoin,
    true,
  );

  const card = cards.buildInviteShareCard({
    inviteCode: 'p15hx',
    webBaseUrl: 'https://www.myprediktion.com/',
    forwardedBy: 'user-1',
    startLabel: 'Hidden Start',
    destinationLabel: 'Hidden Destination',
    lockLabel: '1 Jan',
  });
  assert.equal(card.revealPlaces, false);
  assert.equal(card.url, 'https://myprediktion.com?joinCode=P15HX&forwardedBy=user-1');
  assert.equal(card.text.includes('Hidden Destination'), false);
  assert.equal(card.text.includes('Exact location is hidden.'), true);
  assert.equal(cards.normalizeWebBaseUrl('http://192.168.1.119:8091/'), 'http://192.168.1.119:8091');
  assert.equal(cards.normalizeWebBaseUrl('http://localhost:8081'), 'http://localhost:8081');

  const result = cards.buildResultShareCard({
    inviteCode: 'P15HX',
    webBaseUrl: 'https://myprediktion.com',
    outcome: 'Result ready',
  });
  assert.equal(result.text.includes('Result ready'), true);
  assert.equal(
    cards
      .buildResultShareCard({
        inviteCode: 'P15HX',
        webBaseUrl: 'https://myprediktion.com',
        outcome: 'access_token=secret-value',
      })
      .text.includes('secret-value'),
    false,
  );

  const redacted = cards.omitProtectedShareFields({
    inviteCode: 'P15HX',
    destinationLabel: 'Hidden Destination',
    accessToken: 'secret-value',
    startingLat: 1,
  });
  assert.equal(redacted.inviteCode, 'P15HX');
  assert.equal('destinationLabel' in redacted, false);
  assert.equal('accessToken' in redacted, false);
  assert.equal('startingLat' in redacted, false);

  const html = htmlMod.buildInvitePreviewDocument({
    inviteCode: 'P15HX',
    webBaseUrl: 'https://myprediktion.com',
    forwardedBy: 'user-1',
  });
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:description"/);
  assert.match(html, /Exact location is hidden/);
  assert.equal(html.includes('Hidden Destination'), false);
  assert.equal(html.includes('<script'), false);
});
