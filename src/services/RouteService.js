// src/services/RouteService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Logger, LogCategory } from './LoggingService';
import { tryCatch } from '../utils/ErrorHandler';
import locationService from './LocationService';
import env from '../config/env';

/**
 * Service for route planning, optimization, and journey tracking
 * Handles the creation of optimized routes and navigation between vendors
 */
class RouteService {
  constructor() {
    // Journey cache
    this.currentJourney = null;
    
    // Route data cache
    this.routeData = null;
    
    // Constants for optimization
    this.MAX_STOPS = 10; // Maximum number of stops per journey
    this.DEFAULT_SPEED_MPH = 25; // Average speed in mph for time estimation
  }
  
  /**
   * Initialize the route service
   * Loads current journey from storage if available
   */
  async initialize() {
    try {
      await tryCatch(async () => {
        // Try to load current journey from storage
        const storedJourney = await AsyncStorage.getItem('current_journey');
        if (storedJourney) {
          const parsedJourney = JSON.parse(storedJourney);
          
          // Check for journey expiration - 24 hours
          const journeyDate = new Date(parsedJourney.createdAt);
          const now = new Date();
          const journeyAge = now - journeyDate;
          const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          
          if (journeyAge > ONE_DAY) {
            // Journey is too old, clear it
            Logger.info(LogCategory.JOURNEY, 'Clearing expired journey data');
            await this.clearCurrentJourney();
            return;
          }
          
          this.currentJourney = parsedJourney;
          
          // Also load route data if available
          const storedRouteData = await AsyncStorage.getItem('current_route_data');
          if (storedRouteData) {
            this.routeData = JSON.parse(storedRouteData);
          }
          
          Logger.info(LogCategory.JOURNEY, 'Loaded current journey from storage', {
            vendorCount: this.currentJourney.vendors.length,
            currentIndex: this.currentJourney.currentVendorIndex
          });
        }
      }, LogCategory.JOURNEY, 'initializing route service', false);
    } catch (error) {
      // Error already logged by tryCatch
      Logger.error(LogCategory.JOURNEY, 'Failed to initialize route service', { error });
    }
  }
  
  /**
   * Create an optimized route between multiple vendors
   * @param {Array<string>} vendorIds - Array of vendor IDs to visit
   * @param {Object} options - Route options
   * @param {Object} options.startLocation - Starting coordinates (uses current location if not provided)
   * @param {string} options.dealType - Type of deals being pursued
   * @param {number} options.maxDistance - Maximum total distance in miles
   * @returns {Promise<Object>} - Optimized route information
   */
  async createOptimizedRoute(vendorIds, options = {}) {
    try {
      const { dealType = 'daily', maxDistance = 25 } = options;
      
      // Validate inputs
      if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
        throw new Error('No vendor IDs provided for route creation');
      }
      
      // Limit number of stops
      if (vendorIds.length > this.MAX_STOPS) {
        Logger.warn(LogCategory.JOURNEY, `Route contains ${vendorIds.length} stops, limiting to ${this.MAX_STOPS}`);
        vendorIds = vendorIds.slice(0, this.MAX_STOPS);
      }
      
      // Get start location (user's current location or provided location)
      let startLocation = options.startLocation;
      
      if (!startLocation) {
        const userLocation = await locationService.getCurrentLocation();
        
        if (userLocation) {
          startLocation = {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude
          };
        } else {
          // Use default location as fallback
          startLocation = {
            latitude: env.DEFAULT_LATITUDE,
            longitude: env.DEFAULT_LONGITUDE
          };
          
          Logger.warn(LogCategory.JOURNEY, 'Using default location for route creation due to missing user location');
        }
      }
      
      // Get vendor data from the API or mock service
      // In a real implementation, you would call your API service here
      // For now, we'll use mock data with the assumption vendor details would be fetched
      
      // This would be replaced with a call to your API
      const vendors = vendorIds.map(id => {
        // Pretend we got this data from the API
        return {
          id,
          name: `Vendor ${id}`,
          location: {
            address: `${id} Cannabis Street, Anchorage, AK`,
            coordinates: {
              // Generate random coordinates around Anchorage for testing
              latitude: env.DEFAULT_LATITUDE + (Math.random() - 0.5) * 0.05,
              longitude: env.DEFAULT_LONGITUDE + (Math.random() - 0.5) * 0.05
            }
          },
          // Other vendor data would be here
        };
      });
      
      // Calculate distances from start location to each vendor
      for (const vendor of vendors) {
        vendor.distanceFromStart = locationService.calculateDistance(
          startLocation.latitude,
          startLocation.longitude,
          vendor.location.coordinates.latitude,
          vendor.location.coordinates.longitude
        );
      }
      
      // Route optimization algorithm
      // In a production app, this would be replaced with a more sophisticated algorithm
      // or a call to a routing API like Google Directions or Mapbox Directions
      
      // Simple approach: sort by distance from start (nearest first)
      const sortedVendors = [...vendors].sort((a, b) => a.distanceFromStart - b.distanceFromStart);
      
      // Calculate total route distance
      let totalDistance = 0;
      let prevLat = startLocation.latitude;
      let prevLng = startLocation.longitude;
      
      for (const vendor of sortedVendors) {
        const distance = locationService.calculateDistance(
          prevLat,
          prevLng,
          vendor.location.coordinates.latitude,
          vendor.location.coordinates.longitude
        );
        
        totalDistance += distance;
        
        // Update for next iteration
        prevLat = vendor.location.coordinates.latitude;
        prevLng = vendor.location.coordinates.longitude;
        
        // Calculate individual vendor distance from start (for display)
        vendor.distance = vendor.distanceFromStart;
        
        // Remove the temporary property
        delete vendor.distanceFromStart;
      }
      
      // Calculate estimated travel time (minutes)
      const estimatedTime = Math.ceil(totalDistance / this.DEFAULT_SPEED_MPH * 60);
      
      // Create route coordinates array (for map display)
      const coordinates = [
        { latitude: startLocation.latitude, longitude: startLocation.longitude }
      ];
      
      sortedVendors.forEach(vendor => {
        coordinates.push({
          latitude: vendor.location.coordinates.latitude,
          longitude: vendor.location.coordinates.longitude
        });
      });
      
      // Create route object
      const route = {
        vendors: sortedVendors,
        totalDistance,
        estimatedTime,
        startLocation,
        coordinates
      };
      
      // Save current journey and route data
      this.currentJourney = {
        dealType,
        vendors: sortedVendors,
        currentVendorIndex: 0,
        maxDistance,
        totalVendors: sortedVendors.length,
        createdAt: new Date().toISOString()
      };
      
      this.routeData = {
        coordinates,
        totalDistance,
        estimatedTime
      };
      
      // Persist to storage
      await Promise.all([
        AsyncStorage.setItem('current_journey', JSON.stringify(this.currentJourney)),
        AsyncStorage.setItem('current_route_data', JSON.stringify(this.routeData))
      ]);
      
      Logger.info(LogCategory.JOURNEY, 'Created optimized route', {
        vendorCount: sortedVendors.length,
        totalDistance,
        estimatedTime
      });
      
      return route;
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error creating optimized route', { error });
      throw error;
    }
  }
  
  /**
   * Get the current active journey
   * @returns {Object|null} - Current journey or null if none active
   */
  getCurrentJourney() {
    return this.currentJourney;
  }
  
  /**
   * Get the current route data
   * @returns {Object|null} - Current route data or null if none available
   */
  getRouteData() {
    return this.routeData;
  }
  
  /**
   * Advance to the next vendor in the journey
   * @returns {Object|null} - Updated journey or null if journey is complete
   */
  async advanceToNextVendor() {
    if (!this.currentJourney) {
      return null;
    }
    
    // Check if there are more vendors
    if (this.currentJourney.currentVendorIndex < this.currentJourney.vendors.length - 1) {
      // Increment index
      this.currentJourney.currentVendorIndex++;
      
      // Save to storage
      await AsyncStorage.setItem('current_journey', JSON.stringify(this.currentJourney));
      
      Logger.info(LogCategory.JOURNEY, 'Advanced to next vendor', {
        newIndex: this.currentJourney.currentVendorIndex,
        totalVendors: this.currentJourney.vendors.length
      });
      
      return this.currentJourney;
    } else {
      // Journey is complete
      Logger.info(LogCategory.JOURNEY, 'Journey is complete, no more vendors');
      return null;
    }
  }
  
  /**
   * Skip the current vendor and advance to the next
   * @returns {Object|null} - Updated journey or null if journey is complete
   */
  async skipCurrentVendor() {
    if (!this.currentJourney) {
      return null;
    }
    
    // Remove current vendor
    const currentIndex = this.currentJourney.currentVendorIndex;
    this.currentJourney.vendors.splice(currentIndex, 1);
    this.currentJourney.totalVendors = this.currentJourney.vendors.length;
    
    // Adjust index if we removed the last vendor
    if (currentIndex >= this.currentJourney.vendors.length) {
      this.currentJourney.currentVendorIndex = this.currentJourney.vendors.length - 1;
      
      // If no vendors left, journey is complete
      if (this.currentJourney.currentVendorIndex < 0) {
        this.currentJourney.currentVendorIndex = 0;
        this.currentJourney.vendors = [];
        this.currentJourney.totalVendors = 0;
      }
    }
    
    // Save to storage
    await AsyncStorage.setItem('current_journey', JSON.stringify(this.currentJourney));
    
    Logger.info(LogCategory.JOURNEY, 'Skipped current vendor', {
      remainingVendors: this.currentJourney.vendors.length,
      currentIndex: this.currentJourney.currentVendorIndex
    });
    
    return this.currentJourney;
  }
  
  /**
   * Complete the current journey
   * @returns {Object} - Completed journey summary
   */
  async completeJourney() {
    if (!this.currentJourney) {
      return null;
    }
    
    // Mark journey as completed
    this.currentJourney.completedAt = new Date().toISOString();
    
    // Calculate points earned (10 points per vendor visited)
    const pointsEarned = this.currentJourney.currentVendorIndex * 10;
    
    // Create journey summary
    const summary = {
      ...this.currentJourney,
      pointsEarned,
      totalDistance: this.routeData?.totalDistance || 0,
      totalTime: this.routeData?.estimatedTime || 0
    };
    
    // Store in journey history
    await this.addToJourneyHistory(summary);
    
    // Clear current journey - Ensure this is called
    await this.clearCurrentJourney();
    
    Logger.info(LogCategory.JOURNEY, 'Journey completed', {
      vendorsVisited: this.currentJourney.currentVendorIndex,
      totalVendors: this.currentJourney.totalVendors,
      pointsEarned
    });
    
    return summary;
  }
  
  /**
   * Clear the current journey
   */
  async clearCurrentJourney() {
    this.currentJourney = null;
    this.routeData = null;
    
    await Promise.all([
      AsyncStorage.removeItem('current_journey'),
      AsyncStorage.removeItem('current_route_data')
    ]);
    
    Logger.info(LogCategory.JOURNEY, 'Current journey cleared');
  }
  
  /**
   * Get directions to a vendor
   * @param {Object} vendorCoordinates - Vendor coordinates
   * @param {Object} options - Options for directions
   * @param {Object} options.startCoordinates - Starting coordinates (uses current location if not provided)
   * @returns {Promise<Object>} - Directions information
   */
  async getDirectionsToVendor(vendorCoordinates, options = {}) {
    try {
      // Get start location
      let startCoordinates = options.startCoordinates;
      
      if (!startCoordinates) {
        const userLocation = await locationService.getCurrentLocation();
        
        if (userLocation) {
          startCoordinates = {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude
          };
        } else {
          throw new Error('Unable to get current location for directions');
        }
      }
      
      // In a production app, this would be replaced with a call to a directions API
      // For now, we'll create a simple direct line between points
      
      const distance = locationService.calculateDistance(
        startCoordinates.latitude,
        startCoordinates.longitude,
        vendorCoordinates.latitude,
        vendorCoordinates.longitude
      );
      
      const bearing = locationService.calculateBearing(
        startCoordinates.latitude,
        startCoordinates.longitude,
        vendorCoordinates.latitude,
        vendorCoordinates.longitude
      );
      
      const estimatedTime = Math.ceil(distance / this.DEFAULT_SPEED_MPH * 60);
      
      return {
        distance,
        bearing,
        estimatedTime,
        coordinates: [
          { latitude: startCoordinates.latitude, longitude: startCoordinates.longitude },
          { latitude: vendorCoordinates.latitude, longitude: vendorCoordinates.longitude }
        ]
      };
    } catch (error) {
      Logger.error(LogCategory.NAVIGATION, 'Error getting directions to vendor', { error });
      throw error;
    }
  }
  
  /**
   * Open external maps app with directions to vendor
   * @param {Object} vendor - Vendor object with coordinates and name
   * @returns {Promise<boolean>} - True if maps app was opened successfully
   */
  async openMapsWithDirections(vendor) {
    try {
      const { latitude, longitude } = vendor.location.coordinates;
      const label = encodeURIComponent(vendor.name);
      
      // Different URL scheme based on platform
      const scheme = Platform.select({
        ios: 'maps:0,0?q=',
        android: 'geo:0,0?q='
      });
      
      const latLng = `${latitude},${longitude}`;
      
      const url = Platform.select({
        ios: `${scheme}${label}@${latLng}`,
        android: `${scheme}${latLng}(${label})`
      });
      
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
        return true;
      } else {
        Logger.warn(LogCategory.NAVIGATION, 'Maps app not supported', { url });
        return false;
      }
    } catch (error) {
      Logger.error(LogCategory.NAVIGATION, 'Error opening maps with directions', { error });
      return false;
    }
  }
  
  /**
   * Add a completed journey to the history
   * @private
   * @param {Object} journey - Completed journey data
   */
  async addToJourneyHistory(journey) {
    try {
      // Get existing history
      const historyJson = await AsyncStorage.getItem('journey_history');
      let history = [];
      
      if (historyJson) {
        history = JSON.parse(historyJson);
      }
      
      // Add new journey to history
      history.unshift(journey);
      
      // Limit history size (keep last 20)
      if (history.length > 20) {
        history = history.slice(0, 20);
      }
      
      // Save updated history
      await AsyncStorage.setItem('journey_history', JSON.stringify(history));
      
      Logger.debug(LogCategory.JOURNEY, 'Added journey to history', {
        historySize: history.length
      });
    } catch (error) {
      Logger.error(LogCategory.STORAGE, 'Error adding journey to history', { error });
    }
  }
  
  /**
   * Get journey history
   * @param {number} limit - Maximum number of journeys to return
   * @returns {Promise<Array>} - Array of past journeys
   */
  async getJourneyHistory(limit = 20) {
    try {
      const historyJson = await AsyncStorage.getItem('journey_history');
      
      if (historyJson) {
        const history = JSON.parse(historyJson);
        return history.slice(0, limit);
      }
      
      return [];
    } catch (error) {
      Logger.error(LogCategory.STORAGE, 'Error getting journey history', { error });
      return [];
    }
  }
  
  /**
   * Calculate optimal order for visiting multiple vendors
   * @private
   * @param {Array<Object>} vendors - Array of vendor objects with coordinates
   * @param {Object} startLocation - Starting coordinates
   * @returns {Array<Object>} - Vendors in optimal visit order
   */
  _calculateOptimalOrder(vendors, startLocation) {
    // This is a simple implementation of the nearest neighbor algorithm
    // In a production app, consider using a more sophisticated algorithm for optimal routing
    
    // Make a copy of vendors to avoid modifying the original
    const remainingVendors = [...vendors];
    const orderedVendors = [];
    
    let currentLat = startLocation.latitude;
    let currentLng = startLocation.longitude;
    
    // Keep selecting the nearest vendor until all vendors are visited
    while (remainingVendors.length > 0) {
      // Find vendor closest to current position
      let nearestIndex = 0;
      let nearestDistance = Number.MAX_VALUE;
      
      for (let i = 0; i < remainingVendors.length; i++) {
        const vendor = remainingVendors[i];
        const distance = locationService.calculateDistance(
          currentLat,
          currentLng,
          vendor.location.coordinates.latitude,
          vendor.location.coordinates.longitude
        );
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }
      
      // Add nearest vendor to ordered list
      const nearestVendor = remainingVendors[nearestIndex];
      orderedVendors.push(nearestVendor);
      
      // Update current position
      currentLat = nearestVendor.location.coordinates.latitude;
      currentLng = nearestVendor.location.coordinates.longitude;
      
      // Remove from remaining vendors
      remainingVendors.splice(nearestIndex, 1);
    }
    
    return orderedVendors;
  }
}

// Create and export a singleton instance
const routeService = new RouteService();
export default routeService;