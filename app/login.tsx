import authService from '@/services/authService';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const BG_IMAGE = 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=1200';

export default function LoginScreen() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [errors, setErrors] = useState({
    username: '',
    password: '',
    general: '',
  });

  const validateInputs = (): boolean => {
    let valid = true;
    const newErrors = { username: '', password: '', general: '' };

    if (!username.trim()) {
      newErrors.username = 'Email is required';
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(username)) {
      newErrors.username = 'Invalid email format';
      valid = false;
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
      valid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleLogin = async () => {
    setErrors({ username: '', password: '', general: '' });

    if (!validateInputs()) return;
    if (isLoading) return;

    setIsLoading(true);

    try {
      const response = await authService.login({
        username: username.trim(),
        password,
      });

      if (response.success) {
        const isWeb = Platform.OS === 'web';
        const userRole = response.user?.role;
        const targetRoute = userRole === 'mechanic' ? '/(mechanic-tabs)' : '/(tabs)';

        if (isWeb && typeof window !== 'undefined' && typeof window.location?.href === 'string') {
          window.location.href = targetRoute;
        } else {
          setTimeout(() => {
            router.replace(targetRoute as any);
          }, 500);
        }
      } else {
        if (response.message?.toLowerCase().includes('invalid credentials')) {
          setErrors(prev => ({ ...prev, password: 'Incorrect password' }));
        } else {
          setErrors(prev => ({ ...prev, general: response.message || 'Login failed' }));
        }
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        const message = error.response?.data?.message || 'Invalid credentials';
        if (message.toLowerCase().includes('invalid credentials')) {
          setErrors(prev => ({ ...prev, password: 'Incorrect password' }));
        } else {
          setErrors(prev => ({ ...prev, password: message }));
        }
      } else {
        setErrors(prev => ({ ...prev, general: 'Server error. Please try again.' }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('Reset Password', 'Password reset functionality will be implemented.', [{ text: 'OK' }]);
  };

  return (
    <View style={s.bg}>
      <ImageBackground source={{ uri: BG_IMAGE }} style={StyleSheet.absoluteFillObject} blurRadius={Platform.OS === 'ios' ? 8 : 3} />
      <View style={s.overlay} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.keyboardContainer}>
        <ScrollView 
          contentContainerStyle={s.scrollContent} 
          keyboardShouldPersistTaps="always" 
          showsVerticalScrollIndicator={false}
        >
          
          <View style={s.headerWrap}>
            <View style={s.logoWrap}>
              <Ionicons name="cube" size={42} color="#10B981" />
            </View>
            <Text style={s.brandTitle}>DTS Fleet</Text>
            <Text style={s.brandSubtitle}>Intelligent Logistics Management</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Welcome Back</Text>
            <Text style={s.cardSubtitle}>Sign in to your driver or mechanic account</Text>

            {errors.general ? (
              <View style={s.errorAlert}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                <Text style={s.errorAlertText}>{errors.general}</Text>
              </View>
            ) : null}

            {/* EMAIL */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Email Address</Text>
              <View style={[s.inputWrap, errors.username ? s.inputWrapError : null]}>
                <Ionicons name="mail-outline" size={20} color="#94A3B8" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#94A3B8"
                  value={username}
                  onChangeText={text => {
                    setUsername(text);
                    if (errors.username) setErrors(prev => ({ ...prev, username: '' }));
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
              {errors.username ? <Text style={s.errorText}>{errors.username}</Text> : null}
            </View>

            {/* PASSWORD */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Password</Text>
              <View style={[s.inputWrap, errors.password ? s.inputWrapError : null]}>
                <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={text => {
                    setPassword(text);
                    if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                  }}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={s.eyeIcon}>
                  <Ionicons name={isPasswordVisible ? 'eye-outline' : 'eye-off-outline'} size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={s.errorText}>{errors.password}</Text> : null}
            </View>

            {/* REMEMBER & FORGOT */}
            <View style={s.rowBetween}>
              <TouchableOpacity onPress={() => setRememberMe(!rememberMe)} style={s.rowCenter} activeOpacity={0.7}>
                <View style={[s.checkbox, rememberMe && s.checkboxActive]}>
                  {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={s.checkboxLabel}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={s.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* LOGIN BUTTON */}
            <TouchableOpacity onPress={handleLogin} disabled={isLoading} style={[s.btn, isLoading && s.btnDisabled]} activeOpacity={0.8}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={s.btnText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          </View>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0F172A' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.75)' },
  keyboardContainer: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  headerWrap: { alignItems: 'center', marginBottom: 40, marginTop: Platform.OS === 'ios' ? 40 : 20 },
  logoWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  brandTitle: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  brandSubtitle: { fontSize: 14, color: '#94A3B8', fontWeight: '500', marginTop: 4, letterSpacing: 0.5 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.15, shadowRadius: 32, elevation: 10 },
  cardTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 6, letterSpacing: -0.5 },
  cardSubtitle: { fontSize: 14, color: '#64748B', fontWeight: '500', marginBottom: 32 },

  errorAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: '#FECACA' },
  errorAlertText: { color: '#DC2626', fontSize: 14, fontWeight: '500', marginLeft: 8, flex: 1 },

  fieldWrap: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 16, height: 56, borderWidth: 1.5, borderColor: '#E2E8F0' },
  inputWrapError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#0F172A', fontSize: 16, fontWeight: '500', height: '100%' },
  eyeIcon: { padding: 8, marginRight: -8 },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '600', marginTop: 6, marginLeft: 4 },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 32 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkboxActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  checkboxLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  forgotText: { color: '#10B981', fontSize: 14, fontWeight: '700' },

  btn: { backgroundColor: '#10B981', borderRadius: 16, height: 56, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
