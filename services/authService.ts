import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';

// API Configuration - Render backend
const API_BASE_URL = 'https://dts-logistics-backend-2.onrender.com/api';

// Enable mock mode for testing when backend is not available
const MOCK_MODE = false; // Set to true only for testing without backend

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config: any) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    // Only clear auth on actual 401 responses, not network errors
    if (error.response?.status === 401) {
      // Token expired or invalid, clear storage
      AsyncStorage.removeItem('authToken');
      AsyncStorage.removeItem('userData');
    }
    // Don't clear auth on network errors (when server is down)
    // This keeps user logged in even if server is temporarily unavailable
    return Promise.reject(error);
  }
);

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: number;
    name: string;
    username: string;
    role: string;
  };
  message?: string;
}

export interface UserData {
  id: number;
  name: string;
  username: string;
  role: string;
}

class AuthService {
  /**
   * Login driver with username and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // Mock mode for testing without backend
    if (MOCK_MODE) {
      console.log('Mock login attempt:', credentials);
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock validation
      if (credentials.username && credentials.password.length >= 6) {
        const mockUser = {
          id: 1,
          name: credentials.username,
          username: credentials.username,
          role: 'driver',
        };
        const mockToken = 'mock-jwt-token-' + Date.now();
        
        await AsyncStorage.setItem('authToken', mockToken);
        await AsyncStorage.setItem('userData', JSON.stringify(mockUser));
        
        return {
          success: true,
          token: mockToken,
          user: mockUser,
        };
      } else {
        return {
          success: false,
          message: 'Invalid credentials. Username required and password must be at least 6 characters.',
        };
      }
    }

    // Real API call
    try {
      console.log('Attempting login with:', credentials.username);
      console.log('API Base URL:', api.defaults.baseURL);
      const response = await api.post<AuthResponse>('/login', credentials);
      console.log('Login response:', response.data);

      if (response.data.success && response.data.token) {
        // Save token and user data
        await AsyncStorage.setItem('authToken', response.data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
        console.log('Login successful, token saved');

        // Also save to localStorage for web
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('authToken', response.data.token);
          localStorage.setItem('userData', JSON.stringify(response.data.user));
          console.log('Login data saved to localStorage');
        }
      } else {
        console.log('Login failed or no token:', response.data);
      }

      return response.data;
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code
      });

      if (error.response) {
        // Server responded with error
        return {
          success: false,
          message: error.response.data.message || 'Login failed. Please check your credentials.',
        };
      } else if (error.request) {
        // Request made but no response
        return {
          success: false,
          message: 'Network error. Cannot connect to server. Make sure Laravel server is running on port 8000.',
        };
      } else {
        // Other error
        return {
          success: false,
          message: 'An unexpected error occurred. Please try again.',
        };
      }
    }
  }

  /**
   * Logout driver
   */
  async logout(): Promise<void> {
    try {
      await api.post('/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API call result
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    // Check if running on web
    const isWeb = Platform.OS === 'web';
    
    // For web, check localStorage first (synchronous)
    if (isWeb && typeof window !== 'undefined' && window.localStorage) {
      const webToken = localStorage.getItem('authToken');
      console.log('Web auth check - token in localStorage:', !!webToken);
      if (webToken) return true;
    }
    
    // For mobile (Android/iOS), check AsyncStorage
    const token = await AsyncStorage.getItem('authToken');
    console.log('AsyncStorage auth check - token exists:', !!token);
    return !!token;
  }

  /**
   * Get stored user data
   */
  async getUserData(): Promise<UserData | null> {
    try {
      const userData = await AsyncStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  /**
   * Get auth token
   */
  async getToken(): Promise<string | null> {
    const token = await AsyncStorage.getItem('authToken');
    console.log('Retrieved token (first 30 chars):', token?.substring(0, 30));
    return token;
  }

  /**
   * Debug: Check all stored data
   */
  async debugStorage(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const items = await AsyncStorage.multiGet(keys);
    console.log('=== AsyncStorage Contents ===');
    items.forEach(([key, value]) => {
      console.log(`${key}:`, value?.substring(0, 50) + '...');
    });
    console.log('=============================');
  }

  /**
   * Clear all storage (for logout)
   */
  async clearStorage(): Promise<void> {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      console.log('Storage cleared');
      
      // Also clear localStorage for web
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('expo-auth-token');
        console.log('LocalStorage cleared');
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}

export default new AuthService();
