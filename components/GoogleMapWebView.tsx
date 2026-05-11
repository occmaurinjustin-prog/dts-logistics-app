import * as Location from 'expo-location';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface Stop {
  id: number;
  latitude: number;
  longitude: number;
  name: string;
  type: 'pickup' | 'delivery';
  address: string;
}

interface GoogleMapWebViewProps {
  stops: Stop[];
  currentLocation?: Location.LocationObject | null;
  isNavigating?: boolean;
}

export default function GoogleMapWebView({
  stops,
  currentLocation,
  isNavigating = false,
}: GoogleMapWebViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Build Google Maps Embed URL
  const buildMapUrl = () => {
    // Default center
    let centerLat = 14.2081;
    let centerLng = 121.1544;

    // Use current location if available
    if (currentLocation) {
      centerLat = currentLocation.coords.latitude;
      centerLng = currentLocation.coords.longitude;
    } else if (stops.length > 0) {
      centerLat = stops[0].latitude;
      centerLng = stops[0].longitude;
    }

    // Build markers
    let markers = '';
    stops.forEach((stop, index) => {
      const color = stop.type === 'pickup' ? 'blue' : 'green';
      const label = index + 1;
      markers += `&markers=color:${color}%7Clabel:${label}%7C${stop.latitude},${stop.longitude}`;
    });

    // Add user location marker
    if (currentLocation) {
      markers += `&markers=color:red%7Clabel:Y%7C${currentLocation.coords.latitude},${currentLocation.coords.longitude}`;
    }

    // If navigating with multiple stops, show directions
    if (isNavigating && stops.length >= 2) {
      const origin = `${stops[0].latitude},${stops[0].longitude}`;
      const destination = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;
      
      // Google Maps embed with directions
      return `https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d100000!2d${centerLng}!3d${centerLat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0!2z${origin}!3m2!1d${stops[0].latitude}!2d${stops[0].longitude}!4m5!1s0!2z${destination}!3m2!1d${stops[stops.length - 1].latitude}!2d${stops[stops.length - 1].longitude}!5e0!3m2!1sen!2sph!4v1704067200000!5m2!1sen!2sph${markers}`;
    }

    // Simple map view
    return `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d100000!2d${centerLng}!3d${centerLat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sph!4v1704067200000!5m2!1sen!2sph${markers}`;
  };

  const mapUrl = buildMapUrl();

  const MapContent = ({ fullscreen = false }: { fullscreen?: boolean }) => (
    <View style={fullscreen ? styles.fullscreenContainer : styles.container}>
      {!fullscreen && (
        <TouchableOpacity 
          style={styles.fullscreenButton}
          onPress={() => setIsFullscreen(true)}
        >
          <Ionicons name="expand" size={24} color="#3B82F6" />
        </TouchableOpacity>
      )}
      <WebView
        originWhitelist={['*']}
        source={{ uri: mapUrl }}
        style={fullscreen ? styles.fullscreenMap : styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        )}
      />
    </View>
  );

  return (
    <>
      <MapContent />
      
      <Modal
        visible={isFullscreen}
        animationType="slide"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setIsFullscreen(false)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Navigation Map</Text>
            <View style={styles.placeholder} />
          </View>
          <MapContent fullscreen />
          {currentLocation && (
            <View style={styles.gpsInfo}>
              <Text style={styles.gpsText}>
                Lat: {currentLocation.coords.latitude.toFixed(6)} | Lng: {currentLocation.coords.longitude.toFixed(6)}
              </Text>
              {currentLocation.coords.speed !== null && currentLocation.coords.speed > 0 && (
                <Text style={styles.gpsSpeed}>
                  Speed: {(currentLocation.coords.speed * 3.6).toFixed(1)} km/h
                </Text>
              )}
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    width: width - 32,
    height: 400,
  },
  fullscreenButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 100,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 36,
  },
  fullscreenContainer: {
    flex: 1,
  },
  fullscreenMap: {
    width: width,
    height: height - 120,
  },
  gpsInfo: {
    backgroundColor: '#1F2937',
    padding: 16,
    alignItems: 'center',
  },
  gpsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  gpsSpeed: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
});
