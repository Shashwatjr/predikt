import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
register('./resolve-ts.mjs', import.meta.url);
const { safeLocationLabel, safeLocationLabels } = await import('../src/utils/locationLabel.ts');
const { buildInviteShareCard } = await import('../src/share/shareCard.ts');
test('coordinate-only labels cannot leak through legacy API data or direct share callers', () => {
  for (const value of ['12.345678, 76.543219', 'lat: 12.9, lng: 77.6', 'POINT (77.6 12.9)', 'geo:12.9,77.6']) {
    assert.equal(safeLocationLabel(value, 'startLabel'), 'Selected start');
    const card = buildInviteShareCard({ inviteCode: 'QA42', webBaseUrl: 'https://example.test', revealPlaces: true, startLabel: value, destinationLabel: value });
    assert(!card.text.includes(value));
    assert(card.text.includes('Selected destination'));
  }
  const address = '12, MG Road, Bengaluru 560001';
  assert.equal(safeLocationLabels({ route: { startLabel: address } }).route.startLabel, address);
  assert.equal(safeLocationLabel('12/34'), '12/34');
});
