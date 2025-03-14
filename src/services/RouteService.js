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
import dealCacheService from './DealCacheService';

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
   * Create a route based on deal type and user location
   * @param {Object} options - Route options
   * @param {string} options.dealType - Type of deals to include (birthday, daily, special)
   * @param {number} options.maxVendors - Maximum number of vendors to include
   * @param {Array} options.skipVendorIds - Vendor IDs to exclude
   * @param {Object} options.startLocation - Starting location coordinates
   * @returns {Promise<Object>} - Route result
   */
  async createRoute(options) {
    try {
      Logger.info(LogCategory.NAVIGATION, 'Creating route', { options });
      
      const {
        dealType,
        maxVendors = 5,
        maxDistance = 50,
        skipVendorIds = []
      } = options;
      
      // Use user's provided start location or attempt to get current location
      let userLocation;
      
      if (options.startLocation) {
        userLocation = options.startLocation;
        Logger.info(LogCategory.NAVIGATION, 'Using provided start location', { userLocation });
      } else {
        try {
          // Try to get user's current location
          const location = await locationService.getCurrentLocation();
          if (location && location.coords) {
            userLocation = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            };
            Logger.info(LogCategory.NAVIGATION, 'Using user\'s current location', { userLocation });
          } else {
            // Fall back to default Anchorage location
            userLocation = {
              latitude: 61.2181,
              longitude: -149.9003
            };
            Logger.info(LogCategory.NAVIGATION, 'Using default Anchorage location', { userLocation });
          }
        } catch (error) {
          Logger.error(LogCategory.NAVIGATION, 'Error getting user location, using default', { error });
          
          // Default to Anchorage
          userLocation = {
            latitude: 61.2181,
            longitude: -149.9003
          };
          Logger.info(LogCategory.NAVIGATION, 'Using Anchorage as default location for route', { userLocation });
        }
      }
      
      // Import the proximity query utility
      const { findNearbyVendorsWithDeals } = await import('../utils/ProximityQueryUtils');
      
      // Find vendors with deals of the specified type, sorted by proximity
      Logger.debug(LogCategory.NAVIGATION, 'Calling findNearbyVendorsWithDeals with parameters', {
        userLocation,
        dealType,
        maxDistance,
        maxResultsRequested: maxVendors * 2
      });
      
      // Find vendors with deals
      const result = await findNearbyVendorsWithDeals(
        userLocation,
        dealType,
        maxDistance,
        maxVendors * 2 // Get more than we need to account for filtering
      );
      
      if (!result.vendors || result.vendors.length === 0) {
        Logger.warn(LogCategory.NAVIGATION, `No vendors found with ${dealType} deals`, { dealType });
        
        // For development: if we can't find any vendors, check if we have any deals of this type in cache
        const dealsOfType = dealCacheService.getAllDeals({ type: dealType });
        
        if (dealsOfType && dealsOfType.length > 0) {
          Logger.debug(LogCategory.NAVIGATION, `Found ${dealsOfType.length} ${dealType} deals in cache but no vendors in proximity query`, {
            dealCount: dealsOfType.length,
            vendorIds: dealsOfType.map(d => d.vendorId)
          });
          
          // If no vendors found but we have deals, attempt to use the deals directly
          // This is a fallback for development/testing
          let vendorsFromDeals = [];
          
          // Get unique vendor IDs from deals
          const vendorIds = [...new Set(dealsOfType.map(deal => deal.vendorId))];
          
          // Get vendors by ID and calculate distances
          for (const vendorId of vendorIds) {
            const vendor = vendorCacheService.getVendorById(vendorId);
            if (vendor && vendor.location?.coordinates) {
              // Calculate distance
              const distance = this.calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                vendor.location.coordinates.latitude,
                vendor.location.coordinates.longitude
              );
              
              vendorsFromDeals.push({
                ...vendor,
                distance,
                dealType // Add deal type for filtering
              });
            }
          }
          
          // Sort by distance
          vendorsFromDeals.sort((a, b) => a.distance - b.distance);
          
          // Use these vendors if we found any
          if (vendorsFromDeals.length > 0) {
            Logger.info(LogCategory.NAVIGATION, `Using ${vendorsFromDeals.length} vendors from deal cache as fallback`, {
              count: vendorsFromDeals.length
            });
            
            // Override result
            result.vendors = vendorsFromDeals;
          } else {
            return {
              success: false,
              error: `No ${dealType} deals available. Please try a different deal type.`,
              vendors: []
            };
          }
        } else {
          return {
            success: false,
            error: `No ${dealType} deals available. Please try a different deal type.`,
            vendors: []
          };
        }
      }
      
      // Filter out vendors to skip
      let vendors = result.vendors.filter(vendor => !skipVendorIds.includes(vendor.id));
      
      Logger.debug(LogCategory.NAVIGATION, 'Vendors after skip filtering', { 
        count: vendors.length,
        dealType,
        filteredOut: result.vendors.length - vendors.length
      });
      
      // Filter out vendors whose deals have already been redeemed today
      const vendorsBeforeRedemptionFilter = vendors.length;
      vendors = await redemptionService.filterRedeemableVendors(vendors, dealType);
      
      Logger.debug(LogCategory.NAVIGATION, 'Vendors after redemption filtering', { 
        count: vendors.length,
        dealType,
        filteredOut: vendorsBeforeRedemptionFilter - vendors.length
      });
      
      // If we have no vendors after redemption filtering, return a specific error
      if (vendors.length === 0 && vendorsBeforeRedemptionFilter > 0) {
        Logger.warn(LogCategory.NAVIGATION, 'All vendors filtered out due to redemption rules', {
          dealType,
          originalCount: vendorsBeforeRedemptionFilter
        });
        
        return {
          success: false,
          error: `All ${dealType} deals have already been redeemed today. Please try again tomorrow or choose a different deal type.`,
          vendors: []
        };
      }
      
      // Limit to maxVendors
      vendors = vendors.slice(0, maxVendors);
      
      // Final check if we have any vendors
      if (vendors.length === 0) {
        Logger.warn(LogCategory.NAVIGATION, 'No eligible vendors found for route after all filtering');
        return {
          success: false,
          error: 'No eligible vendors found. You may have already redeemed all available deals today. Try again tomorrow or choose a different deal type.',
          vendors: []
        };
      }
      
      // Create route data
      const totalDistance = vendors.reduce((sum, vendor) => sum + (vendor.distance || 0), 0);
      const estimatedTime = totalDistance * 3 + vendors.length * 10; // 3 min per mile + 10 min per stop
      
      const route = {
        totalDistance,
        estimatedTime,
        coordinates: vendors.map(v => v.location?.coordinates || {
          latitude: 61.2258749 + (Math.random() * 0.1 - 0.05),
          longitude: -149.8097877 + (Math.random() * 0.1 - 0.05)
        })
      };
      
      return {
        success: true,
        vendors,
        route
      };
    } catch (error) {
      Logger.error(LogCategory.NAVIGATION, 'Error creating route', { error });
      throw error;
    }
  }
  
  /**
   * Calculate distance between two points
   * @param {number} lat1 - Latitude of first point
   * @param {number} lon1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lon2 - Longitude of second point
   * @returns {number} - Distance in miles
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    return locationService.calculateDistance(lat1, lon1, lat2, lon2);
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
        case 'multi_day':
          // Check for multi-day deals that include the current day
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const today = days[new Date().getDay()];
          return vendor.deals.multi_day && 
                 Array.isArray(vendor.deals.multi_day) && 
                 vendor.deals.multi_day.some(deal => 
                   deal.activeDays && 
                   Array.isArray(deal.activeDays) && 
                   deal.activeDays.includes(today)
                 );
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