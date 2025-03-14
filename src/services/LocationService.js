// src/services/LocationService.js
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from './LoggingService';
import { tryCatch } from '../utils/ErrorHandler';
import env from '../config/env';

/**
 * Service for handling location-related functionality
 * Includes location permission management, tracking, and geospatial calculations
 */
class LocationService {
  constructor() {
    // Tracking state
    this.isTracking = false;
    this.locationSubscription = null;
    this.lastKnownLocation = null;
    this.locationListeners = [];
    
    // Cached permission status
    this.permissionStatus = null;
    
    // Constants for calculations
    this.EARTH_RADIUS_KM = 6371; // Earth radius in kilometers
    this.MILES_PER_KM = 0.621371; // Conversion factor
  }
  
  /**
   * Initialize the location service
   * Loads last known location from storage and checks permissions
   */
  async initialize() {
    try {
      await tryCatch(async () => {
        // Try to load last known location from storage
        const storedLocation = await AsyncStorage.getItem('last_known_location');
        if (storedLocation) {
          this.lastKnownLocation = JSON.parse(storedLocation);
          Logger.debug(LogCategory.NAVIGATION, 'Loaded last known location from storage');
        }
        
        // Check current permission status
        this.permissionStatus = await Location.getForegroundPermissionsAsync();
        
        Logger.info(LogCategory.NAVIGATION, 'Location service initialized', {
          permissionGranted: this.permissionStatus?.granted || false
        });
      }, LogCategory.NAVIGATION, 'initializing location service', false);
    } catch (error) {
      // Error already logged by tryCatch
      Logger.error(LogCategory.NAVIGATION, 'Failed to initialize location service', { error });
    }
  }
  
  /**
   * Request location permissions from the user
   * @returns {Promise<boolean>} - True if permissions granted
   */
  async requestPermissions() {
    try {
      // First, check current status
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      
      if (existingStatus === 'granted') {
        this.permissionStatus = { granted: true, status: 'granted' };
        return true;
      }
      
      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      this.permissionStatus = { granted: status === 'granted', status };
      
      Logger.info(LogCategory.PERMISSIONS, 'Location permission request', {
        granted: status === 'granted'
      });
      
      return status === 'granted';
    } catch (error) {
      Logger.error(LogCategory.PERMISSIONS, 'Error requesting location permissions', { error });
      return false;
    }
  }
  
  /**
   * Check if location permissions are granted
   * @returns {Promise<boolean>} - True if permissions granted
   */
  async hasPermissions() {
    if (this.permissionStatus) {
      return this.permissionStatus.granted;
    }
    
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      this.permissionStatus = { granted: status === 'granted', status };
      return status === 'granted';
    } catch (error) {
      Logger.error(LogCategory.PERMISSIONS, 'Error checking location permissions', { error });
      return false;
    }
  }
  
  /**
   * Get the user's current location with improved error handling
   * @returns {Promise<{latitude: number, longitude: number} | null>}
   */
  async getCurrentLocation() {
    try {
      // First, check and request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Logger.warn(LogCategory.LOCATION, 'Location permission denied', { status });
        return await this.getFallbackLocation();
      }
      
      // Try to get the location with a timeout
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      // Set a timeout of 10 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Location request timed out')), 10000);
      });
      
      try {
        // Race the location request against the timeout
        const location = await Promise.race([locationPromise, timeoutPromise]);
        
        if (location && location.coords) {
          Logger.info(LogCategory.LOCATION, 'Successfully obtained user location', {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          });
          
          // Cache this location for future use
          this.lastKnownLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          };
          
          // Store in AsyncStorage for persistence
          try {
            await AsyncStorage.setItem('last_known_location', JSON.stringify(this.lastKnownLocation));
          } catch (storageError) {
            Logger.warn(LogCategory.STORAGE, 'Failed to cache location', { storageError });
          }
          
          return this.lastKnownLocation;
        } else {
          throw new Error('Invalid location data received');
        }
      } catch (innerError) {
        // Handle timeout or other errors during location fetching
        Logger.error(LogCategory.LOCATION, 'Error during location acquisition', {
          error: innerError.message || 'Unknown error',
          stack: innerError.stack
        });
        
        // Fallback to last known location if available
        return await this.getFallbackLocation();
      }
    } catch (error) {
      Logger.error(LogCategory.LOCATION, 'Error in getCurrentLocation', {
        error: error.message || 'Unknown error',
        stack: error.stack
      });
      return await this.getFallbackLocation();
    }
  }
  
  /**
   * Get a fallback location using various strategies
   * @returns {Promise<{latitude: number, longitude: number} | null>}
   */
  async getFallbackLocation() {
    try {
      // Strategy 1: Try to get the last known position from Expo Location
      try {
        const location = await Location.getLastKnownPositionAsync();
        
        if (location && location.coords) {
          Logger.info(LogCategory.LOCATION, 'Using Expo last known location', {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            provider: location.coords.provider,
            accuracy: location.coords.accuracy,
            timestamp: new Date(location.timestamp).toISOString()
          });
          
          return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          };
        }
      } catch (lastKnownError) {
        Logger.warn(LogCategory.LOCATION, 'Failed to get Expo last known location', { error: lastKnownError });
      }
      
      // Strategy 2: Try to get location from AsyncStorage
      try {
        const storedLocation = await AsyncStorage.getItem('last_known_location');
        if (storedLocation) {
          const parsedLocation = JSON.parse(storedLocation);
          
          if (parsedLocation && 
              typeof parsedLocation.latitude === 'number' && 
              typeof parsedLocation.longitude === 'number') {
            
            Logger.info(LogCategory.LOCATION, 'Using stored location from AsyncStorage', {
              latitude: parsedLocation.latitude,
              longitude: parsedLocation.longitude,
              source: 'AsyncStorage'
            });
            
            return parsedLocation;
          }
        }
      } catch (storageError) {
        Logger.warn(LogCategory.STORAGE, 'Failed to retrieve cached location', { storageError });
      }
      
      // Strategy 3: Use cached instance variable if available
      if (this.lastKnownLocation && 
          typeof this.lastKnownLocation.latitude === 'number' && 
          typeof this.lastKnownLocation.longitude === 'number') {
        
        Logger.info(LogCategory.LOCATION, 'Using in-memory cached location', {
          latitude: this.lastKnownLocation.latitude,
          longitude: this.lastKnownLocation.longitude,
          source: 'Memory cache'
        });
        
        return this.lastKnownLocation;
      }
      
      // Strategy 4: Default to Anchorage location
      const defaultLocation = {
        latitude: 61.2181, // Anchorage, Alaska
        longitude: -149.9003
      };
      
      // In development mode, use default location without warning
      // In production, return null to indicate failure
      if (__DEV__) {
        Logger.warn(LogCategory.LOCATION, 'Using default Anchorage location (dev only)', {
          latitude: defaultLocation.latitude,
          longitude: defaultLocation.longitude,
          source: 'Default Anchorage',
          environment: 'development'
        });
        
        // Extra debugging to help understand the location discrepancy
        Logger.debug(LogCategory.LOCATION, 'IMPORTANT: The map UI may show a different location (California) due to emulator settings, but the app is using Anchorage coordinates for vendor distance calculations', {
          warning: 'Location mismatch',
          simulatorLocation: 'The map may show your device is in California',
          appLocation: 'The app is using Anchorage for all distance calculations',
          vendorLocations: 'All vendors are in Alaska'
        });
        
        return defaultLocation;
      } else {
        Logger.warn(LogCategory.LOCATION, 'No fallback location available in production', {
          error: 'Location services unavailable',
          impact: 'Distance-based features may be limited'
        });
        return null;
      }
    } catch (error) {
      Logger.error(LogCategory.LOCATION, 'Error in getFallbackLocation', { error });
      
      // Last resort fallback: Return Anchorage in development
      if (__DEV__) {
        const emergencyLocation = {
          latitude: 61.2181,
          longitude: -149.9003
        };
        
        Logger.error(LogCategory.LOCATION, 'EMERGENCY FALLBACK: Using Anchorage location after error', {
          latitude: emergencyLocation.latitude,
          longitude: emergencyLocation.longitude
        });
        
        return emergencyLocation;
      }
      
      return null;
    }
  }
  
  /**
   * Get the last known location as a fallback
   * @deprecated Use getFallbackLocation() instead
   * @returns {Promise<{latitude: number, longitude: number} | null>}
   */
  async getLastKnownLocation() {
    // For backward compatibility, redirect to new method
    return this.getFallbackLocation();
  }
  
  /**
   * Start tracking device location with updates
   * @param {Object} options - Tracking options
   * @param {Function} options.onLocationUpdate - Callback for location updates
   * @param {Function} options.onError - Callback for errors
   * @param {number} options.distanceInterval - Min distance (meters) between updates (default: 10)
   * @param {number} options.timeInterval - Min time (ms) between updates (default: 5000)
   * @returns {Promise<boolean>} - True if tracking started successfully
   */
  async startTracking(options = {}) {
    const {
      onLocationUpdate,
      onError,
      distanceInterval = 10,
      timeInterval = 5000
    } = options;
    
    // Don't start if already tracking
    if (this.isTracking) {
      return true;
    }
    
    try {
      // Check permissions first
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          Logger.warn(LogCategory.NAVIGATION, 'Location permission denied for tracking');
          return false;
        }
      }
      
      // Add listener if provided
      if (onLocationUpdate && typeof onLocationUpdate === 'function') {
        this.locationListeners.push(onLocationUpdate);
      }
      
      // Start watching position
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval,
          timeInterval
        },
        (location) => {
          if (location && location.coords) {
            this.lastKnownLocation = location.coords;
            
            // Notify all listeners
            this.locationListeners.forEach(listener => {
              try {
                listener(location.coords);
              } catch (listenerError) {
                Logger.error(
                  LogCategory.NAVIGATION, 
                  'Error in location update listener', 
                  { listenerError }
                );
              }
            });
            
            // Store last known location
            AsyncStorage.setItem('last_known_location', JSON.stringify(location.coords))
              .catch(storageError => {
                Logger.error(
                  LogCategory.STORAGE, 
                  'Error storing last known location', 
                  { storageError }
                );
              });
          }
        }
      );
      
      this.isTracking = true;
      Logger.info(LogCategory.NAVIGATION, 'Location tracking started');
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.NAVIGATION, 'Error starting location tracking', { error });
      
      if (onError && typeof onError === 'function') {
        onError(error);
      }
      
      return false;
    }
  }
  
  /**
   * Stop tracking device location
   */
  stopTracking() {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    
    this.isTracking = false;
    this.locationListeners = [];
    
    Logger.info(LogCategory.NAVIGATION, 'Location tracking stopped');
  }
  
  /**
   * Register a listener for location updates
   * @param {Function} listener - Callback function for location updates
   */
  addLocationListener(listener) {
    if (typeof listener === 'function') {
      this.locationListeners.push(listener);
    }
  }
  
  /**
   * Remove a previously registered location listener
   * @param {Function} listener - The listener to remove
   */
  removeLocationListener(listener) {
    this.locationListeners = this.locationListeners.filter(l => l !== listener);
  }
  
  /**
   * Calculate distance between two coordinates using the Haversine formula
   * @param {number} lat1 - Latitude of first point
   * @param {number} lon1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lon2 - Longitude of second point
   * @returns {number} - Distance in miles
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return 0; // Return 0 if any parameters are missing
    }
    
    try {
      // Haversine formula
      const R = 3958.8; // Earth's radius in miles
      const dLat = this.toRadians(lat2 - lat1);
      const dLon = this.toRadians(lon2 - lon1);
      
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      return distance;
    } catch (error) {
      Logger.error(LogCategory.LOCATION, 'Error calculating distance', { error });
      return 0;
    }
  }
  
  /**
   * Convert degrees to radians
   * @param {number} degrees - Angle in degrees
   * @returns {number} - Angle in radians
   */
  toRadians(degrees) {
    return degrees * Math.PI / 180;
  }
  
  /**
   * Calculate bearing (initial heading) between two points in degrees
   * @param {number} lat1 - Latitude of first point
   * @param {number} lon1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lon2 - Longitude of second point
   * @returns {number} - Bearing in degrees (0-360)
   */
  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = this.deg2rad(lon2 - lon1);
    
    const y = Math.sin(dLon) * Math.cos(this.deg2rad(lat2));
    const x = Math.cos(this.deg2rad(lat1)) * Math.sin(this.deg2rad(lat2)) -
              Math.sin(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.cos(dLon);
    
    let brng = Math.atan2(y, x);
    brng = this.rad2deg(brng);
    
    // Normalize bearing to 0-360
    return (brng + 360) % 360;
  }
  
  /**
   * Calculate the center point and zoom level to fit multiple coordinates
   * @param {Array<Object>} coordinates - Array of coordinate objects with latitude and longitude
   * @param {Object} options - Options for calculating bounds
   * @param {number} options.padding - Padding percentage (0-1) (default: 0.1)
   * @returns {Object} - Center point and region bounds
   */
  calculateMapBounds(coordinates, options = {}) {
    const { padding = 0.1 } = options;
    
    if (!coordinates || coordinates.length === 0) {
      return {
        center: {
          latitude: env.DEFAULT_LATITUDE,
          longitude: env.DEFAULT_LONGITUDE
        },
        region: {
          latitude: env.DEFAULT_LATITUDE,
          longitude: env.DEFAULT_LONGITUDE,
          latitudeDelta: env.DEFAULT_DELTA,
          longitudeDelta: env.DEFAULT_DELTA
        }
      };
    }
    
    // Initialize with first coordinate
    let minLat = coordinates[0].latitude;
    let maxLat = coordinates[0].latitude;
    let minLng = coordinates[0].longitude;
    let maxLng = coordinates[0].longitude;
    
    // Find min and max for all coordinates
    coordinates.forEach(coord => {
      minLat = Math.min(minLat, coord.latitude);
      maxLat = Math.max(maxLat, coord.latitude);
      minLng = Math.min(minLng, coord.longitude);
      maxLng = Math.max(maxLng, coord.longitude);
    });
    
    // Calculate center point
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // Calculate deltas with padding
    const latDelta = (maxLat - minLat) * (1 + padding);
    const lngDelta = (maxLng - minLng) * (1 + padding);
    
    return {
      center: {
        latitude: centerLat,
        longitude: centerLng
      },
      region: {
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: latDelta || env.DEFAULT_DELTA,
        longitudeDelta: lngDelta || env.DEFAULT_DELTA
      }
    };
  }
  
  /**
   * Get a formatted address from coordinates using reverse geocoding
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise<string|null>} - Formatted address or null if unavailable
   */
  async getAddressFromCoordinates(latitude, longitude) {
    try {
      const geocodeResult = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });
      
      if (geocodeResult && geocodeResult.length > 0) {
        const address = geocodeResult[0];
        
        // Format address components into a string
        const addressParts = [];
        
        if (address.name) addressParts.push(address.name);
        if (address.street) {
          if (address.streetNumber) {
            addressParts.push(`${address.streetNumber} ${address.street}`);
          } else {
            addressParts.push(address.street);
          }
        }
        
        if (address.city) addressParts.push(address.city);
        if (address.region) addressParts.push(address.region);
        if (address.postalCode) addressParts.push(address.postalCode);
        
        return addressParts.join(', ');
      }
    } catch (error) {
      Logger.error(LogCategory.NAVIGATION, 'Error in reverse geocoding', { 
        error, 
        latitude, 
        longitude 
      });
    }
    
    return null;
  }
  
  /**
   * Get coordinates from an address using forward geocoding
   * @param {string} address - Address to geocode
   * @returns {Promise<Object|null>} - Coordinates or null if unavailable
   */
  async getCoordinatesFromAddress(address) {
    try {
      const geocodeResult = await Location.geocodeAsync(address);
      
      if (geocodeResult && geocodeResult.length > 0) {
        return {
          latitude: geocodeResult[0].latitude,
          longitude: geocodeResult[0].longitude
        };
      }
    } catch (error) {
      Logger.error(LogCategory.NAVIGATION, 'Error in forward geocoding', { 
        error, 
        address 
      });
    }
    
    return null;
  }
  
  /**
   * Get estimated time to travel between two points
   * @param {number} lat1 - Latitude of first point
   * @param {number} lon1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lon2 - Longitude of second point
   * @param {Object} options - Options for calculation
   * @param {number} options.speedMph - Average speed in mph (default: 25)
   * @returns {number} - Estimated time in minutes
   */
  getEstimatedTravelTime(lat1, lon1, lat2, lon2, options = {}) {
    const { speedMph = 25 } = options;
    
    // Calculate distance in miles
    const distanceMiles = this.calculateDistance(lat1, lon1, lat2, lon2, true);
    
    // Calculate time in hours: distance / speed
    const timeHours = distanceMiles / speedMph;
    
    // Convert to minutes and account for traffic/stops
    const trafficFactor = 1.2; // 20% buffer for traffic and stops
    return Math.ceil(timeHours * 60 * trafficFactor);
  }
  
  /**
   * Convert degrees to radians
   * @private
   */
  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }
  
  /**
   * Convert radians to degrees
   * @private
   */
  rad2deg(rad) {
    return rad * (180 / Math.PI);
  }
  
  /**
   * Get the current day of week as a lowercase string
   * @returns {string} - day of week (e.g., 'monday', 'tuesday')
   */
  getCurrentDayOfWeek() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay();
    return days[today];
  }
}

// Create and export a singleton instance
const locationService = new LocationService();
export default locationService;