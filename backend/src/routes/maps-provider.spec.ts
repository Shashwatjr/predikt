import { ConfigService } from '@nestjs/config';
import { createMapsProvider, normalizeTravelMode, providerTravelMode } from './maps-provider';

function config(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('maps provider selection', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('auto-selects Google when configured', () => {
    const provider = createMapsProvider(config({ GOOGLE_MAPS_API_KEY: 'key' }));
    expect(provider.name).toBe('google');
    expect(provider.label).toBe('Google Maps');
  });

  it('falls back to OpenStreetMap when no provider keys exist', () => {
    const provider = createMapsProvider(config({}));
    expect(provider.name).toBe('osm');
    expect(provider.label).toBe('OpenStreetMap');
  });

  it('normalizes frontend travel modes', () => {
    expect(normalizeTravelMode('car')).toBe('car');
    expect(normalizeTravelMode('bike')).toBe('bike');
    expect(normalizeTravelMode('walk')).toBe('walk');
    expect(normalizeTravelMode('cycle')).toBe('cycle');
    expect(normalizeTravelMode('driving')).toBe('car');
  });

  it('maps unsupported provider modes with clear fallback labels', () => {
    expect(providerTravelMode('google', 'bike')).toMatchObject({
      value: 'driving',
      warning: expect.stringContaining('Bike'),
    });
    expect(providerTravelMode('osm', 'cycle')).toMatchObject({
      value: 'cycle',
      warning: expect.stringContaining('Approx. estimate'),
    });
  });

  it('returns approximate OSM route preview metadata', async () => {
    const provider = createMapsProvider(config({ MAPS_PROVIDER: 'osm' }));
    const preview = await provider.getRoutePreview(
      { placeId: 'a', label: 'Indiranagar', latitude: 12.9784, longitude: 77.6408 },
      { placeId: 'b', label: 'MG Road', latitude: 12.9756, longitude: 77.6067 },
      'walk',
    );

    expect(preview).toMatchObject({
      provider: 'osm',
      providerLabel: 'OpenStreetMap',
      travelMode: 'walk',
      travelModeLabel: 'Walk',
      isApproximate: true,
      confidenceLevel: 'medium',
    });
    expect(preview.distanceMeters).toBeGreaterThan(0);
    expect(preview.durationSeconds).toBeGreaterThan(0);
    expect(preview.previewGeometry.coordinates).toEqual([
      { latitude: 12.9784, longitude: 77.6408 },
      { latitude: 12.9756, longitude: 77.6067 },
    ]);
    expect(preview.warnings.join(' ')).toContain('Approx.');
  });

  it('uses Google Directions and changes mode-specific ETA inputs', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'OK',
        routes: [
          {
            overview_polyline: { points: '' },
            legs: [{ distance: { value: 4000 }, duration: { value: 900, text: '15 mins' } }],
          },
        ],
      }),
    });
    global.fetch = fetchMock as any;

    const provider = createMapsProvider(config({ GOOGLE_MAPS_API_KEY: 'maps-key' }));
    await provider.getRoutePreview(
      { placeId: 'a', label: 'Indiranagar', latitude: 12.9784, longitude: 77.6408 },
      { placeId: 'b', label: 'MG Road', latitude: 12.9756, longitude: 77.6067 },
      'walk',
    );
    await provider.getRoutePreview(
      { placeId: 'a', label: 'Indiranagar', latitude: 12.9784, longitude: 77.6408 },
      { placeId: 'b', label: 'MG Road', latitude: 12.9756, longitude: 77.6067 },
      'cycle',
    );

    expect(fetchMock.mock.calls[0][0]).toContain('mode=walking');
    expect(fetchMock.mock.calls[1][0]).toContain('mode=bicycling');
  });
});
