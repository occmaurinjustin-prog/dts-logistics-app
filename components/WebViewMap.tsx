import * as Location from 'expo-location';
import React, { useMemo, useState } from 'react';
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

interface WebViewMapProps {
  stops: Stop[];
  currentLocation?: Location.LocationObject | null;
  isNavigating?: boolean;
}

export default function WebViewMap({
  stops,
  currentLocation,
  isNavigating = false,
}: WebViewMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Generate map HTML with iframe
  const mapHtml = useMemo(() => {
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

    // Build Google Maps URL with markers
    let mapUrl = `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d100000!2d${centerLng}!3d${centerLat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sph!4v1704067200000!5m2!1sen!2sph`;
    
    // Add markers for stops
    stops.forEach((stop, index) => {
      const color = stop.type === 'pickup' ? 'blue' : 'green';
      mapUrl += `&markers=color:${color}%7Clabel:${index + 1}%7C${stop.latitude},${stop.longitude}`;
    });

    // Add user location marker
    if (currentLocation) {
      mapUrl += `&markers=color:red%7Clabel:Y%7C${currentLocation.coords.latitude},${currentLocation.coords.longitude}`;
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Navigation Map</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; overflow: hidden; background: #f0f0f0; }
    .map-container { width: 100%; height: 100%; position: relative; }
    iframe { 
      width: 100%; 
      height: 100%; 
      border: none;
      display: block;
    }
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: Arial, sans-serif;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="map-container">
    <iframe 
      src="${mapUrl}" 
      allowfullscreen="true" 
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
    ></iframe>
  </div>
</body>
</html>
    `;
  }, [stops, currentLocation]);

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
        source={{ html: mapHtml }}
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
