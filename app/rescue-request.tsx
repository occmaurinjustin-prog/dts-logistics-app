import { AppAlert } from '@/components/AppAlert';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import authService from '@/services/authService';

const getApiBaseUrl = () => 'https://consult-powwow-vexingly.ngrok-free.dev/api';

const ISSUE_CATEGORIES = ['Flat Tire', 'Engine Stall', 'Battery Dead', 'Overheating', 'Accident', 'Other'];

export default function RescueRequestScreen() {
    const router = useRouter();
    const [activeRescue, setActiveRescue] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Form State
    const [issueCategory, setIssueCategory] = useState('');
    const [description, setDescription] = useState('');
    const [media, setMedia] = useState<string | null>(null);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);

    useEffect(() => {
        checkActiveRescue();
        getLocation();
    }, []);

    const checkActiveRescue = async () => {
        try {
            const token = await authService.getToken();
            const response = await fetch(`${getApiBaseUrl()}/rescue/driver/active`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.data) {
                setActiveRescue(data.data);
            }
        } catch (error) {
            console.error('Failed to check active rescue', error);
        } finally {
            setLoading(false);
        }
    };

    const getLocation = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            AppAlert.alert('Permission Denied', 'Allow location access to request rescue.');
            return;
        }
        let loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled && result.assets.length > 0) {
            setMedia(result.assets[0].uri);
        }
    };

    const submitRequest = async () => {
        if (!issueCategory) {
            AppAlert.alert('Validation Error', 'Please select an issue category.');
            return;
        }
        if (!location) {
            AppAlert.alert('Location Error', 'Still fetching your location. Please try again in a moment.');
            return;
        }

        setSubmitting(true);
        try {
            const token = await authService.getToken();
            const formData = new FormData();
            formData.append('issue_category', issueCategory);
            formData.append('description', description);
            formData.append('latitude', location.coords.latitude.toString());
            formData.append('longitude', location.coords.longitude.toString());
            
            if (media) {
                const filename = media.split('/').pop() || 'rescue.jpg';
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : `image/jpeg`;
                formData.append('media[]', { uri: media, name: filename, type } as any);
            }

            const response = await fetch(`${getApiBaseUrl()}/rescue/submit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            const data = await response.json();
            if (response.ok) {
                AppAlert.alert('Success', 'Rescue request sent successfully.');
                setActiveRescue(data.data);
            } else {
                AppAlert.alert('Error', data.message || 'Failed to submit request.');
            }
        } catch (error) {
            console.error(error);
            AppAlert.alert('Error', 'An error occurred while submitting.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#10B981" />
            </View>
        );
    }

    if (activeRescue) {
        return (
            <View style={styles.container}>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Active Rescue</Text>
                </View>
                <View style={styles.content}>
                    <View style={styles.statusCard}>
                        <Ionicons name="alert-circle" size={48} color="#F59E0B" />
                        <Text style={styles.statusTitle}>Help is on the way</Text>
                        <Text style={styles.statusText}>
                            Status: <Text style={styles.statusHighlight}>{activeRescue.status.toUpperCase().replace('_', ' ')}</Text>
                        </Text>
                        <Text style={styles.detailText}>Issue: {activeRescue.issue_category}</Text>
                        
                        {activeRescue.mechanic && (
                            <View style={styles.mechanicBox}>
                                <Text style={styles.mechanicLabel}>Assigned Mechanic:</Text>
                                <Text style={styles.mechanicName}>{activeRescue.mechanic.username}</Text>
                            </View>
                        )}
                        <Text style={styles.infoText}>Keep this app open so the mechanic can track your live location.</Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Request Rescue</Text>
            </View>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionTitle}>What happened?</Text>
                <View style={styles.categories}>
                    {ISSUE_CATEGORIES.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.categoryBtn, issueCategory === cat && styles.categoryBtnActive]}
                            onPress={() => setIssueCategory(cat)}
                        >
                            <Text style={[styles.categoryText, issueCategory === cat && styles.categoryTextActive]}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.sectionTitle}>Description (Optional)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Describe the issue in detail..."
                    multiline
                    numberOfLines={4}
                    value={description}
                    onChangeText={setDescription}
                />

                <Text style={styles.sectionTitle}>Photo/Video Evidence</Text>
                <TouchableOpacity style={styles.mediaBtn} onPress={pickImage}>
                    {media ? (
                        <Image source={{ uri: media }} style={styles.mediaPreview} />
                    ) : (
                        <View style={styles.mediaPlaceholder}>
                            <Ionicons name="camera" size={32} color="#94A3B8" />
                            <Text style={styles.mediaPlaceholderText}>Tap to add photo</Text>
                        </View>
                    )}
                </TouchableOpacity>
                
                <View style={styles.locationBox}>
                    <Ionicons name="location" size={20} color="#10B981" />
                    <Text style={styles.locationText}>
                        {location ? 'Your current GPS location will be sent.' : 'Acquiring GPS location...'}
                    </Text>
                </View>

                <TouchableOpacity 
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
                    onPress={submitRequest}
                    disabled={submitting || !location}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.submitBtnText}>SEND RESCUE REQUEST</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
    content: { padding: 20 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 12, marginTop: 16 },
    categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    categoryBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
    categoryBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
    categoryText: { color: '#64748B', fontWeight: '600' },
    categoryTextActive: { color: '#2563EB', fontWeight: 'bold' },
    input: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', height: 100, textAlignVertical: 'top' },
    mediaBtn: { height: 150, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', overflow: 'hidden' },
    mediaPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    mediaPlaceholderText: { color: '#94A3B8', marginTop: 8 },
    mediaPreview: { width: '100%', height: '100%', borderRadius: 12 },
    locationBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 12, borderRadius: 12, marginTop: 20 },
    locationText: { color: '#059669', marginLeft: 8, fontWeight: '500', fontSize: 13 },
    submitBtn: { backgroundColor: '#EF4444', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30, marginBottom: 40 },
    submitBtnDisabled: { opacity: 0.7 },
    submitBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
    
    // Status Card Styles
    statusCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    statusTitle: { fontSize: 24, fontWeight: 'bold', color: '#0F172A', marginTop: 16, marginBottom: 8 },
    statusText: { fontSize: 16, color: '#64748B', marginBottom: 4 },
    statusHighlight: { color: '#F59E0B', fontWeight: 'bold' },
    detailText: { fontSize: 14, color: '#334155', marginTop: 8 },
    mechanicBox: { backgroundColor: '#EFF6FF', padding: 16, borderRadius: 12, marginTop: 20, width: '100%', alignItems: 'center' },
    mechanicLabel: { fontSize: 12, color: '#64748B', textTransform: 'uppercase', fontWeight: 'bold' },
    mechanicName: { fontSize: 18, color: '#1E40AF', fontWeight: 'bold', marginTop: 4 },
    infoText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 24 },
});
