import Constants from 'expo-constants';

/**
 * Base URL for the Laravel API used by the mobile app.
 * Reads from Expo `extra` config or defaults to the Android emulator address.
 */
export const API_URL: string =
  (Constants.manifest?.extra?.API_URL as string) ??
  'http://10.0.2.2:8000/api';
