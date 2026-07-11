import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  startLocation: { latitude: number; longitude: number; label: string } | null;
  destinationLocation: { latitude: number; longitude: number; label: string } | null;
  title: string;
  copy: string;
}

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

function coordinateParam(point: { latitude: number; longitude: number }) {
  return `${point.latitude},${point.longitude}`;
}

export default function JourneyMapPreview({
  region,
  startLocation,
  destinationLocation,
  title,
  copy,
}: Props) {
  const [zoom, setZoom] = useState(13);
  const mapSrc = useMemo(() => {
    if (googleMapsApiKey && startLocation && destinationLocation) {
      return `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(
        googleMapsApiKey,
      )}&origin=${encodeURIComponent(coordinateParam(startLocation))}&destination=${encodeURIComponent(
        coordinateParam(destinationLocation),
      )}&mode=driving&zoom=${zoom}`;
    }

    if (googleMapsApiKey && (startLocation || destinationLocation)) {
      const point = startLocation ?? destinationLocation;
      return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(
        googleMapsApiKey,
      )}&q=${encodeURIComponent(coordinateParam(point!))}&zoom=${zoom}`;
    }

    if (startLocation && destinationLocation) {
      return `https://maps.google.com/maps?saddr=${encodeURIComponent(
        coordinateParam(startLocation),
      )}&daddr=${encodeURIComponent(coordinateParam(destinationLocation))}&z=${zoom}&output=embed`;
    }

    const point = startLocation ?? destinationLocation ?? region;
    return `https://maps.google.com/maps?q=${encodeURIComponent(
      `${point.latitude},${point.longitude}`,
    )}&z=${zoom}&output=embed`;
  }, [destinationLocation, region, startLocation, zoom]);

  const iframe = React.createElement('iframe' as any, {
    title: 'Journey Google Map',
    src: mapSrc,
    style: {
      border: 0,
      height: '100%',
      left: 0,
      position: 'absolute',
      top: 0,
      width: '100%',
    },
    loading: 'lazy',
    allowFullScreen: true,
    referrerPolicy: 'no-referrer-when-downgrade',
  });

  return (
    <View style={styles.mapFrame}>
      <View style={styles.googleMapFrame}>{iframe}</View>
      <View style={styles.zoomControls}>
        <Pressable style={styles.zoomButton} onPress={() => setZoom((current) => Math.min(20, current + 1))}>
          <Text style={styles.zoomText}>+</Text>
        </Pressable>
        <Pressable style={styles.zoomButton} onPress={() => setZoom((current) => Math.max(3, current - 1))}>
          <Text style={styles.zoomText}>−</Text>
        </Pressable>
      </View>
      <View style={styles.mapOverlay}>
        {title ? <Text style={styles.mapOverlayTitle}>{title}</Text> : null}
        <Text style={styles.mapOverlayCopy}>{copy}</Text>
        <Text style={styles.apiHint}>
          {googleMapsApiKey ? 'Google Maps Embed API' : 'Google Maps preview'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapFrame: {
    minHeight: 280,
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
  },
  googleMapFrame: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  zoomControls: {
    position: 'absolute',
    right: 10,
    top: 10,
    gap: 6,
  },
  zoomButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  mapOverlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(15,23,42,0.84)',
  },
  mapOverlayTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  mapOverlayCopy: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  apiHint: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
});
