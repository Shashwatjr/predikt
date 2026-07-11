import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';

interface Props {
  region: Region;
  startLocation: { latitude: number; longitude: number; label: string } | null;
  destinationLocation: { latitude: number; longitude: number; label: string } | null;
  title: string;
  copy: string;
}

export default function JourneyMapPreview({ region, startLocation, destinationLocation, title, copy }: Props) {
  const [visibleRegion, setVisibleRegion] = useState(region);

  useEffect(() => {
    setVisibleRegion(region);
  }, [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta]);

  const routeCoordinates =
    startLocation && destinationLocation
      ? [
          { latitude: startLocation.latitude, longitude: startLocation.longitude },
          { latitude: destinationLocation.latitude, longitude: destinationLocation.longitude },
        ]
      : [];

  return (
    <View style={styles.mapFrame}>
      <MapView
        style={styles.map}
        region={visibleRegion}
        onRegionChangeComplete={setVisibleRegion}
        showsUserLocation={!!startLocation}
        showsMyLocationButton
        zoomEnabled
        scrollEnabled
        pitchEnabled={false}
      >
        {routeCoordinates.length === 2 ? (
          <Polyline coordinates={routeCoordinates} strokeColor="#7c3aed" strokeWidth={4} />
        ) : null}
        {startLocation ? (
          <Marker
            coordinate={{
              latitude: startLocation.latitude,
              longitude: startLocation.longitude,
            }}
            title="Start"
            description={startLocation.label}
          />
        ) : null}
        {destinationLocation ? (
          <Marker
            coordinate={{
              latitude: destinationLocation.latitude,
              longitude: destinationLocation.longitude,
            }}
            title="Destination"
            description={destinationLocation.label}
            pinColor="#7c3aed"
          />
        ) : null}
      </MapView>
      <View style={styles.mapOverlay}>
        {title ? <Text style={styles.mapOverlayTitle}>{title}</Text> : null}
        <Text style={styles.mapOverlayCopy}>{copy}</Text>
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
  map: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
});
