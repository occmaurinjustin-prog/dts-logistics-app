import authService from '@/services/authService';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function LoginScreen() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [focusedField, setFocusedField] = useState<
    'username' | 'password' | null
  >(null);

  const [rememberMe, setRememberMe] = useState(false);

  // ERRORS
  const [errors, setErrors] = useState({
    username: '',
    password: '',
    general: '',
  });

  // VALIDATION
  const validateInputs = (): boolean => {
    let valid = true;

    const newErrors = {
      username: '',
      password: '',
      general: '',
    };

    // EMAIL VALIDATION
    if (!username.trim()) {
      newErrors.username = 'Email is required';
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(username)) {
      newErrors.username = 'Invalid email format';
      valid = false;
    }

    // PASSWORD VALIDATION
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

  // LOGIN
  const handleLogin = async () => {
    // CLEAR OLD ERRORS
    setErrors({
      username: '',
      password: '',
      general: '',
    });

    // VALIDATE
    if (!validateInputs()) {
      return;
    }

    // PREVENT DOUBLE CLICK
    if (isLoading) return;

    setIsLoading(true);

    try {
      const response = await authService.login({
        username: username.trim(),
        password,
      });

      // SUCCESS
      if (response.success) {
        console.log('Login successful');
        console.log('Response user:', response.user);
        console.log('Response user role:', response.user?.role);

        const isWeb = Platform.OS === 'web';
        const userRole = response.user?.role;

        console.log('Is Web:', isWeb);
        console.log('User Role:', userRole);
        console.log('Is Mechanic:', userRole === 'mechanic');

        if (
          isWeb &&
          typeof window !== 'undefined' &&
          typeof window.location?.href === 'string'
        ) {
          const targetRoute = userRole === 'mechanic' ? '/(mechanic-tabs)' : '/(tabs)';
          console.log('Redirecting to (web):', targetRoute);
          window.location.href = targetRoute;
        } else {
          setTimeout(() => {
            const targetRoute = userRole === 'mechanic' ? '/(mechanic-tabs)' : '/(tabs)';
            console.log('Redirecting to (mobile):', targetRoute);
            router.replace(targetRoute as any);
          }, 500);
        }
      } else {
        // INVALID CREDENTIALS
        if (
          response.message?.toLowerCase().includes('invalid credentials')
        ) {
          setErrors((prev) => ({
            ...prev,
            password: 'Incorrect password',
          }));
        } else {
          setErrors((prev) => ({
            ...prev,
            general: response.message || 'Login failed',
          }));
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);

      // AXIOS 422 ERROR
      if (error.response?.status === 422) {
        const message =
          error.response?.data?.message || 'Invalid credentials';

        if (message.toLowerCase().includes('invalid credentials')) {
          setErrors((prev) => ({
            ...prev,
            password: 'Incorrect password',
          }));
        } else {
          setErrors((prev) => ({
            ...prev,
            password: message,
          }));
        }
      } else {
        setErrors((prev) => ({
          ...prev,
          general: 'Server error. Please try again.',
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // FORGOT PASSWORD
  const handleForgotPassword = () => {
    Alert.alert(
      'Reset Password',
      'Password reset functionality will be implemented.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* TITLE */}
            <Text style={styles.title}>DTS Driver App</Text>

            <Text style={styles.subtitle}>
              Access your delivery dashboard
            </Text>

            {/* GENERAL ERROR */}
            {errors.general ? (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color="#DC2626"
                />

                <Text style={styles.errorText}>
                  {errors.general}
                </Text>
              </View>
            ) : null}

            {/* EMAIL */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Email</Text>

              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'username' &&
                    styles.inputContainerFocused,
                  errors.username && styles.inputError,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={
                    focusedField === 'username'
                      ? '#9CA3AF'
                      : '#3BC240'
                  }
                />

                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);

                    // CLEAR EMAIL ERROR
                    if (errors.username) {
                      setErrors((prev) => ({
                        ...prev,
                        username: '',
                      }));
                    }
                  }}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              {/* EMAIL ERROR */}
              {errors.username ? (
                <Text style={styles.validationText}>
                  {errors.username}
                </Text>
              ) : null}
            </View>

            {/* PASSWORD */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Password</Text>

              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'password' &&
                    styles.inputContainerFocused,
                  errors.password && styles.inputError,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={
                    focusedField === 'password'
                      ? '#9CA3AF'
                      : '#3BC240'
                  }
                />

                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);

                    // CLEAR PASSWORD ERROR
                    if (errors.password) {
                      setErrors((prev) => ({
                        ...prev,
                        password: '',
                      }));
                    }
                  }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  onPress={() =>
                    setIsPasswordVisible(!isPasswordVisible)
                  }
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={
                      isPasswordVisible
                        ? 'eye-outline'
                        : 'eye-off-outline'
                    }
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>

              {/* PASSWORD ERROR */}
              {errors.password ? (
                <Text style={styles.validationText}>
                  {errors.password}
                </Text>
              ) : null}
            </View>

            {/* REMEMBER ME */}
            <View style={styles.rememberForgotContainer}>
              <TouchableOpacity
                onPress={() => setRememberMe(!rememberMe)}
                style={styles.checkboxContainer}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}
                >
                  {rememberMe && (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color="#3BC240"
                    />
                  )}
                </View>

                <Text style={styles.checkboxLabel}>
                  Remember me
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleForgotPassword}
              >
                <Text style={styles.forgotPasswordText}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* LOGIN BUTTON */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              style={[
                styles.signInButton,
                isLoading && styles.signInButtonDisabled,
              ]}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator
                  color="#FFFFFF"
                  size="small"
                />
              ) : (
                <Text style={styles.signInButtonText}>
                  Sign In
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#3BC240',
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#070907',
    marginBottom: 8,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: '#070907',
    marginBottom: 32,
    textAlign: 'center',
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },

  fieldContainer: {
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#070907',
    marginBottom: 8,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#3BC240',
  },

  inputContainerFocused: {
    borderColor: '#9CA3AF',
    borderWidth: 1.5,
  },

  inputError: {
    borderColor: '#DC2626',
  },

  input: {
    flex: 1,
    color: '#54698c',
    fontSize: 15,
    marginLeft: 10,
  },

  eyeIcon: {
    padding: 4,
  },

  validationText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 4,
  },

  rememberForgotContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },

  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#3BC240',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  checkboxChecked: {
    backgroundColor: '#FFFFFF',
    borderColor: '#3BC240',
  },

  checkboxLabel: {
    fontSize: 14,
    color: '#3BC240',
  },

  forgotPasswordText: {
    color: '#3BC240',
    fontSize: 14,
    fontWeight: '500',
  },

  signInButton: {
    backgroundColor: '#3BC240',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#3BC240',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  signInButtonDisabled: {
    opacity: 0.7,
  },

  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});