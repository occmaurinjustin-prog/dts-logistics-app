import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const getApiBaseUrl = () => {
  // For web debugging
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return 'http://localhost:8000/api';
  }
  // For mobile, use the actual IP
  return 'http://10.65.49.24:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

export interface MaintenanceReportData {
  truckId: number;
  issueTitle: string;
  issueDescription: string;
  priorityLevel: 'low' | 'medium' | 'high' | 'emergency';
}

export interface MaintenanceReportResponse {
  success: boolean;
  message: string;
  report?: {
    id: number;
    issue_title: string;
    status: string;
    priority_level: string;
    created_at: string;
  };
}

class MaintenanceService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor() {
    // Add auth token to requests
    this.api.interceptors.request.use(async (config) => {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /**
   * Submit maintenance report from driver
   */
  async submitMaintenanceReport(reportData: MaintenanceReportData): Promise<MaintenanceReportResponse> {
    try {
      const response = await this.api.post('/driver/maintenance-report', reportData);
      return response.data;
    } catch (error: any) {
      console.error('Error submitting maintenance report:', error);
      
      // Handle different error types
      if (error.response) {
        // Server responded with error status
        return {
          success: false,
          message: error.response.data?.message || 'Failed to submit maintenance report',
        };
      } else if (error.request) {
        // Network error
        return {
          success: false,
          message: 'Network error. Please check your connection.',
        };
      } else {
        // Other error
        return {
          success: false,
          message: 'An unexpected error occurred.',
        };
      }
    }
  }

  /**
   * Get driver's maintenance reports history
   */
  async getMaintenanceReports(): Promise<any[]> {
    try {
      const response = await this.api.get('/driver/maintenance-reports');
      if (response.data.success) {
        return response.data.reports || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching maintenance reports:', error);
      return [];
    }
  }
}

export const maintenanceService = new MaintenanceService();
export default maintenanceService;
