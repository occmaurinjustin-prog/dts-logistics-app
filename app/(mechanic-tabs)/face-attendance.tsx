import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Image, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

const API_BASE_URL = Platform.OS === 'android' ? 'http://10.65.49.24:8000/api' : 'http://localhost:8000/api';

export default function FaceAttendanceScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [photo, setPhoto] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isShiftComplete, setIsShiftComplete] = useState(false);
  const [attendanceRecord, setAttendanceRecord] = useState<any>(null);
  const [isCheckingState, setIsCheckingState] = useState(true);
  const router = useRouter();

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check attendance state on mount
  useEffect(() => {
    const checkAttendanceState = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          const userId = userData.user_id || userData.id;
          
          const response = await fetch(`${API_BASE_URL}/attendance/today?user_id=${userId}`);
          if (response.ok) {
            const resData = await response.json();
            if (resData.success && resData.data) {
              setAttendanceRecord(resData.data);
              if (resData.data.afternoon_out) {
                setIsShiftComplete(true);
              }
            }
          }
        }
      } catch (e) {
        console.error("Error checking attendance state", e);
      } finally {
        setIsCheckingState(false);
      }
    };
    checkAttendanceState();
  }, []);

  // Auto-verify when photo is taken
  useEffect(() => {
    if (photo && !isProcessing && !result) {
      verifyAndLogAttendance();
    }
  }, [photo]);

  if (isCheckingState) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={{ color: '#10B981', marginTop: 16 }}>Checking attendance state...</Text>
      </View>
    );
  }

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current && isCameraReady) {
      try {
        const photoData = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
        });
        setPhoto(photoData);
      } catch (error) {
        console.error('Failed to take picture', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const retakePicture = () => {
    setPhoto(null);
    setResult(null);
  };

  const verifyAndLogAttendance = async () => {
    if (!photo) return;
    
    setIsProcessing(true);
    setResult(null);

    try {
      let location = null;
      let address = 'Unknown Location';
      try {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
              Alert.alert('Permission Denied', 'GPS permission is required for attendance.');
              throw new Error('GPS permission denied');
          }
          location = await Location.getCurrentPositionAsync({});
          const geocode = await Location.reverseGeocodeAsync({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
          });
          
          if (geocode.length > 0) {
              const place = geocode[0];
              address = [place.name, place.street, place.city, place.region].filter(Boolean).join(', ');
          }
      } catch (locErr: any) {
          console.warn("Location error:", locErr);
          throw new Error(locErr.message || 'Failed to get location');
      }

      const userDataStr = await AsyncStorage.getItem('userData');
      if (!userDataStr) throw new Error('User data not found');
      
      const userData = JSON.parse(userDataStr);
      
      const formData = new FormData();
      const userId = userData.user_id || userData.id;
      if (!userId) throw new Error('User ID not found in stored data');
      formData.append('user_id', userId.toString());
      
      if (location) {
          formData.append('latitude', location.coords.latitude.toString());
          formData.append('longitude', location.coords.longitude.toString());
          formData.append('address', address);
      }
      formData.append('device_name', Platform.OS + ' ' + Platform.Version);
      
      const filename = 'attendance.jpg';
      const match = photo.uri.match(/\.(\w+)$/);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append('image', {
        uri: photo.uri,
        name: filename,
        type,
      } as any);

      const response = await fetch(`${API_BASE_URL}/attendance/scan`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      const responseData = await response.json();
      
      if (response.ok && responseData.success) {
        let statusMsg = responseData.message || 'Attendance logged successfully!';
        if (responseData.data && responseData.data.attendance_type) {
            const attType = responseData.data.attendance_type;
            if (attType.includes('in')) {
                statusMsg = `Time In successful (${attType.replace('_', ' ')})! Have a great shift!`;
            } else if (attType.includes('out')) {
                statusMsg = `Time Out successful (${attType.replace('_', ' ')})! Good work today!`;
            }
            if (responseData.data.attendance) {
                setAttendanceRecord(responseData.data.attendance);
                if (responseData.data.attendance.afternoon_out) {
                    setIsShiftComplete(true);
                }
            }
        }
        setResult({ success: true, message: statusMsg });
        
        // Auto dismiss after 3 seconds
        setTimeout(() => {
          setPhoto(null);
          setResult(null);
        }, 3000);

      } else {
        setResult({ success: false, message: responseData.message || 'Face verification failed' });
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setResult({ success: false, message: error.message || 'Network error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  const hour = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const timeValue = hour + (minutes / 60);
  
  let suggestionText = "Please Capture Face to Time In/Out";
  let greeting = "Good Day";
  let isCaptureDisabled = false;
  
  if (timeValue < 11.83) { // Before 11:50 AM
    greeting = "Good Morning";
    if (attendanceRecord?.morning_in) {
      suggestionText = "Wait until 11:50 AM to time out in the morning";
      isCaptureDisabled = true;
    } else {
      suggestionText = "Ready to Time In? (Morning Shift)";
    }
  } else if (timeValue >= 11.83 && timeValue < 13) { // 11:50 AM - 1:00 PM
    greeting = "Good Day";
    if (attendanceRecord?.morning_out) {
      suggestionText = "Morning Time-Out Complete. Wait for Afternoon Shift";
      isCaptureDisabled = true;
    } else {
      suggestionText = "Ready for Morning Time-Out / Lunch?";
    }
  } else if (timeValue >= 13 && timeValue < 15.83) { // 1:00 PM - 3:50 PM
    greeting = "Good Afternoon";
    if (attendanceRecord?.afternoon_in) {
      suggestionText = "Wait until 3:50 PM to time out in the afternoon";
      isCaptureDisabled = true;
    } else {
      suggestionText = "Ready to Time In? (Afternoon Shift)";
    }
  } else if (timeValue >= 15.83) { // After 3:50 PM
    greeting = "Good Evening";
    suggestionText = "Ready to Time Out? (Shift Ends)";
  }

  if (photo) {
    // Show Full-Screen Success UI
    if (result && result.success) {
      return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#ECFDF5' }]}>
          <Ionicons name="checkmark-circle" size={120} color="#10B981" />
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#065F46', marginTop: 20 }}>Verified!</Text>
          <Text style={{ fontSize: 18, color: '#047857', marginTop: 10, textAlign: 'center', paddingHorizontal: 40 }}>
            {result.message}
          </Text>
        </View>
      );
    }

    // Default photo preview
    return (
      <View style={styles.container}>
        <Image source={{ uri: photo.uri }} style={styles.preview} />
        
        {isProcessing && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.overlayText}>Verifying Face...</Text>
          </View>
        )}

        {result && !result.success && (
          <View style={[styles.resultContainer, styles.errorResult]}>
            <Ionicons name="close-circle" size={40} color="#EF4444" />
            <View style={{flex: 1, marginLeft: 12}}>
              <Text style={[styles.resultTitle, {color: '#991B1B'}]}>Verification Failed</Text>
              <Text style={styles.resultText}>{result.message}</Text>
            </View>
          </View>
        )}

        <View style={styles.controls}>
          <TouchableOpacity style={styles.secondaryButton} onPress={retakePicture} disabled={isProcessing}>
            <Ionicons name="refresh-circle" size={24} color="white" style={{marginRight: 8}} />
            <Text style={styles.secondaryButtonText}>Retake Photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isShiftComplete || timeValue < 6) {
    const isComplete = timeValue >= 6 && isShiftComplete;
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        {isComplete ? (
          <View style={{ alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <Ionicons name="checkmark-done-circle" size={100} color="#10B981" />
            <Text style={{ color: '#10B981', fontSize: 28, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
              Shift Complete!
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 16, marginTop: 10, textAlign: 'center', lineHeight: 24 }}>
              Great job today! You have successfully completed your shift. Face recognition is disabled until tomorrow.
            </Text>
            <TouchableOpacity 
              style={{ backgroundColor: '#10B981', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 25, marginTop: 30 }}
              onPress={() => router.back()}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ alignItems: 'center', backgroundColor: 'rgba(100, 116, 139, 0.1)', padding: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(100, 116, 139, 0.3)' }}>
            <Ionicons name="time" size={100} color="#94A3B8" />
            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
              Too Early
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 16, marginTop: 10, textAlign: 'center', lineHeight: 24 }}>
              Face recognition will be available starting at 6:00 AM.
            </Text>
            <TouchableOpacity 
              style={{ backgroundColor: '#334155', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 25, marginTop: 30 }}
              onPress={() => router.back()}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing="front" 
        ref={cameraRef}
        onCameraReady={() => setIsCameraReady(true)}
      >
        <View style={styles.cameraOverlay}>
          {/* Header Clock Container */}
          <View style={styles.clockContainer}>
            <Text style={styles.clockTime}>{formattedTime}</Text>
            <Text style={styles.clockDate}>{formattedDate}</Text>
          </View>

          <View style={styles.faceGuide}></View>

          {/* Instruction Card */}
          <View style={styles.instructionCard}>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={[styles.instructionText, isCaptureDisabled && { color: '#F59E0B' }]}>{suggestionText}</Text>
          </View>
        </View>
        
        <View style={styles.cameraControls}>
          <TouchableOpacity 
            style={[styles.captureButton, (!isCameraReady || isCaptureDisabled) && { opacity: 0.5 }]} 
            onPress={takePicture}
            disabled={!isCameraReady || isCaptureDisabled}
          >
            <View style={styles.captureInner}>
              <View style={[styles.captureCore, isCaptureDisabled && { backgroundColor: '#94A3B8', borderColor: '#CBD5E1' }]} />
            </View>
          </TouchableOpacity>
          <Text style={styles.captureLabel}>{isCaptureDisabled ? 'Disabled' : 'Capture to Verify'}</Text>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  camera: { flex: 1 },
  message: { textAlign: 'center', paddingBottom: 10, color: 'white', fontSize: 16 },
  button: { backgroundColor: '#10B981', padding: 14, borderRadius: 10, marginHorizontal: 30 },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  
  cameraOverlay: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingTop: 50,
  },
  
  clockContainer: {
    position: 'absolute',
    top: 60,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  clockTime: {
    color: '#10B981',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  clockDate: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },

  instructionCard: {
    position: 'absolute',
    bottom: 150,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    width: '80%',
  },
  greetingText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  instructionText: { 
    color: '#10B981', 
    fontSize: 16, 
    fontWeight: '700',
    textAlign: 'center'
  },

  faceGuide: { 
    width: 280, 
    height: 380, 
    borderWidth: 3, 
    borderColor: 'rgba(16, 185, 129, 0.6)', 
    borderStyle: 'dashed', 
    borderRadius: 140, 
    marginBottom: 40 
  },
  
  cameraControls: { 
    position: 'absolute', 
    bottom: 40, 
    width: '100%', 
    alignItems: 'center' 
  },
  captureButton: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)'
  },
  captureInner: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center'
  },
  captureCore: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#CBD5E1'
  },
  captureLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: -1, height: 1},
    textShadowRadius: 10
  },
  
  preview: { flex: 1, width: '100%' },
  controls: { 
    position: 'absolute', 
    bottom: 40, 
    left: 20, 
    right: 20, 
    alignItems: 'center' 
  },
  secondaryButton: { 
    backgroundColor: 'rgba(15, 23, 42, 0.8)', 
    paddingVertical: 16, 
    paddingHorizontal: 32,
    borderRadius: 30, 
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  secondaryButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(15,23,42,0.85)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 10 
  },
  overlayText: { color: '#10B981', marginTop: 16, fontSize: 18, fontWeight: 'bold' },
  
  resultContainer: { 
    position: 'absolute', 
    top: 80, 
    left: 20, 
    right: 20, 
    padding: 20, 
    borderRadius: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  successResult: { backgroundColor: '#ECFDF5', borderColor: '#34D399', borderWidth: 2 },
  errorResult: { backgroundColor: '#FEF2F2', borderColor: '#F87171', borderWidth: 2 },
  resultTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  resultText: { fontSize: 15, fontWeight: '500', color: '#334155' },
});
