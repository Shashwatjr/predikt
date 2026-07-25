import { capWithEllipsis, shortenPlaceLabel } from './place-label.util';

describe('shortenPlaceLabel', () => {
  it('keeps the primary name and drops country + postal code', () => {
    const label =
      'Cubbon Park, Sampangi Rama Nagara, Bengaluru, Bangalore Urban, Karnataka, 560001, India';
    expect(shortenPlaceLabel(label)).toBe(
      'Cubbon Park, Sampangi Rama Nagara, Bengaluru, Bangalore Urban, Karnataka',
    );
  });

  it('drops multiple trailing postal segments', () => {
    expect(shortenPlaceLabel('Foo, Bar, Baz, 12345, 67890, India')).toBe('Foo, Bar, Baz');
  });

  it('never drops the primary name even for tiny labels', () => {
    // Postal is dropped, primary name is always preserved.
    expect(shortenPlaceLabel('Indiranagar, 560038')).toBe('Indiranagar');
    expect(shortenPlaceLabel('Indiranagar')).toBe('Indiranagar');
  });

  it('handles empty / nullish input', () => {
    expect(shortenPlaceLabel('')).toBe('');
    expect(shortenPlaceLabel(null)).toBe('');
    expect(shortenPlaceLabel(undefined)).toBe('');
  });
});

describe('capWithEllipsis', () => {
  it('returns the string unchanged when within the cap', () => {
    expect(capWithEllipsis('short', 120)).toBe('short');
  });

  it('truncates with an ellipsis and never exceeds max length', () => {
    const long = 'a'.repeat(200);
    const out = capWithEllipsis(long, 120);
    expect(out.length).toBe(120);
    expect(out.endsWith('…')).toBe(true);
  });

  it('caps a generated title built from long OSM labels to 120', () => {
    const title = `Arrival PREDIKT: ${'x'.repeat(90)} → ${'y'.repeat(90)}`;
    expect(capWithEllipsis(title, 120).length).toBeLessThanOrEqual(120);
  });
});
