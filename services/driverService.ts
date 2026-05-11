import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const getApiBaseUrl = () => {
  // For web debugging
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return 'http://localhost:8000/api';
  }
  // For mobile, use the actual IP
  return 'http://10.26.16.24:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Driver status types
export type DriverStatus = 'available' | 'busy' | 'in_transit' | 'offline';

export interface DriverProfile {
  driver_id: number;
  user_id: number;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  status: DriverStatus;
  current_delivery_id?: number | null;
  current_delivery?: {
    delivery_id: number;
    tracking_number: string;
    pickup_address: string;
    delivery_address: string;
    status: string;
    client_name: string;
  } | null;
  vehicle_type?: string;
  license_number?: string;
  rating?: number;
  total_deliveries?: number;
  completed_deliveries?: number;
}

export interface DriverStatusResponse {
  success: boolean;
  driver?: DriverProfile;
  message?: string;
}

class DriverService {
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
   * Get current driver profile and status
   */
  async getDriverProfile(): Promise<DriverProfile | null> {
    try {
      const response = await this.api.get<DriverStatusResponse>('/driver/profile');
      if (response.data.success && response.data.driver) {
        return response.data.driver;
      }
      return null;
    } catch (error) {
      console.error('Error fetching driver profile:', error);
      return null;
    }
  }

  /**
   * Get driver status only
   */
  async getDriverStatus(): Promise<DriverStatus | null> {
    try {
      const response = await this.api.get<DriverStatusResponse>('/driver/status');
      if (response.data.success && response.data.driver) {
        return response.data.driver.status;
      }
      return null;
    } catch (error) {
      console.error('Error fetching driver status:', error);
      return null;
    }
  }

  /**
   * Update driver status
   * This is typically called automatically by the backend when delivery status changes,
   * but can be called manually if needed
   */
  async updateDriverStatus(status: DriverStatus): Promise<boolean> {
    try {
      const response = await this.api.put<DriverStatusResponse>('/driver/status', {
        status,
      });
      return response.data.success;
    } catch (error) {
      console.error('Error updating driver status:', error);
      return false;
    }
  }

  /**
   * Check if driver can accept new deliveries
   */
  canAcceptDeliveries(status: DriverStatus | null | undefined): boolean {
    if (!status) return false;
    return status === 'available';
  }

  /**
   * Check if driver is currently busy
   */
  isDriverBusy(status: DriverStatus | null | undefined): boolean {
    if (!status) return false;
    return status === 'busy' || status === 'in_transit';
  }

  /**
   * Get status display text
   */
  getStatusDisplay(status: DriverStatus | null | undefined): string {
    if (!status) return 'Unknown';
    const displays: Record<DriverStatus, string> = {
      available: 'Available',
      busy: 'Busy',
      in_transit: 'In Transit',
      offline: 'Offline',
    };
    return displays[status];
  }

  /**
   * Get status color for UI indicators
   */
  getStatusColor(status: DriverStatus | null | undefined): string {
    if (!status) return '#9CA3AF'; // gray
    const colors: Record<DriverStatus, string> = {
      available: '#10B981', // green
      busy: '#EF4444', // red
      in_transit: '#F59E0B', // orange/amber
      offline: '#6B7280', // gray
    };
    return colors[status];
  }

  /**
   * Format driver name
   */
  formatDriverName(driver: DriverProfile | null): string {
    if (!driver) return 'Unknown';
    return `${driver.firstname} ${driver.lastname}`.trim();
  }

  /**
   * Update driver current location
   * Call this every 5-10 seconds while driver is on duty
   */
  async updateLocation(
    latitude: number,
    longitude: number,
    speed?: number,
    heading?: number
  ): Promise<boolean> {
    try {
      const response = await this.api.post('/driver/location', {
        current_latitude: latitude,
        current_longitude: longitude,
        current_speed: speed ?? 0,
        heading: heading ?? 0,
      });
      return response.data.success ?? true;
    } catch (error) {
      console.error('Error updating driver location:', error);
      return false;
    }
  }

  /**
   * Get truck information for the current driver
   */
  async getDriverTruckInfo(): Promise<any | null> {
    try {
      const response = await this.api.get('/driver/profile');
      if (response.data.success && response.data.driver) {
        // Extract truck information from driver profile
        const driver = response.data.driver;
        
        // Use the enhanced truck information if available, otherwise fallback to legacy format
        if (driver.truck) {
          return {
            plate_number: driver.truck.plate_number || 'N/A',
            vehicle_type: driver.truck.vehicle_type || 'N/A',
            capacity: driver.truck.capacity || 'N/A',
            condition: driver.truck.condition || 'Good',
            last_maintenance: driver.truck.last_maintenance_date || 'N/A',
            next_inspection: driver.truck.next_inspection || 'N/A',
            insurance_status: driver.truck.insurance_status || 'N/A',
            truck_id: driver.truck.truck_id || driver.truck_id || null,
            truck_status: driver.truck.truck_status || 'unknown'
          };
        } else {
          // Fallback for legacy format or when no truck is assigned
          return {
            plate_number: driver.truck_id ? 'Assigned Truck' : 'No truck assigned',
            vehicle_type: driver.vehicle_type || 'N/A',
            capacity: 'N/A',
            condition: 'Unknown',
            last_maintenance: 'N/A',
            next_inspection: 'N/A',
            insurance_status: 'N/A',
            truck_id: driver.truck_id || null
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching truck information:', error);
      return null;
    }
  }
}

export const driverService = new DriverService();
export default driverService;
