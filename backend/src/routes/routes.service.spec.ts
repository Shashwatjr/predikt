import { RoutesService } from './routes.service';

const config = {
  get: jest.fn((key: string) => (key === 'MAPS_PROVIDER' ? 'osm' : undefined)),
} as any;

describe('RoutesService route preview', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns provider and travel mode labels without exposing them as public route coordinates', async () => {
    const service = new RoutesService({ createFromRoute: jest.fn() } as any, config);
    const preview = await service.preview({
      startLocation: { latitude: 12.9784, longitude: 77.6408, label: 'Indiranagar' },
      destinationPlaceId: 'search-location:12.97560,77.60670:mg-road',
      travelMode: 'bike',
    } as any);

    expect(preview).toMatchObject({
      provider: 'osm',
      providerLabel: 'OpenStreetMap',
      startLabel: 'Indiranagar',
      destinationLabel: 'Mg Road',
      travelMode: 'bike',
      travelModeLabel: 'Bike estimate',
      isApproximate: true,
    });
    expect(preview.previewGeometry.coordinates).toHaveLength(2);
    expect(preview.previewGeometry.bounds).toMatchObject({
      north: expect.any(Number),
      south: expect.any(Number),
      east: expect.any(Number),
      west: expect.any(Number),
    });
    expect(preview.etaLabel).toContain('min');
    expect(preview.suggestedRoomTitle).toContain('Arrival PREDIKT');
  });

  it('route creation stores expected duration and baseline snapshot', async () => {
    const roomsService = { createFromRoute: jest.fn().mockResolvedValue({ roomId: 'room-1' }) };
    const service = new RoutesService(roomsService as any, config);

    await service.createRoomFromRoute(
      {
        startLocation: { latitude: 12.9784, longitude: 77.6408, label: 'Indiranagar' },
        destinationPlaceId: 'search-location:12.97560,77.60670:mg-road',
        travelMode: 'cycle',
      } as any,
      { userId: 'u1' } as any,
    );

    expect(roomsService.createFromRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedDurationSeconds: expect.any(Number),
        baselineSource: 'osm',
        baselineLabel: 'OpenStreetMap',
        baselineSnapshot: expect.objectContaining({
          travelMode: 'cycle',
          travelModeLabel: 'Cycle',
          isApproximate: true,
          previewGeometry: expect.objectContaining({
            coordinates: expect.any(Array),
            bounds: expect.any(Object),
          }),
        }),
        routeMeta: expect.objectContaining({
          travelMode: 'cycle',
          estimatedDurationSeconds: expect.any(Number),
          previewGeometry: expect.objectContaining({
            coordinates: expect.any(Array),
          }),
        }),
      }),
      expect.objectContaining({ userId: 'u1' }),
    );
  });

  it('uses Google Places autocomplete from GOOGLE_MAPS_API_KEY for place search', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'OK',
          predictions: [
            {
              place_id: 'google-place-1',
              description: 'Indiranagar, Bengaluru, Karnataka, India',
              structured_formatting: {
                main_text: 'Indiranagar',
                secondary_text: 'Bengaluru, Karnataka, India',
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'OK',
          result: {
            place_id: 'google-place-1',
            name: 'Indiranagar',
            formatted_address: 'Indiranagar, Bengaluru, Karnataka, India',
            geometry: { location: { lat: 12.9784, lng: 77.6408 } },
          },
        }),
      });
    global.fetch = fetchMock as any;
    const googleConfig = {
      get: jest.fn((key: string) => (key === 'GOOGLE_MAPS_API_KEY' ? 'maps-key' : undefined)),
    };
    const service = new RoutesService({ createFromRoute: jest.fn() } as any, googleConfig as any);

    const result = await service.placeSearch('Indiranagar');

    expect(fetchMock.mock.calls[0][0]).toContain('places.googleapis.com/v1/places:autocomplete');
    expect(fetchMock.mock.calls[1][0]).toContain('maps.googleapis.com/maps/api/place/autocomplete');
    expect(result.searchProvider).toBe('google');
    expect(result.suggestions[0]).toMatchObject({
      placeId: 'google-place-1',
      mainText: 'Indiranagar',
      provider: 'google',
      latitude: 12.9784,
      longitude: 77.6408,
    });
  });

  it('returns maps config with google flags', () => {
    const googleConfig = {
      get: jest.fn((key: string) => {
        if (key === 'GOOGLE_MAPS_API_KEY') return 'maps-key';
        if (key === 'MAPS_PROVIDER') return 'auto';
        return undefined;
      }),
    };
    const service = new RoutesService({ createFromRoute: jest.fn() } as any, googleConfig as any);

    expect(service.mapsConfig()).toMatchObject({
      placeSearchProvider: 'google',
      routeProvider: 'google',
      googleConfigured: true,
      googlePlacesConfigured: true,
      googleDirectionsConfigured: true,
    });
  });
});
