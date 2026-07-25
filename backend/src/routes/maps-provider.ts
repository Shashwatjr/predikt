import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const mapsLogger = new Logger('MapsProvider');

/**
 * Fetch with an abort timeout and one automatic retry on a transient failure
 * (network error or timeout). Google/OSRM route lookups are the only outbound
 * calls on the room-creation hot path, so a single retry smooths over a blip
 * before we fall back to a less accurate provider.
 */
async function fetchWithRetry(
  url: string,
  { timeoutMs = 6000, retries = 1 }: { timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        mapsLogger.warn(`Route fetch attempt ${attempt + 1} failed (${String(error)}); retrying once.`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export type PrediktTravelMode = 'car' | 'bike' | 'walk' | 'cycle' | 'transit';
export type MapsProviderName = 'google' | 'bing' | 'azure' | 'osm';

export interface PlacePoint {
  placeId: string;
  label: string;
  latitude: number;
  longitude: number;
}

export interface RoutePreviewResult {
  provider: MapsProviderName;
  providerLabel: string;
  travelMode: PrediktTravelMode;
  travelModeLabel: string;
  distanceMeters: number;
  durationSeconds: number;
  etaLabel: string;
  confidenceLevel: 'low' | 'medium' | 'high';
  isApproximate: boolean;
  warnings: string[];
  previewGeometry: {
    coordinates: Array<{
      latitude: number;
      longitude: number;
    }>;
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
  };
}

export interface MapsProvider {
  readonly name: MapsProviderName;
  readonly label: string;
  getRoutePreview(
    start: PlacePoint,
    destination: PlacePoint,
    travelMode: string | undefined,
  ): Promise<RoutePreviewResult>;
}

interface GoogleRouteOptions {
  mapsApiKey?: string;
  placesApiKey?: string;
  directionsApiKey?: string;
}

const MODE_LABELS: Record<PrediktTravelMode, string> = {
  car: 'Car',
  bike: 'Bike estimate',
  walk: 'Walk',
  cycle: 'Cycle',
  transit: 'Transit',
};

const MODE_SPEED_METERS_PER_SECOND: Record<PrediktTravelMode, number> = {
  car: 9,
  bike: 8,
  walk: 1.4,
  cycle: 4.5,
  transit: 7,
};

function buildBounds(coordinates: Array<{ latitude: number; longitude: number }>) {
  const lats = coordinates.map((point) => point.latitude);
  const lngs = coordinates.map((point) => point.longitude);
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
}

function buildApproximateGeometry(start: PlacePoint, destination: PlacePoint) {
  const coordinates = [
    { latitude: start.latitude, longitude: start.longitude },
    { latitude: destination.latitude, longitude: destination.longitude },
  ];
  return {
    coordinates,
    bounds: buildBounds(coordinates),
  };
}

export function normalizeTravelMode(mode?: string): PrediktTravelMode {
  switch (mode) {
    case 'driving':
    case 'car':
      return 'car';
    case 'two_wheeler':
    case 'bike':
      return 'bike';
    case 'walking':
    case 'walk':
      return 'walk';
    case 'bicycling':
    case 'cycling':
    case 'cycle':
      return 'cycle';
    case 'transit':
      return 'transit';
    default:
      return 'car';
  }
}

export function providerTravelMode(provider: MapsProviderName, mode: PrediktTravelMode) {
  if (provider === 'google') {
    if (mode === 'bike') return { value: 'driving', warning: 'Bike uses a car-style estimate here.' };
    if (mode === 'walk') return { value: 'walking' };
    if (mode === 'cycle') return { value: 'bicycling' };
    return { value: mode === 'car' ? 'driving' : mode };
  }
  if (provider === 'bing' || provider === 'azure') {
    if (mode === 'bike' || mode === 'cycle') {
      return { value: 'driving', warning: `${MODE_LABELS[mode]} is approximate with this maps provider.` };
    }
    return { value: mode === 'walk' ? 'walking' : mode === 'car' ? 'driving' : mode };
  }
  return { value: mode, warning: 'Approx. estimate from distance and travel mode speed.' };
}

export function distanceMetersBetween(
  start: { latitude: number | null; longitude: number | null },
  destination: { latitude: number | null; longitude: number | null },
) {
  if (
    start.latitude === null ||
    start.longitude === null ||
    destination.latitude === null ||
    destination.longitude === null
  ) {
    return null;
  }

  const earthRadiusMeters = 6371_000;
  const lat1 = (start.latitude * Math.PI) / 180;
  const lat2 = (destination.latitude * Math.PI) / 180;
  const deltaLat = ((destination.latitude - start.latitude) * Math.PI) / 180;
  const deltaLng = ((destination.longitude - start.longitude) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

class ApproximateMapsProvider implements MapsProvider {
  constructor(
    readonly name: MapsProviderName,
    readonly label: string,
    private readonly approximateByDefault: boolean,
  ) {}

  async getRoutePreview(
    start: PlacePoint,
    destination: PlacePoint,
    travelModeInput: string | undefined,
  ): Promise<RoutePreviewResult> {
    const travelMode = normalizeTravelMode(travelModeInput);
    const mapped = providerTravelMode(this.name, travelMode);
    const directDistance = distanceMetersBetween(start, destination);
    const distanceMeters =
      directDistance ?? Math.max(3000, (start.label.length + destination.label.length) * 850);
    const speed = MODE_SPEED_METERS_PER_SECOND[travelMode];
    const durationSeconds = Math.max(5 * 60, Math.round((distanceMeters * 1.25) / speed));
    const warnings = [mapped.warning].filter(Boolean) as string[];
    if (this.approximateByDefault && !warnings.length) {
      warnings.push('Approx. estimate from distance and travel mode speed.');
    }

    return {
      provider: this.name,
      providerLabel: this.label,
      travelMode,
      travelModeLabel: MODE_LABELS[travelMode],
      distanceMeters,
      durationSeconds,
      etaLabel: `${Math.round(durationSeconds / 60)} min`,
      confidenceLevel: this.approximateByDefault ? 'medium' : 'high',
      isApproximate: this.approximateByDefault || warnings.length > 0,
      warnings,
      previewGeometry: buildApproximateGeometry(start, destination),
    };
  }
}

function decodeGooglePolyline(encoded: string) {
  const coordinates: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }

  return coordinates;
}

class GoogleMapsProvider implements MapsProvider {
  readonly name = 'google' as const;
  readonly label = 'Google Maps';

  constructor(private readonly options: GoogleRouteOptions) {}

  async getRoutePreview(
    start: PlacePoint,
    destination: PlacePoint,
    travelModeInput: string | undefined,
  ): Promise<RoutePreviewResult> {
    const apiKey = this.options.directionsApiKey || this.options.mapsApiKey || this.options.placesApiKey;
    if (!apiKey) {
      // No key configured — this provider cannot serve; let the chain fall through.
      throw new Error('Google Directions skipped: no API key configured.');
    }

    const travelMode = normalizeTravelMode(travelModeInput);
    const mapped = providerTravelMode('google', travelMode);
    const params = new URLSearchParams({
      origin: `${start.latitude},${start.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      mode: mapped.value,
      key: apiKey,
    });

    // fetchWithRetry gives one automatic retry on a network/timeout blip before we
    // surface the failure and let the chain fall back to a lower-accuracy provider.
    const response = await fetchWithRetry(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
    if (!response.ok) {
      throw new Error(`Google Directions HTTP ${response.status}.`);
    }

    const data = (await response.json()) as {
      status?: string;
      error_message?: string;
      routes?: Array<{
        overview_polyline?: { points?: string };
        bounds?: {
          northeast?: { lat: number; lng: number };
          southwest?: { lat: number; lng: number };
        };
        legs?: Array<{
          distance?: { value?: number };
          duration?: { value?: number; text?: string };
        }>;
      }>;
    };

    if (data.status !== 'OK' || !data.routes?.length || !data.routes[0].legs?.length) {
      // Surface the REAL reason (status + error_message). This is what makes a
      // referer-restricted key ("REQUEST_DENIED: API keys with referer restrictions
      // cannot be used with this API") visible in logs instead of a silent fake ETA.
      const detail = data.error_message ? ` — ${data.error_message}` : '';
      throw new Error(`Google Directions returned ${data.status ?? 'UNKNOWN'}${detail}.`);
    }

    const route = data.routes[0];
    const leg = route.legs?.[0];
    if (!leg) {
      throw new Error('Google Directions returned no route leg.');
    }
    const encodedPolyline = route.overview_polyline?.points ?? '';
    const coordinates = encodedPolyline ? decodeGooglePolyline(encodedPolyline) : buildApproximateGeometry(start, destination).coordinates;
    const warnings = [mapped.warning].filter(Boolean) as string[];

    return {
      provider: 'google',
      providerLabel: 'Google Maps',
      travelMode,
      travelModeLabel: MODE_LABELS[travelMode],
      distanceMeters: Math.max(1, Math.round(leg.distance?.value ?? 0)),
      durationSeconds: Math.max(5 * 60, Math.round(leg.duration?.value ?? 0)),
      etaLabel: leg.duration?.text ?? `${Math.round((leg.duration?.value ?? 0) / 60)} min`,
      confidenceLevel: warnings.length ? 'medium' : 'high',
      isApproximate: warnings.length > 0,
      warnings,
      previewGeometry: {
        coordinates,
        bounds:
          route.bounds?.northeast && route.bounds?.southwest
            ? {
                north: route.bounds.northeast.lat,
                south: route.bounds.southwest.lat,
                east: route.bounds.northeast.lng,
                west: route.bounds.southwest.lng,
              }
            : buildBounds(coordinates),
      },
    };
  }
}

class OsrmMapsProvider implements MapsProvider {
  readonly name = 'osm' as const;
  readonly label = 'OpenStreetMap estimate';

  constructor(private readonly baseUrl: string) {}

  async getRoutePreview(
    start: PlacePoint,
    destination: PlacePoint,
    travelModeInput: string | undefined,
  ): Promise<RoutePreviewResult> {
    const travelMode = normalizeTravelMode(travelModeInput);
    const profile = travelMode === 'walk' ? 'foot' : travelMode === 'cycle' ? 'bike' : 'driving';
    const warnings: string[] = [];

    if (travelMode === 'bike' || travelMode === 'transit') {
      warnings.push(
        travelMode === 'bike'
          ? 'Bike estimate uses driving geometry for this provider.'
          : 'Transit estimate uses driving geometry for this provider.',
      );
    }

    const url = `${this.baseUrl.replace(/\/+$/, '')}/route/v1/${profile}/${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      throw new Error(`OSRM returned HTTP ${response.status}.`);
    }
    const data = (await response.json()) as {
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: number[][] };
      }>;
    };
    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates?.length) {
      throw new Error('OSRM returned no route geometry.');
    }

    const coordinates = route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    }));

    return {
      provider: 'osm',
      providerLabel: 'OpenStreetMap route',
      travelMode,
      travelModeLabel: MODE_LABELS[travelMode],
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.max(5 * 60, Math.round(route.duration)),
      etaLabel: `${Math.round(route.duration / 60)} min`,
      confidenceLevel: 'high',
      isApproximate: warnings.length > 0,
      warnings,
      previewGeometry: {
        coordinates,
        bounds: buildBounds(coordinates),
      },
    };
  }
}

/**
 * Ordered provider chain: try the primary (Google when a key is present), then each
 * fallback in turn. The first provider that returns wins; every fall-through is logged
 * with the real reason so a broken primary (e.g. a referer-restricted key) is visible
 * in Cloud Run rather than hiding behind a silently-degraded estimate. The final entry
 * is always the approximate estimate, which never throws, so a preview is guaranteed.
 */
class RouteProviderChain implements MapsProvider {
  readonly name: MapsProviderName;
  readonly label: string;

  constructor(private readonly providers: MapsProvider[]) {
    if (!providers.length) {
      throw new Error('RouteProviderChain requires at least one provider.');
    }
    this.name = providers[0].name;
    this.label = providers[0].label;
  }

  async getRoutePreview(
    start: PlacePoint,
    destination: PlacePoint,
    travelModeInput: string | undefined,
  ): Promise<RoutePreviewResult> {
    let lastError: unknown;
    for (let index = 0; index < this.providers.length; index++) {
      const provider = this.providers[index];
      const isLastResort = index === this.providers.length - 1;
      try {
        const result = await provider.getRoutePreview(start, destination, travelModeInput);
        if (index === 0) {
          mapsLogger.log(`Route ETA via ${result.provider} (${result.providerLabel}): ${result.etaLabel}.`);
        } else {
          mapsLogger.warn(
            `Route ETA fell back to ${result.provider} (${result.providerLabel}): ${result.etaLabel}.` +
              (isLastResort ? ' This is the last-resort estimate.' : ''),
          );
        }
        return result;
      } catch (error) {
        lastError = error;
        mapsLogger.warn(`Route provider "${provider.name}" failed: ${String((error as Error)?.message ?? error)}`);
      }
    }
    // Unreachable in practice: the chain always ends with a non-throwing approximate
    // provider. Guard anyway so a misconfigured chain fails loudly rather than silently.
    throw lastError instanceof Error ? lastError : new Error('All route providers failed.');
  }
}

export function createMapsProvider(config: ConfigService): MapsProvider {
  const preference = (config.get<string>('MAPS_PROVIDER') ?? 'auto').toLowerCase();
  const hasGoogle = Boolean(config.get<string>('GOOGLE_MAPS_API_KEY')?.trim());
  const hasGooglePlaces = Boolean(config.get<string>('GOOGLE_PLACES_API_KEY')?.trim());
  const hasGoogleDirections = Boolean(config.get<string>('GOOGLE_DIRECTIONS_API_KEY')?.trim());
  const hasBing = Boolean(config.get<string>('BING_MAPS_API_KEY')?.trim());
  const hasAzure = Boolean(config.get<string>('AZURE_MAPS_KEY')?.trim());
  const osrmBaseUrl = config.get<string>('OSRM_BASE_URL')?.trim();
  const googleAvailable = hasGoogle || hasGoogleDirections || hasGooglePlaces;

  // Build an ordered chain. Google (when a key is available) is always the primary for
  // route ETA; OSM/OSRM and the approximate estimate only serve when Google is
  // unavailable or fails. The chain logs each fall-through with the real reason.
  const providers: MapsProvider[] = [];

  if ((preference === 'google' || preference === 'auto') && googleAvailable) {
    providers.push(
      new GoogleMapsProvider({
        mapsApiKey: config.get<string>('GOOGLE_MAPS_API_KEY')?.trim(),
        placesApiKey: config.get<string>('GOOGLE_PLACES_API_KEY')?.trim(),
        directionsApiKey: config.get<string>('GOOGLE_DIRECTIONS_API_KEY')?.trim(),
      }),
    );
  }
  if (preference === 'bing' && hasBing) {
    providers.push(new ApproximateMapsProvider('bing', 'Bing Maps', true));
  }
  if (preference === 'azure' && hasAzure) {
    providers.push(new ApproximateMapsProvider('azure', 'Azure Maps', true));
  }
  // OSM (real road routing) is the last-resort fallback before a straight-line guess —
  // only when an OSRM endpoint is configured. Kept out of the primary slot on purpose.
  if (preference !== 'approximate' && osrmBaseUrl) {
    providers.push(new OsrmMapsProvider(osrmBaseUrl));
  }
  // Terminal, never-throws provider so a route preview is always produced.
  providers.push(new ApproximateMapsProvider('osm', 'OpenStreetMap', true));

  return new RouteProviderChain(providers);
}
