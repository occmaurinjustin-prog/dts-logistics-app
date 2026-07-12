import { AppAlert } from '@/components/AppAlert';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, ScrollView, Modal, TextInput } from 'react-native';
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
    const [inventory, setInventory] = useState<any[]>([]);
    const [selectedParts, setSelectedParts] = useState<any[]>([]);
    const [showPartsModal, setShowPartsModal] = useState(false);

    useEffect(() => {
        if (!id) {
            router.back();
            return;
        }
        fetchRescueDetails();
        fetchInventory();
        
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

    const fetchInventory = async () => {
        try {
            const token = await authService.getToken();
            const response = await fetch(`${getApiBaseUrl()}/mechanic/inventory`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setInventory(data.parts);
            }
        } catch (error) {
            console.error('Failed to fetch inventory:', error);
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
        if (status === 'resolved') {
            setShowPartsModal(true);
        } else {
            proceedUpdateStatus(status);
        }
    };

    const submitResolution = () => {
        setShowPartsModal(false);
        proceedUpdateStatus('resolved');
    };

    const proceedUpdateStatus = async (status: string) => {
        setUpdating(true);
        try {
            const token = await authService.getToken();
            
            const payload: any = { status };
            if (status === 'resolved' && selectedParts.length > 0) {
                payload.parts = selectedParts.map(p => ({
                    Inventory_id: p.Inventory_id,
                    quantity: p.quantity
                }));
            }

            const response = await fetch(`${getApiBaseUrl()}/rescue/${id}/status`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
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
                const errData = await response.json();
                AppAlert.alert('Error', errData.message || 'Failed to update status.');
            }
        } catch (error) {
            console.error(error);
            AppAlert.alert('Error', 'Network request failed.');
        } finally {
            setUpdating(false);
        }
    };

    const handleTogglePart = (part: any) => {
        const exists = selectedParts.find((p) => p.Inventory_id === part.Inventory_id);
        if (exists) {
            setSelectedParts(selectedParts.filter((p) => p.Inventory_id !== part.Inventory_id));
        } else {
            setSelectedParts([...selectedParts, { ...part, quantity: 1 }]);
        }
    };

    const handleUpdateQuantity = (id: number, delta: number) => {
        setSelectedParts(selectedParts.map((p) => {
            if (p.Inventory_id === id) {
                const newQuantity = p.quantity + delta;
                const part = inventory.find((i) => i.Inventory_id === id);
                if (newQuantity > 0 && part && newQuantity <= part.quantity) {
                    return { ...p, quantity: newQuantity };
                }
            }
            return p;
        }));
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

            {/* Parts Modal */}
            <Modal visible={showPartsModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Parts Used</Text>
                        <Text style={styles.modalSubtitle}>Did you use any parts for this rescue mission?</Text>
                        
                        <ScrollView style={styles.inventoryList}>
                            {inventory.map(part => {
                                const isSelected = selectedParts.find(p => p.Inventory_id === part.Inventory_id);
                                return (
                                    <View key={part.Inventory_id} style={[styles.partItem, isSelected && styles.partItemSelected]}>
                                        <TouchableOpacity 
                                            style={[styles.partInfo, part.quantity <= 0 && { opacity: 0.5 }]}
                                            onPress={() => handleTogglePart(part)}
                                            disabled={part.quantity <= 0}
                                        >
                                            <Ionicons 
                                                name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                                                size={24} 
                                                color={isSelected ? "#0F6B5A" : "#D1D5DB"} 
                                            />
                                            <View style={{marginLeft: 12, flex: 1}}>
                                                <Text style={styles.partName}>{part.part_name}</Text>
                                                <Text style={styles.partStock}>Stock: {part.quantity} {part.unit}</Text>
                                            </View>
                                        </TouchableOpacity>

                                        {isSelected && (
                                            <View style={styles.quantityControl}>
                                                <TouchableOpacity 
                                                    style={styles.qtyBtn}
                                                    onPress={() => handleUpdateQuantity(part.Inventory_id, -1)}
                                                >
                                                    <Ionicons name="remove" size={16} color="#0F6B5A" />
                                                </TouchableOpacity>
                                                <Text style={styles.qtyText}>{isSelected.quantity}</Text>
                                                <TouchableOpacity 
                                                    style={styles.qtyBtn}
                                                    onPress={() => handleUpdateQuantity(part.Inventory_id, 1)}
                                                >
                                                    <Ionicons name="add" size={16} color="#0F6B5A" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPartsModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalSubmitBtn, updating && { opacity: 0.7 }]} 
                                onPress={submitResolution}
                                disabled={updating}
                            >
                                {updating ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <Text style={styles.modalSubmitText}>Complete Rescue</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#23423B', marginBottom: 4 },
    modalSubtitle: { fontSize: 14, color: '#6F8B84', marginBottom: 16 },
    inventoryList: { maxHeight: 400 },
    partItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EEF4F1', marginBottom: 12 },
    partItemSelected: { borderColor: '#0F6B5A', backgroundColor: '#F0FDF4' },
    partInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    partName: { fontSize: 15, fontWeight: '600', color: '#23423B' },
    partStock: { fontSize: 12, color: '#6F8B84' },
    quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#DDE9E3' },
    qtyBtn: { padding: 8 },
    qtyText: { width: 30, textAlign: 'center', fontWeight: '700', color: '#0F6B5A' },
    modalActions: { flexDirection: 'row', marginTop: 24, gap: 12 },
    modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EEF4F1', alignItems: 'center' },
    modalCancelText: { color: '#4F6C66', fontWeight: '700', fontSize: 15 },
    modalSubmitBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#0F6B5A', alignItems: 'center' },
    modalSubmitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
