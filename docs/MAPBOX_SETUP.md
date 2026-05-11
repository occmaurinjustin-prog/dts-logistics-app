# Mapbox Real-Time Tracking Setup Guide

## Step-by-Step Installation

### 1. Install Dependencies
```bash
cd c:\laragon\www\DRIVER_APP

# Install Mapbox SDK
npx expo install @rnmapbox/maps

# Install Expo Location
npx expo install expo-location

# Install dependencies
npm install
```

### 2. Get Mapbox Tokens
1. Go to https://studio.mapbox.com/
2. Sign up / Log in
3. Go to **Tokens** section
4. Copy your **Public Token** (starts with `pk.`)
5. Create a **Secret Token** for downloads (starts with `sk.`)

### 3. Configure Tokens
Update these files with your tokens:

**constants/mapbox.ts:**
```typescript
export const MAPBOX_ACCESS_TOKEN = 'pk.YOUR_PUBLIC_TOKEN_HERE';
```

**app.json:**
```json
"RNMapboxMapsDownloadToken": "sk.YOUR_SECRET_TOKEN_HERE"
```

**components/MapboxNavigationMap.tsx:**
```typescript
MapboxGL.setAccessToken('pk.YOUR_PUBLIC_TOKEN_HERE');
```

### 4. Update Navigation Page

Replace the map placeholder in `app/(tabs)/navigation.tsx`:

```tsx
import MapboxNavigationMap from '@/components/MapboxNavigationMap';

// ... in your render, replace the map placeholder with:
<MapboxNavigationMap
  stops={navSteps.map((step, index) => ({
    id: step.id,
    latitude: 14.2081 + (index * 0.01), // Replace with real coordinates
    longitude: 121.1544 + (index * 0.01), // Replace with real coordinates
    name: step.name,
    type: step.type,
    address: step.address,
  }))}
  currentLocation={location}
  currentStopIndex={currentStep}
  isNavigating={isNavigating}
/>
```

### 5. Get Real Coordinates from Your Backend

Update your Laravel API to include coordinates:

```php
// In your Delivery resource/API response
return [
    'delivery_id' => $this->delivery_id,
    'pickup_address' => $this->pickup_address,
    'pickup_latitude' => $this->pickup_latitude,  // Add this
    'pickup_longitude' => $this->pickup_longitude, // Add this
    'delivery_address' => $this->delivery_address,
    'delivery_latitude' => $this->delivery_latitude,  // Add this
    'delivery_longitude' => $this->delivery_longitude, // Add this
    // ... other fields
];
```

### 6. Run on Your Phone

```bash
# Clear cache and rebuild
npx expo start --clear

# Scan QR code with Expo Go app
# OR build development client:
npx expo run:android  # for Android
npx expo run:ios        # for iOS
```

## Features You'll Get

✅ Real-time GPS tracking (updates every 5 meters / 2 seconds)  
✅ Turn-by-turn navigation map with route line  
✅ Shows current location with direction arrow  
✅ Stop markers with numbers (blue = pickup, green = delivery)  
✅ Camera follows driver during navigation  
✅ Route polyline showing path to destination  

## Troubleshooting

### "Cannot find module" errors
Run: `npx expo install @rnmapbox/maps expo-location`

### Map not showing (blank/gray)
- Check your Mapbox token is valid
- Make sure you have internet connection
- Check for errors in console

### GPS not working
- Enable location permission in phone settings
- Make sure GPS is turned on
- Go outside for better satellite signal

### Build fails on Android
```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

## Need Real Addresses to Coordinates?

Use Mapbox Geocoding API to convert addresses:
```typescript
const geocodeAddress = async (address: string) => {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_ACCESS_TOKEN}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.features[0]?.center; // [longitude, latitude]
};
```
