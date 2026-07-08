import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

// Global emitter to trigger alerts from outside React components
class AlertEmitter {
  listeners: ((options: any) => void)[] = [];

  subscribe(listener: (options: any) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit(options: any) {
    this.listeners.forEach(listener => listener(options));
  }
}

const alertEmitter = new AlertEmitter();

export const AppAlert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) => {
    alertEmitter.emit({ title, message, buttons, options });
  },
};

export function AppAlertUI() {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    message?: string;
    buttons?: AlertButton[];
    options?: AlertOptions;
  } | null>(null);

  const [scaleValue] = useState(new Animated.Value(0.9));
  const [opacityValue] = useState(new Animated.Value(0));

  useEffect(() => {
    const unsubscribe = alertEmitter.subscribe((newConfig) => {
      setConfig(newConfig);
      setVisible(true);
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 7,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => unsubscribe();
  }, [scaleValue, opacityValue]);

  const close = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setConfig(null);
      if (callback) callback();
    });
  };

  if (!visible || !config) return null;

  // Default button if none provided
  const buttons = config.buttons && config.buttons.length > 0 
    ? config.buttons 
    : [{ text: 'OK', onPress: () => {} }];

  const handleBackdropPress = () => {
    if (config.options?.cancelable !== false) {
      close(() => {
        if (config.options?.onDismiss) config.options.onDismiss();
      });
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleBackdropPress}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: opacityValue,
              transform: [{ scale: scaleValue }],
            },
          ]}
        >
          <View style={styles.headerIcon}>
            <Ionicons name={config.title.toLowerCase().includes('error') ? "alert-circle" : "notifications"} size={32} color="#0F6B5A" />
          </View>
          
          <Text style={styles.title}>{config.title}</Text>
          {config.message && <Text style={styles.message}>{config.message}</Text>}

          <View style={[styles.buttonContainer, buttons.length > 2 && styles.buttonContainerVertical]}>
            {buttons.map((btn, index) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    buttons.length > 2 && styles.buttonVertical,
                    isCancel && styles.buttonCancel,
                    isDestructive && styles.buttonDestructive,
                    buttons.length <= 2 && index > 0 && { marginLeft: 10 }
                  ]}
                  onPress={() => {
                    close(btn.onPress);
                  }}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel && styles.buttonTextCancel,
                      isDestructive && styles.buttonTextDestructive,
                    ]}
                  >
                    {btn.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(35, 66, 59, 0.6)',
  },
  modalContainer: {
    width: width * 0.85,
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E3F2EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#23423B',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#6F8B84',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  buttonContainerVertical: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    backgroundColor: '#0F6B5A',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonVertical: {
    width: '100%',
    marginBottom: 10,
    marginLeft: 0,
  },
  buttonCancel: {
    backgroundColor: '#F1F5F9',
  },
  buttonDestructive: {
    backgroundColor: '#FEF2F2',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonTextCancel: {
    color: '#64748B',
  },
  buttonTextDestructive: {
    color: '#EF4444',
  },
});
