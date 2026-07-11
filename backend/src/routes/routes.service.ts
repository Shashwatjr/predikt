import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomsService } from '../rooms/rooms.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateRoomFromRouteDto } from './dto/create-room-from-route.dto';
import { RoutePreviewDto } from './dto/route-preview.dto';
import {
  createMapsProvider,
  distanceMetersBetween as providerDistanceMetersBetween,
  normalizeTravelMode,
} from './maps-provider';

function toTitleCase(input: string) {
  return input
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function defaultDelayForCategory(category?: string) {
  if (category === 'travel') return 30;
  if (category === 'public' || category === 'sponsored') return 15;
  return 10;
}

function routeSafetyDelay(body: Pick<RoutePreviewDto, 'roomCategory' | 'visibility'>) {
  const category = body.roomCategory as string | undefined;
  if (category === 'travel') return 30;
  if (body.visibility === 'public') return category === 'travel' ? 30 : 15;
  if (body.visibility === 'private') return 5;
  return defaultDelayForCategory(category);
}

function journeyGracePeriodSeconds(expectedDurationSeconds: number) {
  return Math.max(10 * 60, Math.min(45 * 60, Math.round(expectedDurationSeconds * 0.25)));
}

function syntheticPlaceIdForLocation(location: { latitude: number; longitude: number }) {
  return `current-location:${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;
}

function labelForLocation(location: { label?: string }) {
  return location.label?.trim() || 'Current location';
}

function coordsForPlaceId(placeId: string) {
  let hash = 0;
  for (const char of placeId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return {
    latitude: 12.90 + (hash % 1400) / 10000,
    longitude: 77.50 + (Math.floor(hash / 1400) % 1800) / 10000,
  };
}

function syntheticPlaceIdForSearchResult(location: {
  latitude: number;
  longitude: number;
  label: string;
}) {
  const normalizedLabel = location.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `search-location:${location.latitude.toFixed(5)},${location.longitude.toFixed(
    5,
  )}:${normalizedLabel || 'place'}`;
}

function parseSyntheticSearchPlaceId(placeId: string) {
  const match = /^search-location:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?):(.+)$/.exec(placeId);
  if (!match) return null;

  return {
    latitude: Number(match[1]),
    longitude: Number(match[2]),
    label: toTitleCase(match[3].replace(/-/g, ' ')),
  };
}

interface GoogleAutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

interface GooglePlaceDetailsResult {
  place_id: string;
  name?: string;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: number;
      lng: number;
    };
  };
}

interface GoogleTextSearchResult extends GooglePlaceDetailsResult {
  place_id: string;
}

interface GooglePlacesNewAutocompleteSuggestion {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
}

interface GooglePlacesNewPlaceDetails {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
}

export interface PlaceSuggestionResult {
  placeId: string;
  label: string;
  mainText: string;
  secondaryText: string;
  latitude?: number;
  longitude?: number;
  provider: string;
}

interface NominatimSearchResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  name?: string;
  type?: string;
  class?: string;
  address?: Record<string, string | undefined>;
}

interface RankedPlaceSuggestion {
  placeId: string;
  label: string;
  mainText: string;
  secondaryText: string;
  latitude: number;
  longitude: number;
  provider: string;
  _sortScore: readonly number[];
}

function isRankedPlaceSuggestion(
  suggestion: RankedPlaceSuggestion | null,
): suggestion is RankedPlaceSuggestion {
  return suggestion !== null;
}

const BENGALURU_BIAS_POINT = {
  latitude: 12.9716,
  longitude: 77.5946,
};

function distanceMetersFromBengaluru(latitude: number, longitude: number) {
  return providerDistanceMetersBetween(
    {
      latitude,
      longitude,
    },
    BENGALURU_BIAS_POINT,
  ) ?? Number.MAX_SAFE_INTEGER;
}

function buildNominatimQueries(clean: string) {
  const compact = clean.replace(/\s+/g, ' ').trim();
  const tokens = compact.split(' ').filter(Boolean);
  const trailingTwo = tokens.slice(-2).join(' ');
  const trailingOne = tokens.slice(-1).join(' ');

  return Array.from(
    new Set(
      [
        `${compact}, Bengaluru, Karnataka, India`,
        `${compact}, Bangalore, Karnataka, India`,
        compact,
        trailingTwo ? `${trailingTwo}, Bengaluru, Karnataka, India` : null,
        trailingOne ? `${trailingOne}, Bengaluru, Karnataka, India` : null,
      ].filter(Boolean) as string[],
    ),
  );
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class RoutesService {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly config: ConfigService,
  ) {}

  private get googleMapsApiKey() {
    return this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim();
  }

  private get googlePlacesApiKey() {
    return (
      this.config.get<string>('GOOGLE_PLACES_API_KEY')?.trim() ||
      this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim()
    );
  }

  private get googleDirectionsApiKey() {
    return (
      this.config.get<string>('GOOGLE_DIRECTIONS_API_KEY')?.trim() ||
      this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim()
    );
  }

  private isGoogleConfigured() {
    return Boolean(this.googlePlacesApiKey || this.googleDirectionsApiKey);
  }

  private get olaMapsApiKey() {
    return this.config.get<string>('OLA_MAPS_API_KEY')?.trim();
  }

  mapsConfig() {
    const mapsProvider = createMapsProvider(this.config);
    return {
      placeSearchProvider: this.olaMapsApiKey ? 'ola' : this.googlePlacesApiKey ? 'google' : 'openstreetmap',
      routeProvider: mapsProvider.name,
      routeProviderLabel: mapsProvider.label,
      olaConfigured: Boolean(this.olaMapsApiKey),
      googleConfigured: this.isGoogleConfigured(),
      googlePlacesConfigured: Boolean(this.googlePlacesApiKey),
      googleDirectionsConfigured: Boolean(this.googleDirectionsApiKey),
    };
  }

  async reverseGeocode(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('Latitude and longitude are required.');
    }

    const apiKey = this.googlePlacesApiKey;
    if (apiKey) {
      const params = new URLSearchParams({
        latlng: `${latitude},${longitude}`,
        key: apiKey,
      });
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
      if (response.ok) {
        const data = (await response.json()) as {
          status?: string;
          results?: Array<{
            place_id?: string;
            formatted_address?: string;
          }>;
        };
        if (data.status === 'OK' && data.results?.length) {
          const top = data.results[0];
          return {
            placeId: top.place_id ?? syntheticPlaceIdForLocation({ latitude, longitude }),
            label: top.formatted_address ?? 'Current location',
            latitude,
            longitude,
            provider: 'google',
          };
        }
      }
    }

    const params = new URLSearchParams({
      lat: `${latitude}`,
      lon: `${longitude}`,
      format: 'jsonv2',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'predikt-local-dev/1.0',
      },
    });
    if (response.ok) {
      const data = (await response.json()) as { display_name?: string };
      if (data.display_name?.trim()) {
        return {
          placeId: syntheticPlaceIdForLocation({ latitude, longitude }),
          label: data.display_name.trim(),
          latitude,
          longitude,
          provider: 'openstreetmap',
        };
      }
    }

    return {
      placeId: syntheticPlaceIdForLocation({ latitude, longitude }),
      label: 'Current location',
      latitude,
      longitude,
      provider: 'approximate',
    };
  }

  private async nominatimPlaceSearch(clean: string) {
    const normalizedClean = normalizeSearchText(clean);
    const seen = new Map<string, NominatimSearchResult & { _queryIndex: number }>();
    const queries = buildNominatimQueries(clean).slice(0, 2);

    const batches = await Promise.all(
      queries.map(async (q, index) => {
        const params = new URLSearchParams({
          q,
          format: 'jsonv2',
          addressdetails: '1',
          limit: '6',
          countrycodes: 'in',
        });
        try {
          const response = await fetchWithTimeout(
            `https://nominatim.openstreetmap.org/search?${params}`,
            {
              headers: {
                Accept: 'application/json',
                'User-Agent': 'predikt-local-dev/1.0',
              },
            },
            3500,
          );
          if (!response.ok) return [];
          const data = (await response.json()) as NominatimSearchResult[];
          return data.map((result) => ({ ...result, _queryIndex: index }));
        } catch {
          return [];
        }
      }),
    );

    for (const batch of batches) {
      for (const result of batch) {
        const key = `${result.lat}:${result.lon}:${result.display_name}`;
        if (!seen.has(key)) {
          seen.set(key, result);
        }
      }
    }

    const mappedSuggestions = Array.from(seen.values()).map<RankedPlaceSuggestion | null>((result) => {
        const latitude = Number(result.lat);
        const longitude = Number(result.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        const label = result.display_name?.trim() || result.name?.trim() || clean;
        const mainText =
          result.name?.trim() ||
          label
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)[0] ||
          clean;
        const secondaryText = label.startsWith(mainText)
          ? label.slice(mainText.length).replace(/^,\s*/, '') || 'OpenStreetMap'
          : label;
        const addressText = JSON.stringify(result.address ?? {}).toLowerCase();
        const isBengaluruMatch =
          /bengaluru|bangalore/.test(label.toLowerCase()) || /bengaluru|bangalore/.test(addressText);
        const isKarnatakaMatch = /karnataka/.test(label.toLowerCase()) || /karnataka/.test(addressText);
        const normalizedMainText = normalizeSearchText(mainText);
        const normalizedLabel = normalizeSearchText(label);
        const exactMainTextMatch = normalizedMainText === normalizedClean;
        const exactLabelPrefixMatch = normalizedLabel.startsWith(normalizedClean);
        const resultType = (result.type ?? '').toLowerCase();
        const resultClass = (result.class ?? '').toLowerCase();
        const isLikelyArea =
          ['suburb', 'neighbourhood', 'quarter', 'residential', 'village', 'hamlet'].includes(resultType) ||
          ['place', 'boundary', 'landuse'].includes(resultClass);
        const isLikelyPoi =
          ['amenity', 'office', 'shop', 'building', 'highway'].includes(resultClass) ||
          ['police', 'bus_stop'].includes(resultType);

        return {
          placeId: syntheticPlaceIdForSearchResult({ latitude, longitude, label }),
          label,
          mainText,
          secondaryText,
          latitude,
          longitude,
          provider: 'openstreetmap',
          _sortScore: [
            result._queryIndex,
            exactMainTextMatch ? 0 : 1,
            exactLabelPrefixMatch ? 0 : 1,
            isLikelyArea ? 0 : 1,
            isLikelyPoi ? 1 : 0,
            isBengaluruMatch ? 0 : 1,
            isKarnatakaMatch ? 0 : 1,
            distanceMetersFromBengaluru(latitude, longitude),
          ] as const,
        };
      });

    const rankedSuggestions = mappedSuggestions
      .filter((suggestion): suggestion is RankedPlaceSuggestion => suggestion !== null)
      .sort((a, b) => {
        for (let index = 0; index < a._sortScore.length; index++) {
          if (a._sortScore[index] !== b._sortScore[index]) {
            return a._sortScore[index] - b._sortScore[index];
          }
        }
        return 0;
      });

    const hasExactCleanAreaMatch = rankedSuggestions.some(
      (suggestion) =>
        normalizeSearchText(suggestion.mainText) === normalizedClean &&
        /bengaluru|bangalore/.test(suggestion.label.toLowerCase()),
    );

    if (!hasExactCleanAreaMatch) {
      const bengaluruPoi = rankedSuggestions.find(
        (suggestion) =>
          /bengaluru|bangalore/.test(suggestion.label.toLowerCase()) &&
          normalizeSearchText(suggestion.label).includes(normalizedClean),
      );

      if (bengaluruPoi) {
        rankedSuggestions.unshift({
          placeId: syntheticPlaceIdForSearchResult({
            latitude: bengaluruPoi.latitude,
            longitude: bengaluruPoi.longitude,
            label: `${toTitleCase(clean)}, Bengaluru, Karnataka, India`,
          }),
          label: `${toTitleCase(clean)}, Bengaluru, Karnataka, India`,
          mainText: toTitleCase(clean),
          secondaryText: 'Bengaluru, Karnataka, India',
          latitude: bengaluruPoi.latitude,
          longitude: bengaluruPoi.longitude,
          provider: 'openstreetmap',
          _sortScore: [-1, 0, 0, 0, 0, 0, 0, 0] as const,
        });
      }
    }

    return rankedSuggestions
      .slice(0, 5)
      .map(({ _sortScore, ...suggestion }) => suggestion);
  }

  private async photonPlaceSearch(clean: string) {
    const params = new URLSearchParams({
      q: `${clean} Bengaluru Karnataka`,
      lat: `${BENGALURU_BIAS_POINT.latitude}`,
      lon: `${BENGALURU_BIAS_POINT.longitude}`,
      limit: '6',
    });

    try {
      const response = await fetchWithTimeout(`https://photon.komoot.io/api/?${params}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;

      const data = (await response.json()) as {
        features?: Array<{
          properties?: {
            name?: string;
            city?: string;
            state?: string;
            country?: string;
            street?: string;
            postcode?: string;
          };
          geometry?: {
            coordinates?: [number, number];
          };
        }>;
      };

      const suggestions = (data.features ?? [])
        .map((feature) => {
          const coordinates = feature.geometry?.coordinates;
          if (!coordinates || coordinates.length < 2) return null;

          const longitude = coordinates[0];
          const latitude = coordinates[1];
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

          const props = feature.properties ?? {};
          const mainText = props.name?.trim() || clean;
          const locality = [props.city, props.state, props.country].filter(Boolean).join(', ');
          const label = locality ? `${mainText}, ${locality}` : mainText;

          return {
            placeId: syntheticPlaceIdForSearchResult({ latitude, longitude, label }),
            label,
            mainText,
            secondaryText: locality || 'OpenStreetMap',
            latitude,
            longitude,
            provider: 'openstreetmap',
          };
        })
        .filter((suggestion) => suggestion !== null);

      return suggestions.length ? suggestions.slice(0, 5) : null;
    } catch {
      return null;
    }
  }

  private async googlePlaceDetailsNew(placeId: string): Promise<GooglePlacesNewPlaceDetails | null> {
    const apiKey = this.googlePlacesApiKey;
    if (!apiKey || placeId.startsWith('search-location:') || placeId.startsWith('current-location:')) {
      return null;
    }

    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
      },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as GooglePlacesNewPlaceDetails;
    if (!data.location?.latitude || !data.location?.longitude) return null;
    return data;
  }

  private async googlePlaceDetails(placeId: string): Promise<GooglePlaceDetailsResult | null> {
    const apiKey = this.googlePlacesApiKey;
    if (!apiKey) return null;

    const newDetails = await this.googlePlaceDetailsNew(placeId).catch(() => null);
    if (newDetails?.location?.latitude && newDetails.location.longitude) {
      return {
        place_id: newDetails.id ?? placeId,
        name: newDetails.displayName?.text,
        formatted_address: newDetails.formattedAddress,
        geometry: {
          location: {
            lat: newDetails.location.latitude,
            lng: newDetails.location.longitude,
          },
        },
      };
    }

    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'place_id,name,formatted_address,geometry',
      key: apiKey,
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      status?: string;
      result?: GooglePlaceDetailsResult;
    };
    if (data.status !== 'OK' || !data.result) return null;
    return data.result;
  }

  private mapGooglePlaceSuggestion(
    prediction: {
      placeId: string;
      label: string;
      mainText: string;
      secondaryText: string;
      latitude?: number;
      longitude?: number;
    },
  ): PlaceSuggestionResult {
    return {
      placeId: prediction.placeId,
      label: prediction.label,
      mainText: prediction.mainText,
      secondaryText: prediction.secondaryText,
      latitude: prediction.latitude,
      longitude: prediction.longitude,
      provider: 'google',
    };
  }

  private async googlePlacesAutocompleteNew(clean: string): Promise<PlaceSuggestionResult[] | null> {
    const apiKey = this.googlePlacesApiKey;
    if (!apiKey) return null;

    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify({
        input: clean,
        includedRegionCodes: ['in'],
        locationBias: {
          circle: {
            center: BENGALURU_BIAS_POINT,
            radius: 50000,
          },
        },
      }),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      suggestions?: GooglePlacesNewAutocompleteSuggestion[];
    };
    const predictions = (data.suggestions ?? [])
      .map((suggestion) => suggestion.placePrediction)
      .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction?.placeId))
      .slice(0, 5);
    if (!predictions.length) return null;

    const details = await Promise.all(
      predictions.map((prediction) => this.googlePlaceDetailsNew(prediction.placeId!).catch(() => null)),
    );

    return predictions
      .map((prediction, index) => {
        const detail = details[index];
        const location = detail?.location;
        const mainText =
          prediction.structuredFormat?.mainText?.text ??
          detail?.displayName?.text ??
          prediction.text?.text ??
          clean;
        const secondaryText =
          prediction.structuredFormat?.secondaryText?.text ??
          detail?.formattedAddress ??
          'Google Maps';

        return this.mapGooglePlaceSuggestion({
          placeId: prediction.placeId!,
          label: prediction.text?.text ?? `${mainText}, ${secondaryText}`,
          mainText,
          secondaryText,
          latitude: location?.latitude,
          longitude: location?.longitude,
        });
      })
      .filter((suggestion) => Boolean(suggestion.placeId));
  }

  private async googlePlaceSearchLegacy(clean: string) {
    const apiKey = this.googlePlacesApiKey;
    if (!apiKey) return null;

    const params = new URLSearchParams({
      input: clean,
      components: 'country:in',
      location: '12.9716,77.5946',
      radius: '100000',
      strictbounds: 'false',
      key: apiKey,
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      status?: string;
      predictions?: GoogleAutocompletePrediction[];
    };
    if (!['OK', 'ZERO_RESULTS'].includes(data.status ?? '')) return null;

    const predictions = (data.predictions ?? []).slice(0, 5);
    if (predictions.length === 0) {
      return this.googleTextSearch(clean);
    }

    const details = await Promise.all(
      predictions.map((prediction) => this.googlePlaceDetails(prediction.place_id).catch(() => null)),
    );

    return predictions.map((prediction, index) => {
      const detail = details[index];
      const location = detail?.geometry?.location;
      return {
        placeId: prediction.place_id,
        label: prediction.description,
        mainText:
          prediction.structured_formatting?.main_text ??
          detail?.name ??
          prediction.description,
        secondaryText:
          prediction.structured_formatting?.secondary_text ??
          detail?.formatted_address ??
          'Google Maps',
        latitude: location?.lat,
        longitude: location?.lng,
        provider: 'google',
      };
    });
  }

  private async googleTextSearch(clean: string) {
    const apiKey = this.googlePlacesApiKey;
    if (!apiKey) return null;

    const params = new URLSearchParams({
      query: `${clean} Bengaluru Karnataka India`,
      location: '12.9716,77.5946',
      radius: '100000',
      key: apiKey,
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      status?: string;
      results?: GoogleTextSearchResult[];
    };
    if (!['OK', 'ZERO_RESULTS'].includes(data.status ?? '')) return null;

    return (data.results ?? []).slice(0, 5).map((result) => {
      const location = result.geometry?.location;
      return {
        placeId: result.place_id,
        label: result.formatted_address ?? result.name ?? clean,
        mainText: result.name ?? clean,
        secondaryText: result.formatted_address ?? 'Google Maps',
        latitude: location?.lat,
        longitude: location?.lng,
        provider: 'google',
      };
    });
  }

  private async googlePlaceSearch(clean: string) {
    const newSuggestions = await this.googlePlacesAutocompleteNew(clean).catch(() => null);
    if (newSuggestions?.length) {
      return newSuggestions;
    }
    return this.googlePlaceSearchLegacy(clean);
  }

  async placeSearch(query: string) {
    const clean = query.trim();
    const googleConfigured = Boolean(this.googlePlacesApiKey);
    if (!clean) {
      return { suggestions: [], searchProvider: 'none', googleConfigured };
    }

    if (googleConfigured) {
      const googleSuggestions = await this.googlePlaceSearch(clean).catch(() => null);
      if (googleSuggestions?.length) {
        return { suggestions: googleSuggestions, searchProvider: 'google', googleConfigured: true };
      }
    }

    const photonSuggestions = await this.photonPlaceSearch(clean).catch(() => null);
    if (photonSuggestions?.length) {
      return {
        suggestions: photonSuggestions,
        searchProvider: 'openstreetmap',
        googleConfigured,
      };
    }

    const nominatimSuggestions = await this.nominatimPlaceSearch(clean).catch(() => null);
    if (nominatimSuggestions?.length) {
      return {
        suggestions: nominatimSuggestions,
        searchProvider: 'openstreetmap',
        googleConfigured,
      };
    }

    return {
      suggestions: [],
      searchProvider: googleConfigured ? 'google' : 'openstreetmap',
      googleConfigured,
    };
  }

  async placeDetails(placeId: string) {
    const syntheticSearchPlace = parseSyntheticSearchPlaceId(placeId);
    if (syntheticSearchPlace) {
      return {
        placeId,
        label: syntheticSearchPlace.label,
        latitude: syntheticSearchPlace.latitude,
        longitude: syntheticSearchPlace.longitude,
      };
    }

    const googleDetails = await this.googlePlaceDetails(placeId).catch(() => null);
    const googleLocation = googleDetails?.geometry?.location;
    if (googleDetails && googleLocation) {
      return {
        placeId: googleDetails.place_id,
        label: googleDetails.formatted_address ?? googleDetails.name ?? placeId,
        latitude: googleLocation.lat,
        longitude: googleLocation.lng,
      };
    }

    const coords = coordsForPlaceId(placeId);
    return {
      placeId,
      label: toTitleCase(placeId.replace(/-/g, ' ')),
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
  }

  private async resolveRouteStart(body: Pick<RoutePreviewDto, 'startLocation' | 'startPlaceId'>) {
    if (body.startLocation) {
      return {
        placeId: syntheticPlaceIdForLocation(body.startLocation),
        label: labelForLocation(body.startLocation),
        latitude: body.startLocation.latitude,
        longitude: body.startLocation.longitude,
      };
    }

    if (!body.startPlaceId?.trim()) {
      throw new BadRequestException('Choose a start point or use current location.');
    }

    return this.placeDetails(body.startPlaceId);
  }

  async preview(body: RoutePreviewDto) {
    const start = await this.resolveRouteStart(body);
    const destination = await this.placeDetails(body.destinationPlaceId);
    const routeEstimate = await createMapsProvider(this.config).getRoutePreview(
      start,
      destination,
      body.travelMode,
    );
    const distanceMeters = routeEstimate.distanceMeters;
    const estimatedDurationSeconds = routeEstimate.durationSeconds;
    const defaultSafetyDelayMinutes = routeSafetyDelay(body);
    const suggestedRoomTitle = `Arrival PREDIKT: ${start.label} → ${destination.label}`;
    const suggestedQuestion = `When will I reach ${destination.label}?`;
    const suggestedLockTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return {
      provider: routeEstimate.provider,
      providerLabel: routeEstimate.providerLabel,
      startLabel: start.label,
      destinationLabel: destination.label,
      travelMode: routeEstimate.travelMode,
      travelModeLabel: routeEstimate.travelModeLabel,
      durationSeconds: routeEstimate.durationSeconds,
      etaLabel: routeEstimate.etaLabel,
      confidenceLevel: routeEstimate.confidenceLevel,
      isApproximate: routeEstimate.isApproximate,
      warnings: routeEstimate.warnings,
      // Creator setup preview geometry is not public live tracking.
      previewGeometry: routeEstimate.previewGeometry,
      start: {
        placeId: start.placeId,
        label: start.label,
        latitude: start.latitude,
        longitude: start.longitude,
      },
      destination: {
        placeId: destination.placeId,
        label: destination.label,
        latitude: destination.latitude,
        longitude: destination.longitude,
      },
      distanceMeters,
      distanceLabel: `${(distanceMeters / 1000).toFixed(1)} km`,
      estimatedDurationSeconds,
      estimatedDurationLabel: routeEstimate.etaLabel,
      routeSummary: `${start.label} → ${destination.label}`,
      suggestedRoomTitle,
      suggestedQuestion,
      suggestedLockTime,
      oracleBotPrediction: {
        predictedDurationSeconds: routeEstimate.durationSeconds,
        label: `Oracle Bot benchmark: ${routeEstimate.etaLabel}`,
        source: routeEstimate.providerLabel,
      },
      suggestedPredictionOptions: [
        {
          type: 'arrival_time',
          answerType: 'exact_time',
          title: 'Arrival Time',
          description: 'Friends guess the exact time you will arrive.',
          example: '09:42:30',
          recommended: true,
        },
        {
          type: 'journey_duration',
          answerType: 'duration',
          title: 'Journey Duration',
          description: 'Friends guess how long the journey will take.',
          example: '35 mins',
          recommended: false,
        },
        {
          type: 'beat_eta',
          answerType: 'yes_no',
          title: 'Beat ETA?',
          description: 'Friends choose whether you arrive before the estimated arrival time.',
          example: 'Yes / No',
          recommended: false,
        },
      ],
      suggestedMilestones: [
        {
          milestoneName: `Halfway to ${destination.label}`,
          locationLabel: 'Halfway point',
        },
        {
          milestoneName: destination.label,
          locationLabel: destination.label,
          isFinalDestination: true,
        },
      ],
      privacy: {
        viewerLocationMode: 'approximate_delayed',
        defaultSafetyDelayMinutes,
      },
    };
  }

  async createRoomFromRoute(body: CreateRoomFromRouteDto, user: AuthenticatedUser) {
    const preview = await this.preview(body);
    const predictionCloseTime =
      body.predictionClosesAt ??
      preview.suggestedLockTime ??
      new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const expectedDurationSeconds = preview.durationSeconds ?? preview.estimatedDurationSeconds ?? 60 * 60;
    const gracePeriodSeconds = journeyGracePeriodSeconds(expectedDurationSeconds);
    const journeyScheduledStartAt = body.predictionClosesAt
      ? new Date(body.predictionClosesAt)
      : new Date(Date.now() + 5 * 60 * 1000);
    const noStartCutoffAt = new Date(
      journeyScheduledStartAt.getTime() +
        Math.min(30 * 60 * 1000, Math.max(15 * 60 * 1000, Math.round(gracePeriodSeconds / 2) * 1000)),
    );
    const autoCloseAt = new Date(
      journeyScheduledStartAt.getTime() + (expectedDurationSeconds + gracePeriodSeconds) * 1000,
    );
    const primaryPrediction = body.primaryPrediction ?? {
      type: 'arrival_time',
      answerType: 'exact_time',
      question: preview.suggestedQuestion ?? 'When will I arrive?',
    };
    const travelMode = normalizeTravelMode(body.travelMode);
    return this.roomsService.createFromRoute(
      {
        roomTitle: body.title ?? preview.suggestedRoomTitle,
        eventType: primaryPrediction.type ?? 'journey',
        category: 'arrival_time',
        templateKey: 'arrival_time',
        question: primaryPrediction.question,
        baselineSource: preview.provider,
        baselineLabel: preview.providerLabel,
        baselineValue: expectedDurationSeconds,
        baselineSnapshot: {
          provider: preview.provider,
          providerLabel: preview.providerLabel,
          travelMode: preview.travelMode,
          travelModeLabel: preview.travelModeLabel,
          distanceMeters: preview.distanceMeters,
          durationSeconds: expectedDurationSeconds,
          etaLabel: preview.etaLabel,
          confidenceLevel: preview.confidenceLevel,
          isApproximate: preview.isApproximate,
          previewGeometry: preview.previewGeometry,
          warnings: preview.warnings,
          capturedAt: new Date().toISOString(),
        },
        oracleBotPrediction: preview.oracleBotPrediction,
        roomType: body.roomType ?? 'single_target',
        mode: body.mode ?? 'friends',
        roomCategory: body.roomCategory ?? 'journey',
        answerType: primaryPrediction.answerType ?? 'exact_time',
        journeyStatus: 'scheduled',
        journeyScheduledStartAt: journeyScheduledStartAt.toISOString(),
        expectedDurationSeconds,
        gracePeriodSeconds,
        autoCloseAt: autoCloseAt.toISOString(),
        noStartCutoffAt: noStartCutoffAt.toISOString(),
        startingPointLabel: preview.start.label,
        destinationLabel: preview.destination.label,
        predictionCloseTime,
        startingLat: preview.start.latitude,
        startingLng: preview.start.longitude,
        destinationLat: preview.destination.latitude,
        destinationLng: preview.destination.longitude,
        scoringRule: {
          startDelayMinutes: body.startDelayMinutes ?? 3,
        },
        visibility: body.visibility ?? 'invite_only',
        safetyDelayMinutes: body.safetyDelayMinutes ?? routeSafetyDelay(body),
        locationDisplayMode: 'delayed',
        movementAvatarType: travelMode === 'walk' ? 'walker' : travelMode === 'cycle' || travelMode === 'bike' ? 'bike' : travelMode === 'transit' ? 'train' : 'car',
        milestones: body.milestones?.length ? body.milestones : preview.suggestedMilestones,
        routeMeta: {
          startPlaceId: preview.start.placeId,
          startLabel: preview.start.label,
          startLat: preview.start.latitude,
          startLng: preview.start.longitude,
          destinationPlaceId: body.destinationPlaceId,
          destinationLabel: preview.destination.label,
          destinationLat: preview.destination.latitude,
          destinationLng: preview.destination.longitude,
          travelMode,
          distanceMeters: preview.distanceMeters,
          estimatedDurationSeconds: expectedDurationSeconds,
          routeSummary: `${preview.routeSummary} · ${preview.travelModeLabel} · ${preview.etaLabel} · ${preview.providerLabel}`,
          privacyMode: 'approximate_delayed',
          safetyDelayMinutes: body.safetyDelayMinutes ?? routeSafetyDelay(body),
          previewGeometry: preview.previewGeometry,
          primaryPrediction: {
            ...primaryPrediction,
            startDelayMinutes: body.startDelayMinutes ?? 3,
          },
        },
      },
      user,
    );
  }
}
