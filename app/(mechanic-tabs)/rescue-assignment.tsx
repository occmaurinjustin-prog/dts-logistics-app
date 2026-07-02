import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  TextInput, Alert, Platform, ActivityIndicator, Image, KeyboardAvoidingView, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import rescueService, { RescueRequest } from '@/services/rescueService';

export default function RescueAssignmentScreen() {
  const [activeJob, setActiveJob] = useState<RescueRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  // Form Fields
  const [status, setStatus] = useState<string>('');
  const [findings, setFindings] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  useEffect(() => {
    loadAssignment();
    requestLocationPermission();
  }, []);

  // Location tracking loop when assignment is active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeJob && ['assigned', 'accepted', 'on_the_way', 'arrived', 'inspection_started', 'repair_in_progress', 'waiting_for_parts'].includes(activeJob.status)) {
      interval = setInterval(() => {
        trackLocation();
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [activeJob]);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCurrentLocation(loc);
  };

  const trackLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation(loc);
      
      // Update coordinates to database
      await rescueService.updateLocation(loc.coords.latitude, loc.coords.longitude);
      
      // Refresh assignment status
      const job = await rescueService.getMechanicAssignments();
      if (job) {
        setActiveJob(job);
      }
    } catch (e) {
      console.log('Error updating live location:', e);
    }
  };

  const loadAssignment = async () => {
    setLoading(true);
    try {
      const job = await rescueService.getMechanicAssignments();
      setActiveJob(job);
      if (job) {
        setStatus(job.status);
        setFindings(job.inspection_findings || '');
        setNotes(job.repair_notes || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (response: 'accept' | 'reject') => {
    if (!activeJob) return;

    setUpdating(true);
    try {
      const success = await rescueService.respondToAssignment(activeJob.id, response);
      if (success) {
        if (response === 'accept') {
          Alert.alert('Job Accepted', 'Route navigation is now ready. Drive safely.');
          loadAssignment();
        } else {
          Alert.alert('Job Rejected', 'Assignment declined successfully.');
          setActiveJob(null);
        }
      } else {
        Alert.alert('Error', 'Action failed. Please try again.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need camera permission to attach photos.');
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

  const handleStatusUpdateStep = async (newStatus: string) => {
    if (!activeJob) return;
    setUpdating(true);
    try {
      const formData = new FormData();
      formData.append('rescue_request_id', String(activeJob.id));
      formData.append('status', newStatus);
      formData.append('inspection_findings', findings);
      formData.append('repair_notes', notes);
      
      const success = await rescueService.updateRescueStatus(formData);
      if (success) {
        loadAssignment();
      } else {
        Alert.alert('Error', 'Failed to update status.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdateWithStatus = async (finalStatus: string) => {
    if (!activeJob) return;

    setUpdating(true);
    try {
      const formData = new FormData();
      formData.append('rescue_request_id', String(activeJob.id));
      formData.append('status', finalStatus);
      formData.append('inspection_findings', findings);
      formData.append('repair_notes', notes);

      selectedImages.forEach((imgUri, index) => {
        const uriParts = imgUri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        formData.append('media[]', {
          uri: imgUri,
          name: `after_photo_${index}.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      });

      const success = await rescueService.updateRescueStatus(formData);
      if (success) {
        Alert.alert('Status Updated', 'Rescue report synchronized successfully.');
        setSelectedImages([]);
        loadAssignment();
      } else {
        Alert.alert('Error', 'Failed to synchronize updates.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setUpdating(false);
    }
  };

  const getLeafletHtml = (driverLat: number, driverLng: number, mechLat?: number | null, mechLng?: number | null) => `
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
        var map = L.map('map', { zoomControl: false }).setView([${driverLat}, ${driverLng}], 14);
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
        
        var driver = L.marker([${driverLat}, ${driverLng}], {icon: driverIcon}).addTo(map).bindPopup('Driver Breakdown Location').openPopup();

        if (${mechLat ? 'true' : 'false'}) {
          var mechIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });
          var mech = L.marker([${mechLat || 0}, ${mechLng || 0}], {icon: mechIcon}).addTo(map).bindPopup('Your Current Location');

          try {
            L.Routing.control({
              waypoints: [
                L.latLng(${mechLat || 0}, ${mechLng || 0}),
                L.latLng(${driverLat}, ${driverLng})
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
        <Text style={styles.loadingText}>Loading assigned rescue routes...</Text>
      </View>
    );
  }

  // State: No active assignments
  if (!activeJob) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rescue HUD</Text>
          <Text style={styles.headerSubtitle}>Breakdown Assistance Center</Text>
        </View>
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <Ionicons name="shield-checkmark" size={60} color="#94A3B8" />
          <Text style={styles.emptyTitle}>All Clear</Text>
          <Text style={styles.emptyText}>You currently have no active breakdown rescue assignments.</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadAssignment}>
            <Text style={styles.refreshBtnText}>Check Assignments</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // State: Job Assigned (Awaiting Acceptance)
  if (activeJob.status === 'assigned') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Rescue Assignment</Text>
          <Text style={styles.headerSubtitle}>Breakdown Assistance Request</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Incident Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Driver:</Text>
              <Text style={styles.detailVal}>{activeJob.driver?.user?.firstname} {activeJob.driver?.user?.lastname}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Contact:</Text>
              <Text style={styles.detailVal}>{activeJob.driver?.user?.contact_number || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location:</Text>
              <Text style={styles.detailVal}>{activeJob.address}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Truck Plate:</Text>
              <Text style={styles.detailVal}>{activeJob.truck?.plate_number}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Description:</Text>
              <Text style={styles.detailVal}>{activeJob.description}</Text>
            </View>
          </View>

          <View style={styles.responseContainer}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.declineBtn]} 
              onPress={() => handleRespond('reject')}
              disabled={updating}
            >
              <Text style={styles.actionBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.acceptBtn]} 
              onPress={() => handleRespond('accept')}
              disabled={updating}
            >
              {updating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.acceptBtnText}>Accept Job</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // State: Job Completed
  if (['repair_completed', 'cannot_repair'].includes(activeJob.status)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rescue Completed</Text>
          <Text style={styles.headerSubtitle}>Awaiting Driver Confirmation</Text>
        </View>
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <Ionicons name="checkmark-done-circle" size={80} color="#10B981" />
          <Text style={styles.emptyTitle}>Repair Finished</Text>
          <Text style={styles.emptyText}>You have marked this rescue operation as completed. Please wait for the driver to confirm the repair on their app to fully close this case.</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadAssignment}>
            <Text style={styles.refreshBtnText}>Refresh Status</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const renderActionPanel = () => {
    switch (activeJob.status) {
      case 'accepted':
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Next Action</Text>
            <TouchableOpacity 
              style={styles.primaryActionBtn} 
              onPress={() => handleStatusUpdateStep('on_the_way')}
              disabled={updating}
            >
              {updating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryActionText}>Start Route (On the Way)</Text>}
            </TouchableOpacity>
          </View>
        );
      case 'on_the_way':
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Next Action</Text>
            <TouchableOpacity 
              style={styles.primaryActionBtn} 
              onPress={() => handleStatusUpdateStep('arrived')}
              disabled={updating}
            >
              {updating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryActionText}>I Have Arrived On-Site</Text>}
            </TouchableOpacity>
          </View>
        );
      case 'arrived':
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Next Action</Text>
            <TouchableOpacity 
              style={styles.primaryActionBtn} 
              onPress={() => handleStatusUpdateStep('inspection_started')}
              disabled={updating}
            >
              {updating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryActionText}>Start Inspection & Repair</Text>}
            </TouchableOpacity>
          </View>
        );
      default:
        // inspection_started, repair_in_progress, waiting_for_parts
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Repair Updates</Text>
            
            {/* Phase Selector for granular repair status */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Repair Phase</Text>
              <View style={styles.segmentedControl}>
                {['inspection_started', 'repair_in_progress', 'waiting_for_parts'].map(phase => (
                  <TouchableOpacity 
                    key={phase}
                    style={[styles.segmentBtn, status === phase && styles.segmentBtnActive]}
                    onPress={() => setStatus(phase)}
                  >
                    <Text style={[styles.segmentText, status === phase && styles.segmentTextActive]}>
                      {phase.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).replace('In Progress', '')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Findings */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Inspection Findings</Text>
              <TextInput 
                placeholder="Log diagnostics, defects..."
                value={findings}
                onChangeText={setFindings}
                style={styles.textArea}
                multiline
                numberOfLines={3}
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Repair Actions & Notes</Text>
              <TextInput 
                placeholder="Log completed repair actions..."
                value={notes}
                onChangeText={setNotes}
                style={styles.textArea}
                multiline
                numberOfLines={3}
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Before / After Photos */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Attach Evidence Photos</Text>
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

            <TouchableOpacity 
              style={[styles.saveBtn, updating && { opacity: 0.7 }, { marginBottom: 16 }]} 
              onPress={() => handleStatusUpdateWithStatus(status)}
              disabled={updating}
            >
              {updating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Update Progress</Text>}
            </TouchableOpacity>

            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.declineBtn]} 
                onPress={() => handleStatusUpdateWithStatus('cannot_repair')}
                disabled={updating}
              >
                <Text style={styles.declineBtnText}>Cannot Repair</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.acceptBtn]} 
                onPress={() => handleStatusUpdateWithStatus('repair_completed')}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.acceptBtnText}>Finish Repair</Text>}
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  // State: Job Accepted & In-Progress
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Assistance Route HUD</Text>
          <Text style={styles.headerSubtitle}>Target: {activeJob.driver?.user?.firstname} ({activeJob.truck?.plate_number})</Text>
        </View>

        <ScrollView style={styles.content}>
          {/* Navigation Map */}
          <View style={styles.mapContainer}>
            {Platform.OS === 'web' ? (
              <iframe 
                srcDoc={getLeafletHtml(activeJob.latitude, activeJob.longitude, currentLocation?.coords.latitude, currentLocation?.coords.longitude)} 
                style={{ width: '100%', height: '100%', border: 'none' }} 
              />
            ) : (
              <WebView
                originWhitelist={['*']}
                source={{ html: getLeafletHtml(activeJob.latitude, activeJob.longitude, currentLocation?.coords.latitude, currentLocation?.coords.longitude) }}
                style={{ flex: 1 }}
              />
            )}
          </View>

          {/* Quick Contact */}
          <View style={styles.card}>
            <View style={styles.driverRow}>
              <View>
                <Text style={styles.driverName}>{activeJob.driver?.user?.firstname} {activeJob.driver?.user?.lastname}</Text>
                <Text style={styles.driverSub}>{activeJob.address}</Text>
              </View>
              <TouchableOpacity style={styles.callButton} onPress={() => Alert.alert('Calling Driver', `Call: ${activeJob.driver?.user?.contact_number}`)}>
                <Ionicons name="call" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Render workflow specific actions */}
          {renderActionPanel()}

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#334155',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
  },
  refreshBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginTop: 24,
  },
  refreshBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    width: 90,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  detailVal: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  responseContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  declineBtnText: {
    color: '#475569',
    fontWeight: '700',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  primaryActionBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  mapContainer: {
    height: 350,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#E2E8F0',
    marginBottom: 16,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  driverName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  driverSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    maxWidth: 220,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
  },
  selectTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  optionsList: {
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  optionItemActive: {
    borderBottomColor: '#E2E8F0',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  optionTextActive: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0F172A',
    height: 70,
    textAlignVertical: 'top',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  addPhotoBtn: {
    width: 70,
    height: 70,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  addPhotoText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
  },
  photoContainer: {
    position: 'relative',
    width: 70,
    height: 70,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 10,
  },
  saveBtn: {
    backgroundColor: '#10B981',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  }
});
