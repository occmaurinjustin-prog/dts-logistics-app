import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DriverStatus, driverService } from '../services/driverService';

interface DriverStatusIndicatorProps {
  status: DriverStatus | null | undefined;
  showLabel?: boolean;
  showIcon?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: any;
}

export default function DriverStatusIndicator({
  status,
  showLabel = true,
  showIcon = true,
  size = 'medium',
  onPress,
  style,
}: DriverStatusIndicatorProps) {
  const color = driverService.getStatusColor(status);
  const label = driverService.getStatusDisplay(status);
  const isBusy = driverService.isDriverBusy(status);

  const sizeStyles = {
    small: { dot: 8, fontSize: 12, padding: 6 },
    medium: { dot: 12, fontSize: 14, padding: 8 },
    large: { dot: 16, fontSize: 16, padding: 12 },
  };

  const s = sizeStyles[size];

  const renderIcon = () => {
    if (!showIcon) return null;
    
    if (status === 'available') {
      return <Ionicons name="checkmark-circle" size={s.fontSize} color={color} />;
    } else if (status === 'in_transit') {
      return <Ionicons name="bicycle" size={s.fontSize} color={color} />;
    } else if (status === 'busy') {
      return <Ionicons name="close-circle" size={s.fontSize} color={color} />;
    } else {
      return <Ionicons name="ellipse" size={s.fontSize} color={color} />;
    }
  };

  const Content = (
    <View style={[styles.container, { padding: s.padding }, style]}>
      {/* Status Dot */}
      <View
        style={[
          styles.dot,
          {
            width: s.dot,
            height: s.dot,
            backgroundColor: color,
          },
          isBusy && styles.pulseDot,
        ]}
      />

      {/* Icon */}
      {renderIcon()}

      {/* Label */}
      {showLabel && (
        <Text style={[styles.label, { fontSize: s.fontSize, color }]}>
          {label}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {Content}
      </TouchableOpacity>
    );
  }

  return Content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 6,
  },
  dot: {
    borderRadius: 100,
  },
  pulseDot: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  label: {
    fontWeight: '600',
  },
});
