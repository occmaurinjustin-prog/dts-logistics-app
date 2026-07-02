import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  TextInput, Alert, Platform, ActivityIndicator, Image, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import rescueService, { RescueRequest } from '@/services/rescueService';
import driverService from '@/services/driverService';

export default function RescueScreen() {
  const [activeRequest, setActiveRequest] = useState<RescueRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Current Location
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [address, setAddress] = useState('Fetching current address...');

  // Form Fields
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [isDrivable, setIsDrivable] = useState(true);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  const categoriesList = ['Engine', 'Electrical', 'Tires', 'Fuel', 'Brakes', 'Transmission', 'Accident', 'Other'];

  useEffect(() => {
    loadActiveRequest();
    requestLocationPermission();
  }, []);

  // Poll active request status every 10 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeRequest && activeRequest.status !== 'closed') {
      interval = setInterval(() => {
        refreshActiveRequest();
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [activeRequest]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAddress('Location permission denied.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(loc);
      reverseGeocode(loc.coords.latitude, loc.coords.longitude);
    } catch (error) {
      console.error('Error getting location:', error);
      setAddress('Failed to capture location coordinates.');
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: {
          'User-Agent': 'DTS-Logistics-DriverApp'
        }
      });
      const data = await response.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      } else {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } catch (error) {
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  };

  const loadActiveRequest = async () => {
    setLoading(true);
    try {
      const req = await rescueService.getActiveRescueRequest();
      setActiveRequest(req);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const refreshActiveRequest = async () => {
    try {
      const req = await rescueService.getActiveRescueRequest();
      setActiveRequest(req);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need camera roll permission to attach photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets) {
      const uris = result.assets.map(asset => asset.uri);
      setSelectedImages([...selectedImages, ...uris]);
    }
  };

  const removeImage = (uri: string) => {
    setSelectedImages(selectedImages.filter(img => img !== uri));
  };

  const handleSubmit = async () => {
    if (selectedCategories.length === 0) {
      Alert.alert('Missing Info', 'Please select at least one problem category.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Info', 'Please write a detailed description of the breakdown.');
      return;
    }
    if (!location) {
      Alert.alert('Location Error', 'Unable to capture GPS coordinates. Please enable GPS.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('latitude', String(location.coords.latitude));
      formData.append('longitude', String(location.coords.longitude));
      formData.append('address', address);
      formData.append('description', description);
      formData.append('severity', severity);
      formData.append('is_drivable', isDrivable ? '1' : '0');
      
      selectedCategories.forEach((cat, idx) => {
        formData.append(`categories[${idx}]`, cat.toLowerCase());
      });

      selectedImages.forEach((imgUri, index) => {
        const uriParts = imgUri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        formData.append('media[]', {
          uri: imgUri,
          name: `photo_${index}.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      });

      const response = await rescueService.submitRescueRequest(formData);
      if (response.success && response.rescue_request) {
        Alert.alert('Request Sent', 'Rescue dispatch has been notified. Please stay with your vehicle.');
        setActiveRequest(response.rescue_request);
      } else {
        Alert.alert('Error', response.message || 'Failed to submit request.');
      }
    } catch (e) {
      Alert.alert('Error', 'An unexpected error occurred.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!activeRequest) return;
    
    Alert.alert(
      'Confirm Completion',
      'Are you sure the repair is fully completed and you are ready to resume work?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes, Completed', 
          onPress: async () => {
            const success = await rescueService.confirmClose(activeRequest.id);
            if (success) {
              setActiveRequest(null);
              setSelectedCategories([]);
              setDescription('');
              setSelectedImages([]);
            } else {
              Alert.alert('Error', 'Failed to close the rescue case.');
            }
          }
        }
      ]
    );
  };

  const getStatusStepIndex = (status: string) => {
    const steps = ['pending', 'assigned', 'on_the_way', 'arrived', 'repair_in_progress', 'repair_completed'];
    const idx = steps.indexOf(status);
    return idx === -1 ? 0 : idx;
  };

  const getLeafletHtml = (lat: number, lng: number, mechLat?: number | null, mechLng?: number | null) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="initial-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; }
        .leaflet-routing-container { display: none !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);
        
        var driverIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        var driver = L.marker([${lat}, ${lng}], {icon: driverIcon}).addTo(map).bindPopup('Your Breakdown Point').openPopup();
        
        if (${mechLat ? 'true' : 'false'}) {
          var mechIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });
          var mech = L.marker([${mechLat || 0}, ${mechLng || 0}], {icon: mechIcon}).addTo(map).bindPopup('Mechanic Location');
          
          try {
            L.Routing.control({
              waypoints: [
                L.latLng(${mechLat || 0}, ${mechLng || 0}),
                L.latLng(${lat}, ${lng})
              ],
              router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1'
              }),
              show: false,
              addWaypoints: false,
              draggableWaypoints: false,
              fitSelectedRoutes: true,
              lineOptions: {
                styles: [{ color: '#2563EB', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }],
                extendToWaypoints: true,
                missingRouteTolerance: 100
              },
              createMarker: function() { return null; }
            }).addTo(map);
          } catch(e) {
            console.log('Routing Machine failed, falling back to bounds');
            var group = new L.featureGroup([driver, mech]);
            map.fitBounds(group.getBounds().pad(0.15));
          }
        }
      </script>
    </body>
    </html>
  `;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Synchronizing rescue server...</Text>
      </View>
    );
  }

  // Render Active Breakdown Status HUD
  if (activeRequest) {
    const currentStep = getStatusStepIndex(activeRequest.status);
    const mech = activeRequest.mechanic;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Active Breakdown HUD</Text>
          <Text style={styles.headerSubtitle}>Waybill: {activeRequest.waybill || 'N/A'}</Text>
        </View>

        <ScrollView style={styles.content}>
          {/* Map showing approach */}
          <View style={styles.mapContainer}>
            {Platform.OS === 'web' ? (
              <iframe 
                srcDoc={getLeafletHtml(activeRequest.latitude, activeRequest.longitude, mech?.current_latitude, mech?.current_longitude)} 
                style={{ width: '100%', height: '100%', border: 'none' }} 
              />
            ) : (
              <WebView
                originWhitelist={['*']}
                source={{ html: getLeafletHtml(activeRequest.latitude, activeRequest.longitude, mech?.current_latitude, mech?.current_longitude) }}
                style={{ flex: 1 }}
              />
            )}
          </View>

          {/* Progress Tracker */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Assistance Progress</Text>
            
            <View style={styles.timeline}>
              {['Reported', 'Assigned', 'On The Way', 'Arrived', 'Repairing', 'Resolved'].map((label, idx) => {
                const isDone = idx <= currentStep;
                const isCurrent = idx === currentStep;
                return (
                  <View key={idx} style={styles.timelineStep}>
                    <View style={styles.timelineIndicators}>
                      <View style={[
                        styles.timelineDot,
                        isDone && styles.timelineDotDone,
                        isCurrent && styles.timelineDotCurrent
                      ]}>
                        {isDone && <Ionicons name="checkmark" size={10} color="#FFF" />}
                      </View>
                      {idx < 5 && <View style={[styles.timelineLine, idx < currentStep && styles.timelineLineDone]} />}
                    </View>
                    <Text style={[
                      styles.timelineText,
                      isDone && styles.timelineTextDone,
                      isCurrent && styles.timelineTextCurrent
                    ]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Mechanic Details */}
          {mech && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Assigned Dispatcher</Text>
              <View style={styles.mechanicDetails}>
                <View style={styles.mechanicAvatar}>
                  <Ionicons name="construct" size={24} color="#10B981" />
                </View>
                <View style={styles.mechanicInfo}>
                  <Text style={styles.mechanicName}>{mech.firstname} {mech.lastname}</Text>
                  <Text style={styles.mechanicSub}>On-Site Rescuer</Text>
                </View>
                <TouchableOpacity style={styles.callButton} onPress={() => Alert.alert('Contact Support', `Call: ${mech.contact_number || 'N/A'}`)}>
                  <Ionicons name="call" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
              {activeRequest.eta_minutes && (
                <View style={styles.etaContainer}>
                  <Ionicons name="time" size={18} color="#F59E0B" />
                  <Text style={styles.etaText}>Estimated On-Site Arrival: {activeRequest.eta_minutes} mins</Text>
                </View>
              )}
            </View>
          )}

          {/* Issue Summary */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Breakdown Description</Text>
            <View style={styles.detailsGrid}>
              <Text style={styles.detailsLabel}>Details:</Text>
              <Text style={styles.detailsVal}>{activeRequest.description}</Text>
            </View>
            <View style={styles.detailsGrid}>
              <Text style={styles.detailsLabel}>Severity:</Text>
              <Text style={[styles.detailsVal, { color: activeRequest.severity === 'critical' ? '#EF4444' : '#F59E0B', fontWeight: 'bold' }]}>{activeRequest.severity.toUpperCase()}</Text>
            </View>
          </View>

          {/* Confirm Button */}
          {(activeRequest.status === 'repair_completed' || activeRequest.status === 'cannot_repair') && (
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmClose}>
              <Ionicons name="checkmark-done-circle" size={20} color="#FFF" />
              <Text style={styles.confirmButtonText}>Confirm Repair Completed</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Render Request Assistance Form
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Roadside Assistance</Text>
        <Text style={styles.headerSubtitle}>Request mechanical help on breakdowns</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Map Preview */}
        {location && (
          <View style={styles.mapContainer}>
            {Platform.OS === 'web' ? (
              <iframe 
                srcDoc={getLeafletHtml(location.coords.latitude, location.coords.longitude)} 
                style={{ width: '100%', height: '100%', border: 'none' }} 
              />
            ) : (
              <WebView
                originWhitelist={['*']}
                source={{ html: getLeafletHtml(location.coords.latitude, location.coords.longitude) }}
                style={{ flex: 1 }}
              />
            )}
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Location Address</Text>
          <View style={styles.addressBox}>
            <Ionicons name="location" size={16} color="#64748B" />
            <Text style={styles.addressText}>{address}</Text>
          </View>
        </View>

        {/* Severity */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Assistance Severity Level</Text>
          <View style={styles.severityGrid}>
            {(['low', 'medium', 'high', 'critical'] as const).map(level => {
              const isSelected = severity === level;
              return (
                <TouchableOpacity 
                  key={level}
                  onPress={() => setSeverity(level)}
                  style={[
                    styles.severityButton,
                    isSelected && { backgroundColor: level === 'critical' ? '#FEE2E2' : '#EFF6FF', borderColor: level === 'critical' ? '#EF4444' : '#3B82F6' }
                  ]}
                >
                  <Text style={[
                    styles.severityText,
                    isSelected && { color: level === 'critical' ? '#EF4444' : '#3B82F6', fontWeight: 'bold' }
                  ]}>{level.toUpperCase()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Drivable */}
        <View style={[styles.formGroup, styles.switchRow]}>
          <View>
            <Text style={styles.label}>Is Truck Still Drivable?</Text>
            <Text style={styles.sublabel}>Disable if completely immobilized</Text>
          </View>
          <Switch 
            value={isDrivable}
            onValueChange={setIsDrivable}
            trackColor={{ false: '#767577', true: '#A7F3D0' }}
            thumbColor={isDrivable ? '#10B981' : '#f4f3f4'}
          />
        </View>

        {/* Problem Categories */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Problem Categories (Select multiple)</Text>
          <View style={styles.categoryGrid}>
            {categoriesList.map(cat => {
              const isSelected = selectedCategories.includes(cat);
              return (
                <TouchableOpacity 
                  key={cat}
                  onPress={() => toggleCategory(cat)}
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipSelected
                  ]}
                >
                  <Text style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextSelected
                  ]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Breakdown details */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Assistance & Issue Description</Text>
          <TextInput 
            placeholder="Describe the breakdown details (e.g. engine overheated, rear tire flat)..."
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            style={styles.textArea}
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Photos */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Attach Incident Evidence Photos</Text>
          <View style={styles.photoGrid}>
            <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
              <Ionicons name="camera" size={24} color="#64748B" />
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
            
            {selectedImages.map((uri, idx) => (
              <View key={idx} style={styles.photoContainer}>
                <Image source={{ uri }} style={styles.photo} />
                <TouchableOpacity style={styles.removePhoto} onPress={() => removeImage(uri)}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity 
          style={[styles.submitButton, submitting && { opacity: 0.7 }]} 
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="alert-circle" size={20} color="#FFF" />
              <Text style={styles.submitText}>Submit Rescue Dispatch</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  mapContainer: {
    height: 350,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#E2E8F0',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addressText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
  severityGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  severityText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  categoryChipSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryTextSelected: {
    color: '#10B981',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    height: 100,
    textAlignVertical: 'top',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  addPhotoText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
  },
  photoContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 10,
  },
  submitButton: {
    backgroundColor: '#EF4444',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  timeline: {
    paddingLeft: 4,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timelineIndicators: {
    alignItems: 'center',
    width: 20,
    marginRight: 12,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  timelineDotCurrent: {
    borderColor: '#3B82F6',
    borderWidth: 3,
  },
  timelineLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E2E8F0',
    marginTop: 2,
  },
  timelineLineDone: {
    backgroundColor: '#10B981',
  },
  timelineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  timelineTextDone: {
    color: '#334155',
  },
  timelineTextCurrent: {
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  mechanicDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mechanicAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  mechanicInfo: {
    marginLeft: 12,
    flex: 1,
  },
  mechanicName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  mechanicSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 14,
  },
  etaText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  detailsGrid: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailsLabel: {
    width: 80,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  detailsVal: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  confirmButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  }
});
