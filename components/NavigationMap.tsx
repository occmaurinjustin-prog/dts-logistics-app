import * as Location from 'expo-location';
import React, { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

interface Stop {
  id: number;
  latitude: number;
  longitude: number;
  name: string;
  type: 'pickup' | 'delivery';
  address: string;
}

interface NavigationMapProps {
  stops: Stop[];
  currentLocation?: Location.LocationObject | null;
  currentStopIndex?: number;
  isNavigating?: boolean;
}

// Default region (San Pedro, Laguna area)
const DEFAULT_REGION = {
  latitude: 14.2081,
  longitude: 121.1544,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function NavigationMap({
  stops,
  currentLocation,
  currentStopIndex = 0,
  isNavigating = false,
}: NavigationMapProps) {
  const mapRef = useRef<MapView>(null);

  // Follow user's location during navigation
  useEffect(() => {
    if (isNavigating && currentLocation && mapRef.current) {
      const { latitude, longitude } = currentLocation.coords;
      mapRef.current.animateCamera({
        center: { latitude, longitude },
        zoom: 18,
        pitch: 60,
        heading: currentLocation.coords.heading || 0,
      }, { duration: 1000 });
    }
  }, [currentLocation, isNavigating]);

  // Fit to all stops when not navigating
  useEffect(() => {
    if (!isNavigating && stops.length > 0 && mapRef.current) {
      const coordinates = stops.map(s => ({
        latitude: s.latitude,
        longitude: s.longitude,
      }));
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [stops, isNavigating]);

  // Create route line coordinates
  const routeCoordinates = stops.map(s => ({
    latitude: s.latitude,
    longitude: s.longitude,
  }));

  // Get current location coordinate
  const userLocation = currentLocation ? {
    latitude: currentLocation.coords.latitude,
    longitude: currentLocation.coords.longitude,
  } : null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={true}
        showsMyLocationButton={true}
        followsUserLocation={isNavigating}
        showsCompass={true}
        showsTraffic={true}
        mapType="standard"
      >
        {/* Route Line */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#3B82F6"
            strokeWidth={5}
            lineDashPattern={[0]}
          />
        )}

        {/* Stop Markers */}
        {stops.map((stop, index) => (
          <Marker
            key={stop.id}
            coordinate={{
              latitude: stop.latitude,
              longitude: stop.longitude,
            }}
            title={stop.name}
            description={stop.address}
            pinColor={stop.type === 'pickup' ? '#3B82F6' : '#10B981'}
          />
        ))}

        {/* User Location Marker (if available) */}
        {userLocation && !isNavigating && (
          <Marker
            coordinate={userLocation}
            title="Your Location"
            pinColor="#EF4444"
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: width - 32,
    height: 350,
    borderRadius: 20,
  },
});
