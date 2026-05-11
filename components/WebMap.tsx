import * as Location from 'expo-location';
import React, { useEffect, useRef } from 'react';
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

interface WebMapProps {
  stops: Stop[];
  currentLocation?: Location.LocationObject | null;
  currentStopIndex?: number;
  isNavigating?: boolean;
}

export default function WebMap({
  stops,
  currentLocation,
  currentStopIndex = 0,
  isNavigating = false,
}: WebMapProps) {
  const webViewRef = useRef<WebView>(null);

  // Generate Google Maps URL with markers
  const generateMapUrl = () => {
    if (stops.length === 0) {
      // Default view - San Pedro Laguna
      return 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d15447.748257463758!2d121.1544!3d14.2081!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sph!4v1704067200000!5m2!1sen!2sph';
    }

    // Build directions URL with all stops
    const origin = stops[0];
    const destination = stops[stops.length - 1];
    const waypoints = stops.slice(1, -1).map(s => `${s.latitude},${s.longitude}`).join('|');
    
    // For embedded view, use a simpler approach
    const markers = stops.map((s, i) => 
      `&markers=color:${s.type === 'pickup' ? 'blue' : 'green'}%7Clabel:${i + 1}%7C${s.latitude},${s.longitude}`
    ).join('');

    // Fit bounds to show all markers
    const allLats = stops.map(s => s.latitude);
    const allLngs = stops.map(s => s.longitude);
    const centerLat = (Math.max(...allLats) + Math.min(...allLats)) / 2;
    const centerLng = (Math.max(...allLngs) + Math.min(...allLngs)) / 2;
    
    return `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d15!2d${centerLng}!3d${centerLat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sph!4v1704067200000!5m2!1sen!2sph${markers}`;
  };

  // Generate OpenStreetMap URL as fallback (no API key needed)
  const generateOSMUrl = () => {
    if (stops.length === 0) {
      return 'https://www.openstreetmap.org/export/embed.html?bbox=121.1044%2C14.1581%2C121.2044%2C14.2581&layer=mapnik';
    }

    const allLats = stops.map(s => s.latitude);
    const allLngs = stops.map(s => s.longitude);
    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);
    
    // Add padding
    const padding = 0.02;
    const bbox = `${minLng - padding}%2C${minLat - padding}%2C${maxLng + padding}%2C${maxLat + padding}`;
    
    // Add markers
    const markers = stops.map((s, i) => 
      `&marker=${s.latitude}%2C${s.longitude}`
    ).join('');
    
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${markers}`;
  };

  const mapUrl = generateOSMUrl();

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
    height: 350,
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
