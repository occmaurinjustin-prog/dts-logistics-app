import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { driverService } from './driverService';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

try {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('Background Location Error:', error);
      return;
    }
    
    if (data) {
      const { locations } = data as { locations: Location.LocationObject[] };
      if (locations && locations.length > 0) {
        const newLocation = locations[0];
        const { latitude, longitude, speed, heading } = newLocation.coords;
        
        console.log('🌍 Background Location Update:', latitude, longitude);

        try {
          // Send to server
          const success = await driverService.updateLocation(
            latitude, 
            longitude, 
            speed || 0, 
            heading || 0, 
            true
          );

          if (!success) {
            console.warn('📦 Background Location QUEUED OFFLINE:', latitude, longitude);
          }
        } catch (err) {
          console.error('Failed to send background location:', err);
        }
      }
    }
  });
} catch (e) {
  console.error('TaskManager.defineTask failed:', e);
}
