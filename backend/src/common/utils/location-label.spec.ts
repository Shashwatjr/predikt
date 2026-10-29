import { safeLocationLabel, safeLocationLabels } from './location-label';

describe('coordinate-only place labels', () => {
  it.each(['12.345678, 76.543219', '23.456789, 87.654321', '(12.9, -77.6)',
    'lat: 12.9, lng: 77.6', 'geo:12.9,77.6', '12.9° N, 77.6° E',
    'POINT (77.6 12.9)', '12.9 77.6', `12°58′17″N, 77°35′40″E`])('neutralizes %s', (label) => {
    expect(safeLocationLabel(label, 'startingPointLabel')).toBe('Selected start');
    expect(safeLocationLabel(label, 'destinationLabel')).toBe('Selected destination');
  });
  it.each(['12/34', '12, MG Road, Bengaluru 560001', '221B Baker Street, London',
    '12.9 Cafe, Main Road', 'Station', 'Cafe'])('preserves address %s', (label) => {
    expect(safeLocationLabel(label)).toBe(label);
  });
  it('projects nested legacy payloads without mutating them or dates', () => {
    const date = new Date();
    const input = { route: { startLabel: '12.9,77.6' }, createdAt: date, predictions: [{ destinationLabel: '23.4,87.6' }] };
    expect(safeLocationLabels(input)).toEqual({ route: { startLabel: 'Selected start' }, createdAt: date, predictions: [{ destinationLabel: 'Selected destination' }] });
    expect(input.route.startLabel).toBe('12.9,77.6');
  });
});
