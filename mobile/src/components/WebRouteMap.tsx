import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface RoutePoint {
  latitude: number;
  longitude: number;
  label?: string;
}

interface RoutePreviewGeometry {
  coordinates: Array<{
    latitude: number;
    longitude: number;
  }>;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface Props {
  preview: {
    startLabel?: string;
    destinationLabel?: string;
    travelModeLabel?: string;
    providerLabel?: string;
    isApproximate?: boolean;
    previewGeometry?: RoutePreviewGeometry | null;
    start?: RoutePoint | null;
    destination?: RoutePoint | null;
    warnings?: string[];
  } | null;
  loading?: boolean;
}

const olaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY?.trim();

function styleUrl(apiKey: string) {
  return `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${encodeURIComponent(apiKey)}`;
}

export default function WebRouteMap({ preview, loading = false }: Props) {
  const { colors } = useTheme();
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const routeGeometry = preview?.previewGeometry;
  const startPoint = preview?.start ?? null;
  const destinationPoint = preview?.destination ?? null;

  const routeTitle = useMemo(() => {
    if (preview?.startLabel && preview?.destinationLabel) {
      return `${preview.startLabel} -> ${preview.destinationLabel}`;
    }
    if (preview?.startLabel) return `Start: ${preview.startLabel}`;
    if (preview?.destinationLabel) return `Destination: ${preview.destinationLabel}`;
    return 'Search a place to preview on map';
  }, [preview?.destinationLabel, preview?.startLabel]);

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    let cancelled = false;

    async function ensureMap() {
      if (!olaMapsApiKey) return;
      const sdk = await import('olamaps-web-sdk');
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        const olaMaps = new sdk.OlaMaps({ apiKey: olaMapsApiKey });
        const map = await olaMaps.init({
          container: containerRef.current,
          style: styleUrl(olaMapsApiKey),
          center: [77.5946, 12.9716],
          zoom: 11,
        });
        mapRef.current = map;
      }

      const map = mapRef.current;
      if (!map) return;

      markersRef.current.forEach((marker) => marker.remove?.());
      markersRef.current = [];

      const sourceId = 'predikt-route-preview';
      const lineLayerId = 'predikt-route-line';
      const pointSourceId = 'predikt-route-points';
      const pointLayerId = 'predikt-route-points-layer';

      if (map.getLayer?.(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getSource?.(sourceId)) map.removeSource(sourceId);
      if (map.getLayer?.(pointLayerId)) map.removeLayer(pointLayerId);
      if (map.getSource?.(pointSourceId)) map.removeSource(pointSourceId);

      const geometryCoordinates = routeGeometry?.coordinates ?? [];
      const fallbackPoints = [startPoint, destinationPoint].filter(
        (point): point is RoutePoint =>
          Boolean(point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)),
      );
      const routePoints =
        geometryCoordinates.length > 0
          ? geometryCoordinates
          : fallbackPoints.map((point) => ({
              latitude: point.latitude,
              longitude: point.longitude,
            }));

      if (routePoints.length === 0) return;

      const lineCoordinates = routePoints.map((point) => [point.longitude, point.latitude]);
      map.addSource?.(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: lineCoordinates,
          },
          properties: {},
        },
      });
      map.addLayer?.({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#7c3aed',
          'line-width': routePoints.length > 2 ? 5 : 4,
          'line-opacity': routePoints.length > 2 ? 0.95 : 0.65,
        },
      });

      const pointFeatures = routePoints.map((point, index) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.longitude, point.latitude],
        },
        properties: {
          color:
            index === 0 && routePoints.length > 1
              ? '#10b981'
              : index === routePoints.length - 1 && routePoints.length > 1
                ? '#f59e0b'
                : '#7c3aed',
        },
      }));

      map.addSource?.(pointSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pointFeatures,
        },
      });
      map.addLayer?.({
        id: pointLayerId,
        type: 'circle',
        source: pointSourceId,
        paint: {
          'circle-radius': 7,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      const bounds = routeGeometry?.bounds;
      if (bounds) {
        map.fitBounds?.(
          [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ],
          { padding: 36 },
        );
      } else if (routePoints.length === 1) {
        map.setCenter?.([routePoints[0].longitude, routePoints[0].latitude]);
        map.setZoom?.(14);
      } else {
        const longitudes = routePoints.map((point) => point.longitude);
        const latitudes = routePoints.map((point) => point.latitude);
        map.fitBounds?.(
          [
            [Math.min(...longitudes), Math.min(...latitudes)],
            [Math.max(...longitudes), Math.max(...latitudes)],
          ],
          { padding: 36 },
        );
      }
    }

    void ensureMap();

    return () => {
      cancelled = true;
    };
  }, [destinationPoint, routeGeometry, startPoint]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((marker) => marker.remove?.());
      markersRef.current = [];
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, []);

  const mapDiv = React.createElement('div', {
    ref: (node: any) => {
      containerRef.current = node;
    },
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      backgroundColor: '#111827',
    },
  });

  return (
    <View style={[styles.frame, { borderColor: colors.border, backgroundColor: colors.surfaceHigh }]}>
      <View style={styles.mapArea}>
        {olaMapsApiKey ? mapDiv : <View style={styles.placeholder} />}
      </View>
      <View style={[styles.overlay, { backgroundColor: 'rgba(15,23,42,0.86)' }]}>
        <View style={styles.overlayTop}>
          <Text style={styles.title}>{routeTitle}</Text>
          {preview?.isApproximate ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Approx.</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.copy}>
          {loading
            ? 'Updating route preview...'
            : `${preview?.travelModeLabel ?? 'Route'} · ${olaMapsApiKey ? 'Ola Maps' : preview?.providerLabel ?? 'OpenStreetMap'} · Ghost Mode stays on.`}
        </Text>
        {!olaMapsApiKey ? (
          <Text style={styles.copyMuted}>
            Add `EXPO_PUBLIC_OLA_MAPS_API_KEY` to enable Ola Maps on web.
          </Text>
        ) : null}
        {preview?.warnings?.[0] ? <Text style={styles.copyMuted}>{preview.warnings[0]}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    minHeight: 220,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  mapArea: {
    minHeight: 220,
    position: 'relative',
  },
  placeholder: {
    flex: 1,
    minHeight: 220,
    backgroundColor: '#111827',
  },
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  overlayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '900',
    flex: 1,
  },
  copy: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12,
    lineHeight: 17,
  },
  copyMuted: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    lineHeight: 16,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
