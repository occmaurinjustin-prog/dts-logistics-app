import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';

export default function MechanicTabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#0F6B5A',
        tabBarInactiveTintColor: '#9AB7AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 32 : 16,
          left: 20,
          right: 20,
          height: Platform.OS === 'ios' ? 88 : 78,
          borderRadius: 24,
          elevation: 20,
          shadowColor: '#23423B',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.1,
          shadowRadius: 32,
          paddingHorizontal: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.3,
          marginTop: 4,
        },
        headerShown: false,
        animation: 'fade',
      }}>
      
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconWrapper]}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={focused ? '#0F6B5A' : color} />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="assignments"
        options={{
          title: 'Assignment',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconWrapper]}>
              <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={22} color={focused ? '#0F6B5A' : color} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="face-attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconWrapper]}>
              <Ionicons name={focused ? 'qr-code' : 'qr-code-outline'} size={30} color={focused ? '#0F6B5A' : color} />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="inspection-reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconWrapper]}>
              <Ionicons name={focused ? 'search' : 'search-outline'} size={22} color={focused ? '#0F6B5A' : color} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconWrapper]}>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={focused ? '#0F6B5A' : color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIconWrapper: {
    backgroundColor: '#E3F2EB', // Soft emerald background
  },
});
