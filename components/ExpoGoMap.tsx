import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

const { width, height } = Dimensions.get('window');

type NavigationPhase = 'preview' | 'pickup' | 'delivery' | 'complete';

interface Stop {
  id: number;
  latitude: number;
  longitude: number;
  name: string;
  type: 'pickup' | 'delivery';
  address: string;
}

interface ExpoGoMapProps {
  stops: Stop[];
  currentLocation?: Location.LocationObject | null;
  isNavigating?: boolean;
  navigationPhase?: NavigationPhase;
  showRouteLine?: boolean;
  heading?: number | null;
  onRecenter?: () => void;
}

// Generate map HTML with Leaflet Routing Machine for real road-following routes
const generateMapHTML = (
  stops: Stop[],
  initialLocation: Location.LocationObject | null | undefined,
  navigationPhase: NavigationPhase = 'preview',
  showRouteLine: boolean = false,
  heading: number | null = null,
  isNavigating: boolean = false
) => {
  // Default center (Manila fallback)
  let centerLat = 14.5995;
  let centerLng = 120.9842;
  let zoom = 13;

  // Helper to check if coordinate is valid
  const isValidCoord = (val: number | null | undefined): val is number => {
    return val !== null && val !== undefined && !isNaN(val) && isFinite(val) && val !== 0;
  };

  // Filter valid stops
  const validStops = stops.filter(s =>
    isValidCoord(s.latitude) &&
    isValidCoord(s.longitude) &&
    Math.abs(s.latitude) <= 90 &&
    Math.abs(s.longitude) <= 180
  );

  // Get active stops based on navigation phase
  let activeStops: Stop[] = [];
  let targetStop: Stop | null = null;
  let pickupStop: Stop | null = null;
  let deliveryStop: Stop | null = null;

  if (validStops.length >= 2) {
    pickupStop = validStops.find(s => s.type === 'pickup') || validStops[0];
    deliveryStop = validStops.find(s => s.type === 'delivery') || validStops[1];

    switch (navigationPhase) {
      case 'preview':
        activeStops = [pickupStop, deliveryStop].filter((s): s is Stop => s !== null) as Stop[];
        break;
      case 'pickup':
        activeStops = pickupStop ? [pickupStop] : [];
        targetStop = pickupStop;
        break;
      case 'delivery':
        activeStops = deliveryStop ? [deliveryStop] : [];
        targetStop = deliveryStop;
        break;
      case 'complete':
        activeStops = [];
        break;
    }
  } else if (validStops.length === 1) {
    activeStops = validStops;
    targetStop = validStops[0];
  }

  // PRIORITY 1: Use driver GPS location if available
  if (initialLocation &&
      isValidCoord(initialLocation.coords.latitude) &&
      isValidCoord(initialLocation.coords.longitude)) {
    centerLat = initialLocation.coords.latitude;
    centerLng = initialLocation.coords.longitude;
    zoom = isNavigating ? 17 : 15;
  }
  // PRIORITY 2: Center on stops if no driver location
  else if (validStops.length > 0) {
    const validCoords = validStops.filter(s => isValidCoord(s.latitude) && isValidCoord(s.longitude));
    if (validCoords.length > 0) {
      const sumLat = validCoords.reduce((sum, s) => sum + s.latitude, 0);
      const sumLng = validCoords.reduce((sum, s) => sum + s.longitude, 0);
      centerLat = sumLat / validCoords.length;
      centerLng = sumLng / validCoords.length;
      if (isNaN(centerLat) || isNaN(centerLng)) {
        centerLat = 14.5995;
        centerLng = 120.9842;
      }
      zoom = navigationPhase === 'preview' ? 13 : 16;
    }
  }

  // Build markers JavaScript
  let markersJS = '';
  const stopsToShow = navigationPhase === 'preview' ? validStops : activeStops;

  stopsToShow.forEach((stop) => {
    if (!stop || stop.latitude === 0 || stop.longitude === 0) return;
    const isPickup = stop.type === 'pickup';
    const bgColor = isPickup ? '#16A34A' : '#EF4444';
    const iconSvg = isPickup
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

    markersJS += `
      try {
        const markerIcon${stop.id} = L.divIcon({
          className: 'custom-marker-${stop.type}',
          html: '<div style="position:relative;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4));"><div style="width:44px;height:44px;background:${bgColor};border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);"><div style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;">${iconSvg}</div></div><div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid ${bgColor};"></div></div>',
          iconSize: [44, 56],
          iconAnchor: [22, 56]
        });
        const marker${stop.id} = L.marker([${stop.latitude}, ${stop.longitude}], { icon: markerIcon${stop.id}, zIndexOffset: 100 }).addTo(map);
        marker${stop.id}.bindPopup('<div style="font-family:system-ui,sans-serif;padding:8px;"><div style="font-weight:700;font-size:15px;color:${bgColor};margin-bottom:4px;">${isPickup ? 'PICKUP' : 'DELIVERY'}</div><div style="font-size:14px;color:#374151;line-height:1.4;">${stop.address}</div></div>', { closeButton: false });
      } catch(e) { console.log('Marker error:', e); }
    `;
  });

  const driverHeading = heading || 0;
  const finalCenterLat = isNaN(centerLat) ? 14.5995 : centerLat;
  const finalCenterLng = isNaN(centerLng) ? 120.9842 : centerLng;
  const finalZoom = isNaN(zoom) ? 13 : zoom;

  // Determine if we should show routing
  const showRouting = isNavigating && targetStop && initialLocation &&
    isValidCoord(initialLocation.coords.latitude) &&
    isValidCoord(initialLocation.coords.longitude);
  
  // Show preview route connecting pickup and delivery even when not navigating
  const showPreviewRoute = !isNavigating && pickupStop && deliveryStop &&
    isValidCoord(pickupStop.latitude) && isValidCoord(pickupStop.longitude) &&
    isValidCoord(deliveryStop.latitude) && isValidCoord(deliveryStop.longitude);

  const driverLat = initialLocation?.coords.latitude || finalCenterLat;
  const driverLng = initialLocation?.coords.longitude || finalCenterLng;
  const targetLat = targetStop?.latitude || 0;
  const targetLng = targetStop?.longitude || 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Navigation Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #map { width: 100%; height: 100%; background: #f8fafc; }
    .leaflet-control-attribution { font-size: 9px; opacity: 0.7; }

    /* Hide default routing UI */
    .leaflet-routing-container {
      display: none !important;
    }
    .leaflet-routing-alternatives-container {
      display: none !important;
    }

    /* Custom Route Line Styling */
    .leaflet-routing-line {
      stroke: #2563EB !important;
      stroke-width: 6px !important;
      stroke-opacity: 0.9 !important;
      stroke-linecap: round !important;
      stroke-linejoin: round !important;
      filter: drop-shadow(0 2px 4px rgba(37, 99, 235, 0.4)) !important;
    }

    /* Driver Marker */
    .driver-marker-container {
      position: relative;
      z-index: 1000;
    }
    .driver-marker-arrow {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.5), 0 0 0 4px rgba(59, 130, 246, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease;
    }
    .driver-marker-arrow svg {
      width: 18px;
      height: 18px;
      fill: white;
    }
    .driver-marker-pulse {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 60px;
      height: 60px;
      background: rgba(59, 130, 246, 0.3);
      border-radius: 50%;
      animation: driverPulse 2s ease-out infinite;
      pointer-events: none;
    }
    @keyframes driverPulse {
      0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
    }

    /* Navigation Progress Dot */
    .nav-progress-dot {
      width: 14px;
      height: 14px;
      background: white;
      border: 3px solid #2563EB;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.6);
      animation: navPulse 1s ease-in-out infinite;
    }
    @keyframes navPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.3); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    try {
      let map;
      let driverMarker = null;
      let routingControl = null;
      let driverHeading = ${driverHeading};
      let navProgressMarker = null;

      // Validate center
      const centerLat = ${finalCenterLat};
      const centerLng = ${finalCenterLng};
      const zoom = ${finalZoom};

      if (isNaN(centerLat) || isNaN(centerLng)) {
        throw new Error('Invalid map center coordinates');
      }

      // Initialize map
      map = L.map('map', {
        center: [centerLat, centerLng],
        zoom: zoom,
        zoomControl: false,
        attributionControl: true
      });

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors',
        maxZoom: 20
      }).addTo(map);

      ${markersJS}

      // Driver marker function
      function createDriverIcon(heading) {
        return L.divIcon({
          className: 'driver-marker-container',
          html: '<div class="driver-marker-pulse"></div><div class="driver-marker-arrow" style="transform: rotate(' + heading + 'deg);"><svg viewBox="0 0 24 24" style="transform: rotate(-90deg);"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg></div>',
          iconSize: [60, 60],
          iconAnchor: [30, 30]
        });
      }

      // Initialize driver position
      ${initialLocation && isValidCoord(initialLocation.coords.latitude) ? `
      driverMarker = L.marker([${driverLat}, ${driverLng}], {
        icon: createDriverIcon(${driverHeading}),
        zIndexOffset: 2000
      }).addTo(map);
      ` : ''}

      // Preview route - show line connecting pickup to delivery even when not navigating
      ${showPreviewRoute ? `
      try {
        // Draw a simple preview line from pickup to delivery
        const previewCoords = [
          [${pickupStop?.latitude || 0}, ${pickupStop?.longitude || 0}],
          [${deliveryStop?.latitude || 0}, ${deliveryStop?.longitude || 0}]
        ];
        
        window.previewRouteLine = L.polyline(previewCoords, {
          color: '#60A5FA',
          weight: 4,
          opacity: 0.6,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '10, 10'
        }).addTo(map);
        
        console.log('Preview route drawn');
      } catch(e) {
        console.log('Preview route error:', e);
      }
      ` : ''}

      // Setup Routing if navigating
      ${showRouting ? `
      try {
        // Create waypoints for routing
        const startPoint = L.latLng(${driverLat}, ${driverLng});
        const endPoint = L.latLng(${targetLat}, ${targetLng});

        // Initialize routing control with OSRM
        routingControl = L.Routing.control({
          waypoints: [startPoint, endPoint],
          router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1'
          }),
          show: false, // Hide default UI panel
          addWaypoints: false, // Disable adding waypoints
          draggableWaypoints: false, // Disable dragging
          fitSelectedRoutes: true,
          lineOptions: {
            styles: [{ color: '#2563EB', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }],
            extendToWaypoints: true,
            missingRouteTolerance: 100
          },
          createMarker: function() { return null; } // Don't create default markers
        }).addTo(map);

        // Listen for route found event
        routingControl.on('routesfound', function(e) {
          console.log('Route found with ' + e.routes[0].coordinates.length + ' points');

          // Add animated progress dot
          const route = e.routes[0];
          const coords = route.coordinates;

          if (coords.length > 0 && !navProgressMarker) {
            const progressIcon = L.divIcon({
              className: 'nav-progress-container',
              html: '<div class="nav-progress-dot"></div>',
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            });

            navProgressMarker = L.marker(coords[0], {
              icon: progressIcon,
              zIndexOffset: 1500
            }).addTo(map);

            // Animate along route
            let progressIndex = 0;
            window.navProgressInterval = setInterval(function() {
              if (navProgressMarker && coords.length > 0) {
                progressIndex = (progressIndex + 1) % coords.length;
                navProgressMarker.setLatLng(coords[progressIndex]);
              }
            }, 100);
          }
        });

        console.log('Routing control initialized');
      } catch(e) {
        console.log('Routing setup error:', e);
      }
      ` : ''}

      // Update driver location
      window.updateDriverLocation = function(lat, lng, newHeading, timestamp) {
        if (!lat || !lng || lat === 0 || lng === 0) return;
        try {
          driverHeading = newHeading || driverHeading || 0;

          if (driverMarker) {
            driverMarker.setLatLng([lat, lng]);
            driverMarker.setIcon(createDriverIcon(driverHeading));
          } else {
            driverMarker = L.marker([lat, lng], {
              icon: createDriverIcon(driverHeading),
              zIndexOffset: 2000
            }).addTo(map);
          }

          // Update routing if active
          if (routingControl && window.isNavigating) {
            const newStart = L.latLng(lat, lng);
            const currentEnd = routingControl.getWaypoints()[1];
            if (currentEnd && currentEnd.latLng) {
              routingControl.setWaypoints([newStart, currentEnd.latLng]);
            }
          }
        } catch(e) { console.log('Driver update error:', e); }
      };

      // Recenter map with smooth panning
      // Smooth pan to driver without zoom jumps
      window.recenterOnDriver = function() {
        if (driverMarker && map && typeof map.panTo === 'function') {
          const pos = driverMarker.getLatLng();
          map.panTo(pos, { animate: true, duration: 0.5, easeLinearity: 0.25 });
        }
      };
      
      // Smooth zoom function
      window.setZoom = function(targetZoom) {
        if (map && typeof map.setZoom === 'function') {
          map.setZoom(targetZoom, { animate: true, duration: 0.5 });
        }
      };

      // Set navigation mode
      window.setNavigationMode = function(active) {
        window.isNavigating = active;
        
        if (active) {
          // Remove preview route when navigation starts
          if (window.previewRouteLine) {
            map.removeLayer(window.previewRouteLine);
            window.previewRouteLine = null;
          }
        } else {
          // Reset route fit flag when navigation stops
          window.hasFittedRoute = false;
          // Cleanup
          if (window.navProgressInterval) {
            clearInterval(window.navProgressInterval);
            window.navProgressInterval = null;
          }
          if (navProgressMarker) {
            map.removeLayer(navProgressMarker);
            navProgressMarker = null;
          }
          if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
          }
        }
      };

      // Zoom controls with smooth animation
      window.zoomIn = function() {
        if (map && typeof map.zoomIn === 'function') {
          map.zoomIn({ animate: true, duration: 0.5 });
        }
      };
      window.zoomOut = function() {
        if (map && typeof map.zoomOut === 'function') {
          map.zoomOut({ animate: true, duration: 0.5 });
        }
      };

      console.log('Map initialized with Leaflet Routing Machine');
    } catch (error) {
      console.error('Map error:', error);
      document.getElementById('map').innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%;background:#f8fafc;color:#64748b;font-family:sans-serif;padding:20px;text-align:center;"><div>⚠️ Map Error</div><div style="font-size:14px;opacity:0.8;">' + error.message + '</div></div>';
    }
  </script>
</body>
</html>
  `;
};

export default function ExpoGoMap({
  stops,
  currentLocation,
  isNavigating = false,
  navigationPhase = 'preview',
  showRouteLine = false,
  heading = null,
  onRecenter,
}: ExpoGoMapProps) {
  const webViewRef = useRef<WebView>(null);
  const fullscreenWebViewRef = useRef<WebView>(null);
  const [html, setHtml] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prevLocationRef = useRef<Location.LocationObject | null>(null);
  const prevHeadingRef = useRef<number>(0);
  const htmlRef = useRef<string>('');
  const stopsRef = useRef(stops);
  const navPhaseRef = useRef(navigationPhase);

  // Get active WebView ref based on fullscreen state
  const getActiveWebView = () => isFullscreen ? fullscreenWebViewRef.current : webViewRef.current;

  const isNavigatingRef = useRef(isNavigating);
  const lastRouteFetchRef = useRef<number>(0);
  const cachedRouteRef = useRef<{start: {lat: number, lng: number}, end: {lat: number, lng: number}, points: number[][]} | null>(null);
  
  // Generate HTML only when stops or navigation phase actually changes
  useEffect(() => {
    // Only regenerate HTML if stops, navigation phase, or isNavigating changed
    const stopsChanged = JSON.stringify(stopsRef.current) !== JSON.stringify(stops);
    const phaseChanged = navPhaseRef.current !== navigationPhase;
    const navChanged = isNavigatingRef.current !== isNavigating;
    
    if (!htmlRef.current || stopsChanged || phaseChanged || navChanged) {
      stopsRef.current = stops;
      navPhaseRef.current = navigationPhase;
      isNavigatingRef.current = isNavigating;
      const initialHTML = generateMapHTML(stops, currentLocation, navigationPhase, showRouteLine, heading, isNavigating);
      htmlRef.current = initialHTML;
      setHtml(initialHTML);
    }
  }, [stops, navigationPhase, showRouteLine, heading, isNavigating]);

  // Clear route cache when navigation phase changes (pickup -> delivery)
  const prevPhaseRef = useRef(navigationPhase);
  useEffect(() => {
    if (prevPhaseRef.current !== navigationPhase) {
      console.log('Navigation phase changed from', prevPhaseRef.current, 'to', navigationPhase, '- clearing route cache');
      cachedRouteRef.current = null;
      lastRouteFetchRef.current = 0;
      prevPhaseRef.current = navigationPhase;
    }
  }, [navigationPhase]);

  // Fetch real road-following route from OSRM when navigating (throttled to every 30 seconds)
  useEffect(() => {
    const activeWebView = getActiveWebView();
    if (!isNavigating || !currentLocation || !activeWebView || !html) return;

    // Throttle: only fetch every 30 seconds max
    const now = Date.now();
    const timeSinceLastFetch = now - lastRouteFetchRef.current;
    if (timeSinceLastFetch < 30000 && cachedRouteRef.current) {
      console.log('Skipping route fetch, last fetch was', Math.round(timeSinceLastFetch/1000), 'seconds ago');
      return;
    }

    console.log('Fetching real road route...');

    // Find target stop based on navigation phase
    const validStops = stops.filter(s => s.latitude !== 0 && s.longitude !== 0);
    const targetStop = navigationPhase === 'pickup'
      ? validStops.find(s => s.type === 'pickup')
      : navigationPhase === 'delivery'
        ? validStops.find(s => s.type === 'delivery')
        : null;

    if (!targetStop) {
      console.log('No target stop found for phase:', navigationPhase);
      return;
    }

    console.log('Target stop:', targetStop.name, targetStop.latitude, targetStop.longitude);

    // Fetch real road route from OSRM
    const fetchRoute = async () => {
      try {
        const start = { lat: currentLocation.coords.latitude, lng: currentLocation.coords.longitude };
        const end = { lat: targetStop.latitude, lng: targetStop.longitude };
        
        // Check if we have a cached route for similar start/end (within 100m)
        if (cachedRouteRef.current) {
          const cached = cachedRouteRef.current;
          const startDist = Math.sqrt(
            Math.pow(start.lat - cached.start.lat, 2) + 
            Math.pow(start.lng - cached.start.lng, 2)
          ) * 111000; // roughly meters
          const endDist = Math.sqrt(
            Math.pow(end.lat - cached.end.lat, 2) + 
            Math.pow(end.lng - cached.end.lng, 2)
          ) * 111000;
          
          if (startDist < 100 && endDist < 100 && timeSinceLastFetch < 30000) {
            console.log('Using cached route (start:', Math.round(startDist), 'm, end:', Math.round(endDist), 'm)');
            return; // Use cached route, don't redraw
          }
        }

        console.log('Fetching route from', start, 'to', end);

        const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
        console.log('OSRM URL:', url);

        const response = await fetch(url);
        console.log('OSRM response status:', response.status);

        const data = await response.json();
        console.log('OSRM data code:', data.code);

        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates;
          const routePoints = coords.map((coord: [number, number]) => [coord[1], coord[0]]);

          console.log('Route has', routePoints.length, 'points');

          // Inject real road route into map
          const routeJS = `
            try {
              console.log('Drawing real road route...');

              // Remove old route and arrows if exists
              if (window.realRouteLine) {
                map.removeLayer(window.realRouteLine);
                console.log('Removed old route line');
              }
              if (window.realRouteGlow) {
                map.removeLayer(window.realRouteGlow);
              }
              if (window.fallbackRouteLine) {
                map.removeLayer(window.fallbackRouteLine);
              }
              if (window.fallbackRouteGlow) {
                map.removeLayer(window.fallbackRouteGlow);
              }
              if (window.routeArrows) {
                window.routeArrows.forEach(arrow => map.removeLayer(arrow));
                window.routeArrows = [];
              }
              if (window.arrowAnimationInterval) {
                clearInterval(window.arrowAnimationInterval);
                window.arrowAnimationInterval = null;
              }

              // Draw real road-following route
              const routeCoords = ${JSON.stringify(routePoints)};
              console.log('Route coords count:', routeCoords.length);

              window.realRouteLine = L.polyline(routeCoords, {
                color: '#3B82F6',
                weight: 8,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'navigation-route'
              }).addTo(map);

              window.realRouteGlow = L.polyline(routeCoords, {
                color: '#93C5FD',
                weight: 14,
                opacity: 0.4,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);
              window.realRouteGlow.bringToBack();

              // Fit map to show entire route only on initial route load
              if (!window.hasFittedRoute) {
                const routeBounds = L.latLngBounds(routeCoords);
                map.fitBounds(routeBounds, { padding: [50, 50], animate: true, duration: 1 });
                window.hasFittedRoute = true;
              }

              console.log('Real road route drawn successfully with ${routePoints.length} points');
            } catch(e) { console.log('Real route error:', e.message); }
          `;

          // Inject to normal WebView
          webViewRef.current?.injectJavaScript(routeJS + 'true;');
          // Also inject to fullscreen WebView if active
          if (isFullscreen && fullscreenWebViewRef.current) {
            fullscreenWebViewRef.current.injectJavaScript(routeJS + 'true;');
          }
          
          // Cache the route data and update fetch time
          cachedRouteRef.current = { start, end, points: routePoints };
          lastRouteFetchRef.current = Date.now();
          console.log('Route cached successfully');
        } else {
          console.log('OSRM returned no route:', data);
        }
      } catch (error) {
        console.log('OSRM routing error:', error);
        // Fallback route already drawn in initial HTML
      }
    };

    // Small delay to ensure WebView is fully ready
    const timer = setTimeout(fetchRoute, 500);
    return () => clearTimeout(timer);
  }, [isNavigating, navigationPhase, currentLocation, stops, html, isFullscreen]);

  // Update driver location with heading for smooth rotation
  const lastUpdateTimeRef = useRef<number>(0);
  
  useEffect(() => {
    const activeWebView = getActiveWebView();
    if (!currentLocation || !activeWebView || !html) return;

    const prev = prevLocationRef.current;
    // Increase threshold to ~3 meters (0.00003 degrees) to prevent micro-jumps
    const hasSignificantChange = !prev ||
      Math.abs(currentLocation.coords.latitude - prev.coords.latitude) > 0.00003 ||
      Math.abs(currentLocation.coords.longitude - prev.coords.longitude) > 0.00003;
    
    // Throttle updates to max 1 per second for smoother experience
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    if (!hasSignificantChange || timeSinceLastUpdate < 1000) return;
    
    lastUpdateTimeRef.current = now;
    prevLocationRef.current = currentLocation;

    const lat = currentLocation.coords.latitude;
    const lng = currentLocation.coords.longitude;

    // Skip update if coordinates are invalid
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      console.log('Skipping invalid location update:', lat, lng);
      return;
    }

    const newHeading = heading !== null ? heading : (currentLocation.coords.heading || prevHeadingRef.current || 0);
    prevHeadingRef.current = newHeading;
    const timestamp = new Date().toLocaleTimeString();

    const js = `
      if (window.updateDriverLocation) {
        window.updateDriverLocation(${lat}, ${lng}, ${newHeading}, '${timestamp}');
      }
      if (window.setNavigationMode) {
        window.setNavigationMode(${isNavigating});
      }
      true;
    `;

    // Inject to normal WebView
    webViewRef.current?.injectJavaScript(js);
    // Also inject to fullscreen WebView if active
    if (isFullscreen && fullscreenWebViewRef.current) {
      fullscreenWebViewRef.current.injectJavaScript(js);
    }
  }, [currentLocation, heading, isNavigating, html, isFullscreen]);

  // Control functions - use active WebView ref
  const handleRecenter = useCallback(() => {
    const webView = getActiveWebView();
    if (webView) {
      webView.injectJavaScript(`window.recenterOnDriver(); true;`);
    }
    onRecenter?.();
  }, [onRecenter, isFullscreen]);

  const handleZoomIn = useCallback(() => {
    const webView = getActiveWebView();
    if (webView) {
      webView.injectJavaScript(`window.zoomIn(); true;`);
    }
  }, [isFullscreen]);

  const handleZoomOut = useCallback(() => {
    const webView = getActiveWebView();
    if (webView) {
      webView.injectJavaScript(`window.zoomOut(); true;`);
    }
  }, [isFullscreen]);

  const handleExpand = useCallback(() => {
    setIsFullscreen(true);
  }, []);

  const MapContent = useCallback(({ fullscreen = false }: { fullscreen?: boolean }) => (
    <View style={fullscreen ? styles.fullscreenContainer : styles.container}>
      {html ? (
        <WebView
          ref={fullscreen ? fullscreenWebViewRef : webViewRef}
          originWhitelist={['*']}
          source={{ html }}
          style={fullscreen ? styles.fullscreenMap : styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          mixedContentMode="always"
          overScrollMode="never"
          scrollEnabled={false}
          onError={(e) => console.log('WebView error:', e.nativeEvent)}
          onHttpError={(e) => console.log('WebView HTTP error:', e.nativeEvent)}
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          )}
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      )}

      {/* Floating Controls */}
      <View style={[styles.floatingControls, fullscreen && styles.floatingControlsFullscreen]}>
        <TouchableOpacity
          style={[styles.fabButton, styles.controlButton]}
          onPress={fullscreen ? () => setIsFullscreen(false) : handleExpand}
          activeOpacity={0.7}
        >
          <Ionicons name={fullscreen ? "contract" : "expand"} size={22} color="#7059BC" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fabButton, styles.controlButton]} onPress={handleRecenter} activeOpacity={0.7}>
          <Ionicons name="locate" size={22} color="#e3e2fa" />
        </TouchableOpacity>
        <View style={styles.zoomControls}>
          <TouchableOpacity style={[styles.fabButton, styles.zoomButton]} onPress={handleZoomIn} activeOpacity={0.7}>
            <Ionicons name="add" size={22} color="#e3e2fa" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={[styles.fabButton, styles.zoomButton]} onPress={handleZoomOut} activeOpacity={0.7}>
            <Ionicons name="remove" size={22} color="#e3e2fa" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [html, handleRecenter, handleZoomIn, handleZoomOut, handleExpand]);

  return (
    <>
      <MapContent />

      <Modal
        visible={isFullscreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsFullscreen(false)}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsFullscreen(false)}
            >
              <Ionicons name="close" size={28} color="#e3e2fa" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Navigation</Text>
            <View style={styles.placeholder} />
          </View>
          <MapContent fullscreen />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 24,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2F2C3D',
  },

  // Floating Controls - Right side
  floatingControls: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 999,
    elevation: 999,
  },
  controlButton: {
    marginBottom: 12,
  },
  floatingControlsFullscreen: {
    top: 70, // Below the modal header
  },
  fabButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2F2C3D',
    borderWidth: 1,
    borderColor: '#7059BC',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7059BC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  zoomControls: {
    borderRadius: 12,
    backgroundColor: '#2F2C3D',
    borderWidth: 1,
    borderColor: '#7059BC',
    overflow: 'hidden',
    shadowColor: '#7059BC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  zoomButton: {
    borderRadius: 0,
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    elevation: 0,
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#7059BC',
    marginHorizontal: 8,
  },

  // Fullscreen Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#2F2C3D',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#2F2C3D',
    borderBottomWidth: 1,
    borderBottomColor: '#7059BC',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    color: '#e3e2fa',
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 36,
  },
  fullscreenContainer: {
    flex: 1,
  },
  fullscreenMap: {
    width: width,
    height: height - 100,
  },
});
