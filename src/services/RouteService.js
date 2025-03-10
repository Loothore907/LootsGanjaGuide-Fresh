// src/services/RouteService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Logger, LogCategory } from './LoggingService';
import { handleError, tryCatch } from '../utils/ErrorHandler';
import locationService from './LocationService';
import env from '../config/env';
import serviceProvider from './ServiceProvider';
import redemptionService from './RedemptionService';
import vendorCacheService from './VendorCacheService';

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
   * Create an optimized route
   * @param {Object} options - Route options
   * @param {string} options.dealType - Type of deals to include
   * @param {number} options.maxVendors - Maximum number of vendors to include
   * @param {number} options.maxDistance - Maximum distance in miles (currently ignored)
   * @param {Object} options.startLocation - Starting location coordinates
   * @returns {Promise<Object>} - Route object with vendors and navigation info
   */
  async createRoute(options) {
    try {
      Logger.info(LogCategory.NAVIGATION, 'Creating route', { options });
      
      const {
        dealType,
        maxVendors = 5,
        skipVendorIds = []
      } = options;
      
      // Set default location to Anchorage regardless of device location
      // This ensures consistent testing in the emulator
      const userLocation = {
        latitude: 61.2258749,
        longitude: -149.8097877
      };
      
      Logger.info(LogCategory.NAVIGATION, 'Using Anchorage as default location for route', { userLocation });
      
      // Get ALL vendors from cache without filtering
      let vendors = vendorCacheService.getAllVendors();
      
      Logger.debug(LogCategory.NAVIGATION, 'Total vendors loaded from cache', { count: vendors.length });
      
      // Only do minimal filtering based on dealType and skip specified vendor IDs
      let filteredVendors = vendors.filter(vendor => {
        // Skip specified vendor IDs
        if (skipVendorIds.includes(vendor.id)) {
          return false;
        }
        
        // Skip vendors without deals or coordinates
        if (!vendor.deals || !vendor.location?.coordinates) {
          return false;
        }
        
        // Check if vendor has the appropriate deal type
        switch (dealType) {
          case 'birthday':
            return !!vendor.deals.birthday;
          case 'daily':
            const today = this.getCurrentDayOfWeek();
            return vendor.deals.daily && 
                  vendor.deals.daily[today] && 
                  vendor.deals.daily[today].length > 0;
          case 'special':
            return vendor.deals.special && 
                  Array.isArray(vendor.deals.special) && 
                  vendor.deals.special.length > 0;
          default:
            // For any other deal type, include all vendors
            return true;
        }
      });
      
      Logger.debug(LogCategory.NAVIGATION, 'Vendors after basic deal type filtering', { 
        count: filteredVendors.length 
      });
      
      // DISTANCE FILTERING DISABLED FOR EMULATOR TESTING
      // Instead, just add a synthetic distance property based on Anchorage
      filteredVendors = filteredVendors.map(vendor => {
        // Add synthetic distance just for display purposes
        if (vendor.location?.coordinates) {
          vendor.distance = locationService.calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            vendor.location.coordinates.latitude,
            vendor.location.coordinates.longitude
          );
        } else {
          // Add random distance between 1-10 miles if coordinates missing
          vendor.distance = Math.floor(Math.random() * 10) + 1;
        }
        return vendor;
      });
      
      // Sort by vendor name instead of distance for consistent testing
      filteredVendors.sort((a, b) => {
        if (!a.name) return 1;
        if (!b.name) return -1;
        return a.name.localeCompare(b.name);
      });
      
      // Limit number of vendors
      filteredVendors = filteredVendors.slice(0, maxVendors);
      
      // If no vendors found even with minimal filtering, use fallback
      if (filteredVendors.length === 0) {
        // Fallback: Use any vendors with coordinates, regardless of deal type
        Logger.warn(LogCategory.NAVIGATION, 'No vendors with specified deal type found, using fallback');
        
        filteredVendors = vendors
          .filter(v => v.location?.coordinates) // Only vendors with coordinates
          .slice(0, maxVendors); // Limit to max vendors
        
        // Add synthetic distance if needed
        filteredVendors = filteredVendors.map(vendor => {
          // Add random distance between 1-10 miles for testing
          vendor.distance = Math.floor(Math.random() * 10) + 1;
          return vendor;
        });
        
        // Add synthetic deals if needed
        filteredVendors = filteredVendors.map(vendor => {
          // Ensure vendor has deals structure
          if (!vendor.deals) {
            vendor.deals = {
              daily: {},
              birthday: null,
              special: []
            };
          }
          
          // Add synthetic deal based on requested type
          switch (dealType) {
            case 'birthday':
              if (!vendor.deals.birthday) {
                vendor.deals.birthday = {
                  description: 'Birthday Special (Test)',
                  discount: 'Special discount for your birthday',
                  restrictions: ['Valid during your birthday month']
                };
              }
              break;
            case 'daily':
              const today = this.getCurrentDayOfWeek();
              if (!vendor.deals.daily) {
                vendor.deals.daily = {};
              }
              if (!vendor.deals.daily[today] || !vendor.deals.daily[today].length) {
                vendor.deals.daily[today] = [{
                  description: 'Daily Special (Test)',
                  discount: 'Today\'s special offer',
                  restrictions: []
                }];
              }
              break;
            case 'special':
              if (!vendor.deals.special || !vendor.deals.special.length) {
                vendor.deals.special = [{
                  title: 'Limited Time Offer (Test)',
                  description: 'Special promotion',
                  discount: 'Limited time discount',
                  startDate: new Date().toISOString(),
                  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
                  restrictions: []
                }];
              }
              break;
          }
          
          return vendor;
        });
        
        Logger.debug(LogCategory.NAVIGATION, 'Using fallback vendors', { count: filteredVendors.length });
      }
      
      // Final check if we have any vendors
      if (filteredVendors.length === 0) {
        throw new Error('No eligible vendors found for route');
      }
      
      // Create synthetic route data for testing
      const totalDistance = filteredVendors.reduce((sum, vendor) => sum + (vendor.distance || 0), 0);
      const estimatedTime = totalDistance * 3 + filteredVendors.length * 10; // 3 min per mile + 10 min per stop
      
      const route = {
        totalDistance,
        estimatedTime,
        coordinates: filteredVendors.map(v => v.location?.coordinates || {
          latitude: 61.2258749 + (Math.random() * 0.1 - 0.05),
          longitude: -149.8097877 + (Math.random() * 0.1 - 0.05)
        })
      };
      
      return {
        success: true,
        vendors: filteredVendors,
        route
      };
    } catch (error) {
      Logger.error(LogCategory.NAVIGATION, 'Error creating route', { error });
      throw error;
    }
  }
  
  /**
   * Helper method to get the current day of week
   * @private
   * @returns {string} - Current day of week (e.g., 'monday')
   */
  getCurrentDayOfWeek() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay();
    return days[today];
  }
  
  /**
   * Filter vendors by deal type
   * @param {Array} vendors - List of all vendors
   * @param {string} dealType - Type of deal to filter for
   * @returns {Array} - Filtered vendors
   */
  filterVendorsByDealType(vendors, dealType) {
    return vendors.filter(vendor => {
      // Skip vendors without deals
      if (!vendor.deals) return false;
      
      switch (dealType) {
        case 'birthday':
          return !!vendor.deals.birthday;
        case 'daily':
          // Check for deals on the current day
          const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const currentDay = daysOfWeek[new Date().getDay()];
          return vendor.deals.daily && 
                 vendor.deals.daily[currentDay] && 
                 vendor.deals.daily[currentDay].length > 0;
        case 'special':
          // Check for active special deals
          const now = new Date();
          const activeSpecials = vendor.deals.special?.filter(deal => {
            const startDate = new Date(deal.startDate);
            const endDate = new Date(deal.endDate);
            return now >= startDate && now <= endDate;
          }) || [];
          return activeSpecials.length > 0;
        default:
          return false;
      }
    });
  }
  
  /**
   * Filter vendors by distance from starting point
   * @param {Array} vendors - List of vendors
   * @param {Object} startLocation - Starting coordinates
   * @param {number} maxDistance - Maximum distance in miles
   * @returns {Array} - Filtered and sorted vendors
   */
  filterVendorsByDistance(vendors, startLocation, maxDistance) {
    // Add distance to each vendor
    const vendorsWithDistance = vendors.map(vendor => {
      const distance = locationService.calculateDistance(
        startLocation.latitude,
        startLocation.longitude,
        vendor.location.coordinates.latitude,
        vendor.location.coordinates.longitude
      );
      
      return {
        ...vendor,
        distance
      };
    });
    
    // Filter by max distance and sort by proximity
    return vendorsWithDistance
      .filter(vendor => vendor.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);
  }
  
  /**
   * Optimize route using a simple greedy algorithm
   * @param {Array} vendors - Filtered vendors with distances
   * @param {Object} startLocation - Starting coordinates
   * @param {number} maxVendors - Maximum number of vendors
   * @returns {Array} - Optimized route vendors
   */
  optimizeRoute(vendors, startLocation, maxVendors) {
    // If no vendors, return empty array
    if (vendors.length === 0) return [];
    
    // Limit to max vendors if needed
    let selectedVendors = vendors.slice(0, maxVendors);
    
    // If no starting location or only one vendor, just return the selection
    if (!startLocation || selectedVendors.length <= 1) {
      return selectedVendors;
    }
    
    // TODO: Implement more sophisticated route optimization if needed
    // For now, we're just taking the closest vendors, which is already done
    
    return selectedVendors;
  }
  
  /**
   * Calculate total route distance
   * @param {Array} vendors - Ordered vendors in route
   * @param {Object} startLocation - Starting coordinates
   * @returns {number} - Total distance in miles
   */
  calculateRouteDistance(vendors, startLocation) {
    if (!vendors || vendors.length === 0 || !startLocation) {
      return 0;
    }
    
    let totalDistance = 0;
    let previousCoords = startLocation;
    
    // Calculate distance between each point
    vendors.forEach(vendor => {
      const vendorCoords = vendor.location.coordinates;
      
      const segmentDistance = locationService.calculateDistance(
        previousCoords.latitude,
        previousCoords.longitude,
        vendorCoords.latitude,
        vendorCoords.longitude
      );
      
      totalDistance += segmentDistance;
      previousCoords = vendorCoords;
    });
    
    return totalDistance;
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
   * Get cached route data
   * @returns {Promise<Object|null>} - Route data or null if not found
   */
  async getCachedRouteData() {
    try {
      const routeData = await AsyncStorage.getItem('current_route_data');
      return routeData ? JSON.parse(routeData) : null;
    } catch (error) {
      Logger.error(LogCategory.NAVIGATION, 'Error getting cached route data', { error });
      return null;
    }
  }
}

// Create and export a singleton instance
const routeService = new RouteService();
export default routeService;