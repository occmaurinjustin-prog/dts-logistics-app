import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';

const getApiBaseUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:8000/api';
  }
  return 'http://10.65.49.24:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

export interface RescueRequestMedia {
  id: number;
  file_path: string;
  media_type: 'photo' | 'video';
  type: 'before' | 'after';
}

export interface RescueRequest {
  id: number;
  driver_id: number;
  truck_id: number;
  delivery_id?: number | null;
  waybill?: string | null;
  latitude: number;
  longitude: number;
  address: string;
  categories: string[];
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  is_drivable: boolean;
  status: 'pending' | 'assigned' | 'accepted' | 'on_the_way' | 'arrived' | 'inspection_started' | 'repair_in_progress' | 'waiting_for_parts' | 'repair_completed' | 'cannot_repair' | 'closed';
  mechanic_id?: number | null;
  eta_minutes?: number | null;
  inspection_findings?: string | null;
  repair_notes?: string | null;
  media?: RescueRequestMedia[];
  truck?: {
    plate_number: string;
    vehicle_type: string;
  };
  mechanic?: {
    firstname: string;
    lastname: string;
    contact_number: string;
    current_latitude?: number | null;
    current_longitude?: number | null;
  } | null;
  driver?: {
    user?: {
      firstname: string;
      lastname: string;
      contact_number: string;
    };
  };
  created_at: string;
}

class RescueService {
  private api = axios.create({
    baseURL: API_BASE_URL,
  });

  constructor() {
    this.api.interceptors.request.use(async (config) => {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /**
   * Driver submits a breakdown rescue request
   */
  async submitRescueRequest(formData: FormData): Promise<{ success: boolean; message?: string; rescue_request?: RescueRequest }> {
    try {
      const response = await this.api.post('/rescue/request', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error submitting rescue request:', error);
      return { success: false, message: error.response?.data?.message || 'Failed to submit request' };
    }
  }

  /**
   * Get current active rescue request for driver
   */
  async getActiveRescueRequest(): Promise<RescueRequest | null> {
    try {
      const response = await this.api.get('/rescue/active');
      if (response.data.success && response.data.rescue_request) {
        return response.data.rescue_request;
      }
      return null;
    } catch (error) {
      console.error('Error fetching active rescue:', error);
      return null;
    }
  }

  /**
   * Driver confirms repair and closes request
   */
  async confirmClose(rescueRequestId: number): Promise<boolean> {
    try {
      const response = await this.api.post('/rescue/confirm-close', { rescue_request_id: rescueRequestId });
      return response.data.success;
    } catch (error) {
      console.error('Error closing rescue:', error);
      return false;
    }
  }

  /**
   * Mechanic retrieves assigned active rescue job
   */
  async getMechanicAssignments(): Promise<RescueRequest | null> {
    try {
      const response = await this.api.get('/rescue/mechanic/assignments');
      if (response.data.success && response.data.rescue_request) {
        return response.data.rescue_request;
      }
      return null;
    } catch (error) {
      console.error('Error fetching mechanic assignments:', error);
      return null;
    }
  }

  /**
   * Mechanic accepts/rejects the assignment
   */
  async respondToAssignment(rescueRequestId: number, responseType: 'accept' | 'reject'): Promise<boolean> {
    try {
      const response = await this.api.post('/rescue/mechanic/respond', {
        rescue_request_id: rescueRequestId,
        response: responseType,
      });
      return response.data.success;
    } catch (error) {
      console.error('Error responding to assignment:', error);
      return false;
    }
  }

  /**
   * Mechanic updates status, notes, findings, photos
   */
  async updateRescueStatus(formData: FormData): Promise<boolean> {
    try {
      const response = await this.api.post('/rescue/mechanic/status', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.success;
    } catch (error) {
      console.error('Error updating status:', error);
      return false;
    }
  }

  /**
   * Mechanic updates location
   */
  async updateLocation(latitude: number, longitude: number): Promise<boolean> {
    try {
      const response = await this.api.post('/rescue/mechanic/location', { latitude, longitude });
      return response.data.success;
    } catch (error) {
      console.error('Error updating mechanic location:', error);
      return false;
    }
  }
}

export const rescueService = new RescueService();
export default rescueService;
