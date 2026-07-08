import { AppAlert } from '@/components/AppAlert';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import authService from '@/services/authService';

const getApiBaseUrl = () => 'https://consult-powwow-vexingly.ngrok-free.dev/api';

export default function RescueMissionScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [rescue, setRescue] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);

    useEffect(() => {
        if (!id) {
            router.back();
            return;
        }
        fetchRescueDetails();
        
        return () => {
            if (locationSubscription) {
                locationSubscription.remove();
            }
        };
    }, [id]);

    const fetchRescueDetails = async () => {
        try {
            const token = await authService.getToken();
            const response = await fetch(`${getApiBaseUrl()}/rescue/mechanic/assignments`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            if (data.data) {
                const current = data.data.find((r: any) => r.rescue_id.toString() === id.toString());
                if (current) {
                    setRescue(current);
                    if (current.status === 'en_route') {
                        startLocationTracking();
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch rescue details:', error);
        } finally {
            setLoading(false);
        }
    };

    const startLocationTracking = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            AppAlert.alert('Permission Denied', 'Allow location tracking to share your location with the office.');
            return;
        }

        const sub = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 10000,
                distanceInterval: 50,
            },
            async (location) => {
                try {
                    const token = await authService.getToken();
                    await fetch(`${getApiBaseUrl()}/rescue/${id}/mechanic-location`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude
                        })
                    });
                } catch (error) {
                    console.log('Location update failed', error);
                }
            }
        );
        setLocationSubscription(sub);
    };

    const updateStatus = async (status: string) => {
        setUpdating(true);
        try {
            const token = await authService.getToken();
            const response = await fetch(`${getApiBaseUrl()}/rescue/${id}/status`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (response.ok) {
                if (status === 'en_route') {
                    startLocationTracking();
                } else if (status === 'arrived' || status === 'resolved') {
                    if (locationSubscription) {
                        locationSubscription.remove();
                        setLocationSubscription(null);
                    }
                }

                if (status === 'resolved') {
                    AppAlert.alert('Success', 'Rescue marked as resolved.', [
                        { text: 'OK', onPress: () => router.back() }
                    ]);
                } else {
                    fetchRescueDetails();
                }
            } else {
                AppAlert.alert('Error', 'Failed to update status.');
            }
        } catch (error) {
            console.error(error);
            AppAlert.alert('Error', 'Network request failed.');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#1E40AF" />
            </View>
        );
    }

    if (!rescue) {
        return (
            <View style={styles.center}>
                <Text>Rescue details not found.</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                    <Text style={{ color: '#1E40AF' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#23423B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Rescue Mission</Text>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.card}>
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{rescue.status.toUpperCase()}</Text>
                    </View>

                    <Text style={styles.title}>{rescue.issue_category}</Text>
                    <Text style={styles.desc}>{rescue.description || 'No description provided'}</Text>
                    
                    <View style={styles.driverBox}>
                        <Ionicons name="person-circle" size={40} color="#9AB7AF" />
                        <View style={{ marginLeft: 12 }}>
                            <Text style={styles.driverName}>{rescue.driver?.user?.username || 'Driver'}</Text>
                            <Text style={styles.driverPhone}>{rescue.truck?.plate_number}</Text>
                        </View>
                    </View>
                </View>

                {updating ? (
                    <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2A9D8F" />
                ) : (
                    <View style={styles.actionsBox}>
                        {rescue.status === 'assigned' && (
                            <TouchableOpacity style={[styles.btn, styles.enRouteBtn]} onPress={() => updateStatus('en_route')}>
                                <Ionicons name="navigate" size={20} color="white" />
                                <Text style={styles.btnText}>START EN ROUTE</Text>
                            </TouchableOpacity>
                        )}

                        {rescue.status === 'en_route' && (
                            <TouchableOpacity style={[styles.btn, styles.arrivedBtn]} onPress={() => updateStatus('arrived')}>
                                <Ionicons name="location" size={20} color="white" />
                                <Text style={styles.btnText}>MARK AS ARRIVED</Text>
                            </TouchableOpacity>
                        )}

                        {rescue.status === 'arrived' && (
                            <TouchableOpacity style={[styles.btn, styles.resolvedBtn]} onPress={() => updateStatus('resolved')}>
                                <Ionicons name="checkmark-circle" size={20} color="white" />
                                <Text style={styles.btnText}>MARK AS RESOLVED</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, backgroundColor: '#DDE9E3' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#D8E7E1' },
    backBtn: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#23423B' },
    content: { padding: 20 },
    card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: '#EFF6FF', marginBottom: 12 },
    statusText: { color: '#2563EB', fontWeight: 'bold', fontSize: 12 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#23423B', marginBottom: 8 },
    desc: { fontSize: 16, color: '#6F8B84', marginBottom: 20 },
    driverBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF4F1', padding: 12, borderRadius: 12 },
    driverName: { fontSize: 16, fontWeight: 'bold', color: '#35645A' },
    driverPhone: { fontSize: 14, color: '#6F8B84' },
    actionsBox: { marginTop: 40, gap: 16 },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8 },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
    enRouteBtn: { backgroundColor: '#2A9D8F' },
    arrivedBtn: { backgroundColor: '#F59E0B' },
    resolvedBtn: { backgroundColor: '#0F6B5A' },
});
