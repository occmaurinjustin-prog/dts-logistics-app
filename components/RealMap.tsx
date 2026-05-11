import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const { width, height } = Dimensions.get('window');

interface Stop {
  id: number;
  latitude: number;
  longitude: number;
  name: string;
  type: 'pickup' | 'delivery';
  address: string;
}

interface RealMapProps {
  stops: Stop[];
  currentLocation?: Location.LocationObject | null;
  currentStopIndex?: number;
  isNavigating?: boolean;
}

export default function RealMap({
  stops,
  currentLocation,
  currentStopIndex = 0,
  isNavigating = false,
}: RealMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [mapUrl, setMapUrl] = useState('');

  // Build Google Maps URL with all markers
  useEffect(() => {
    const buildMapUrl = () => {
      if (stops.length === 0) {
        // Default map centered on San Pedro Laguna
        return 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15444.7!2d121.1544!3d14.2081!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTTCsDEyJzI5LjIiTiAxMjHCsDA5JzE1LjgiRQ!5e0!3m2!1sen!2sph!4v1704067200000!5m2!1sen!2sph';
      }

      // Calculate center
      const allLats = stops.map(s => s.latitude);
      const allLngs = stops.map(s => s.longitude);
      const centerLat = (Math.max(...allLats) + Math.min(...allLats)) / 2;
      const centerLng = (Math.max(...allLngs) + Math.min(...allLngs)) / 2;

      // Build markers string
      let markers = '';
      stops.forEach((stop, index) => {
        const color = stop.type === 'pickup' ? 'blue' : 'green';
        const label = index + 1;
        markers += `&markers=color:${color}%7Clabel:${label}%7C${stop.latitude},${stop.longitude}`;
      });

      // Add current location marker if available
      if (currentLocation) {
        const { latitude, longitude } = currentLocation.coords;
        markers += `&markers=color:red%7Clabel:Y%7C${latitude},${longitude}`;
      }

      // Build directions if we have multiple stops
      if (stops.length >= 2) {
        const origin = `${stops[0].latitude},${stops[0].longitude}`;
        const destination = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;
        
        // Create embed URL with directions
        return `https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d15444.7!2d${centerLng}!3d${centerLat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0!2z${origin}!3m2!1d${stops[0].latitude}!2d${stops[0].longitude}!4m5!1s0!2z${destination}!3m2!1d${stops[stops.length - 1].latitude}!2d${stops[stops.length - 1].longitude}!5e0!3m2!1sen!2sph!4v1704067200000!5m2!1sen!2sph${markers}`;
      }

      // Simple map with markers
      return `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d15444.7!2d${centerLng}!3d${centerLat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sph!4v1704067200000!5m2!1sen!2sph${markers}`;
    };

    setMapUrl(buildMapUrl());
  }, [stops, currentLocation]);

  // Update map when location changes (reload WebView)
  useEffect(() => {
    if (isNavigating && currentLocation && webViewRef.current && mapUrl) {
      // Reload to update current position marker
      webViewRef.current.reload();
    }
  }, [currentLocation?.coords.latitude, currentLocation?.coords.longitude, isNavigating]);

  if (!mapUrl) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: mapUrl }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        )}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  map: {
    width: width - 32,
    height: 400,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
});
