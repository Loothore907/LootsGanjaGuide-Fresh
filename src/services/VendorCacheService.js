// src/services/VendorCacheService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from './LoggingService';
import VendorRepository from '../repositories/VendorRepository';

/**
 * Service for caching all vendor data in memory and persisting to storage
 * This optimizes performance by preloading the relatively small dataset (~60 records)
 */
class VendorCacheService {
  constructor() {
    this.allVendors = [];
    this.isLoaded = false;
    this.lastUpdated = null;
    this.CACHE_KEY = 'vendors_cache';
    this.CACHE_TIMESTAMP_KEY = 'vendors_cache_timestamp';
    // Cache expiration: 24 hours in milliseconds
    this.CACHE_EXPIRATION = 24 * 60 * 60 * 1000;
    // Add subscribers array
    this.subscribers = [];
  }

  /**
   * Subscribe to cache updates
   * @param {Function} callback - Function to call when cache updates
   * @returns {Function} - Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      Logger.warn(LogCategory.VENDORS, 'Invalid subscriber callback');
      return () => {};
    }

    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify subscribers of cache update
   * @private
   */
  notifySubscribers(event = { type: 'update' }) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        Logger.error(LogCategory.VENDORS, 'Error in vendor cache subscriber', { error });
      }
    });
  }

  /**
   * Initialize the service
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    try {
      Logger.info(LogCategory.VENDORS, 'Initializing vendor cache service');
      
      // Try to load from AsyncStorage first
      const cachedVendors = await this.loadFromStorage();
      
      if (cachedVendors.length > 0) {
        this.allVendors = cachedVendors;
        this.isLoaded = true;
        
        // If cache is older than expiration, refresh in background
        const timestamp = await AsyncStorage.getItem(this.CACHE_TIMESTAMP_KEY);
        const cacheAge = Date.now() - (timestamp ? parseInt(timestamp, 10) : 0);
        
        if (cacheAge > this.CACHE_EXPIRATION) {
          Logger.info(LogCategory.VENDORS, 'Cache expired, refreshing in background');
          this.refreshCache(true).catch(err => {
            Logger.error(LogCategory.VENDORS, 'Background cache refresh failed', { error: err });
          });
        }

        // Notify subscribers of initial load
        this.notifySubscribers({ type: 'init', count: cachedVendors.length });
        
        return true;
      }
      
      // No valid cache, load from repository
      return await this.refreshCache(false);
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error initializing vendor cache', { error });
      return false;
    }
  }

  /**
   * Load cached vendors from AsyncStorage
   * @returns {Promise<Array>} Array of cached vendors or empty array
   */
  async loadFromStorage() {
    try {
      const cachedData = await AsyncStorage.getItem(this.CACHE_KEY);
      
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        Logger.info(LogCategory.VENDORS, `Loaded ${parsedData.length} vendors from cache`);
        return parsedData;
      }
      
      return [];
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error loading vendors from cache', { error });
      return [];
    }
  }

  /**
   * Refresh the vendor cache by fetching all vendors from the repository
   * @param {boolean} isBackground - Whether this is a background refresh 
   * @returns {Promise<boolean>} Whether refresh was successful
   */
  async refreshCache(isBackground = false) {
    try {
      // If not a background refresh, show that we're loading
      if (!isBackground) {
        this.isLoaded = false;
      }
      
      // Fetch all vendors from repository with safe options
      // Avoid using `in` operator in filters which is causing the Firebase error
      const options = {
        activeRegionsOnly: true  // Use this simple filter instead of the complex ones
      };
      
      // Try-catch each step independently to avoid complete failure
      let vendors = [];
      try {
        vendors = await VendorRepository.getAll(options);
        Logger.info(LogCategory.VENDORS, `Retrieved ${vendors?.length || 0} vendors from repository`);
      } catch (fetchError) {
        Logger.error(LogCategory.VENDORS, 'Error fetching vendors from repository', { error: fetchError });
        
        // If this fails and we're in background refresh, keep existing cache
        if (isBackground && this.allVendors.length > 0) {
          return true;
        }
        
        throw fetchError; // Re-throw to handle below
      }
      
      // Validate results
      if (!Array.isArray(vendors)) {
        throw new Error(`Invalid vendor data returned: ${typeof vendors}`);
      }
      
      if (vendors.length === 0) {
        Logger.warn(LogCategory.VENDORS, 'Repository returned zero vendors');
        // If this is a background refresh and we have existing cache, keep it
        if (isBackground && this.allVendors.length > 0) {
          return true;
        }
        
        // Otherwise treat as error
        throw new Error('No vendors returned from repository');
      }
      
      // Update in-memory cache
      this.allVendors = vendors;
      this.isLoaded = true;
      this.lastUpdated = new Date();
      
      // Try to update persistent cache
      try {
        await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(vendors));
        await AsyncStorage.setItem(this.CACHE_TIMESTAMP_KEY, Date.now().toString());
        Logger.info(LogCategory.VENDORS, `Cached ${vendors.length} vendors successfully`);
      } catch (storageError) {
        // Log but don't fail the entire operation
        Logger.error(LogCategory.VENDORS, 'Error saving vendors to AsyncStorage', { error: storageError });
      }
      
      // Notify subscribers of update
      this.notifySubscribers({ type: 'update', count: vendors.length });
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error refreshing vendor cache', { error });
      
      // If this was a background refresh and we have existing data, we're still considered loaded
      if (isBackground && this.allVendors.length > 0) {
        this.isLoaded = true;
        return true;
      }
      
      return false;
    }
  }

  /**
   * Get all vendors from cache with safer filtering
   * @param {Object} filterOptions - Optional in-memory filtering options
   * @returns {Array} Array of vendors
   */
  getAllVendors(filterOptions = {}) {
    if (!this.isLoaded || !Array.isArray(this.allVendors)) {
      Logger.warn(LogCategory.VENDORS, 'Attempted to get vendors before cache was loaded');
      return [];
    }
    
    // Apply in-memory filtering if needed
    let filtered = [...this.allVendors];
    
    try {
      // Filter by region if specified - with null checks
      if (filterOptions.regionId) {
        filtered = filtered.filter(vendor => 
          vendor && vendor.regionInfo && vendor.regionInfo.regionId === filterOptions.regionId
        );
      }
      
      // Only show active region vendors if specified - with null checks
      if (filterOptions.onlyActiveRegions) {
        filtered = filtered.filter(vendor => 
          vendor && vendor.regionInfo && vendor.regionInfo.inActiveRegion === true
        );
      }
      
      // Only show priority region vendors if specified - with null checks
      if (filterOptions.onlyPriorityRegions) {
        filtered = filtered.filter(vendor => 
          vendor && vendor.regionInfo && vendor.regionInfo.inPriorityRegion === true
        );
      }
      
      // Filter by partner status if specified - with null checks
      if (filterOptions.isPartner !== undefined) {
        filtered = filtered.filter(vendor => vendor && vendor.isPartner === filterOptions.isPartner);
      }
      
      // Sort by distance if user location provided - with thorough null checks
      if (filterOptions.userLocation && 
          typeof filterOptions.userLocation.latitude === 'number' && 
          typeof filterOptions.userLocation.longitude === 'number') {
        
        filtered = filtered.map(vendor => {
          const result = {...vendor};
          
          // Only calculate distance if vendor has valid coordinates
          if (vendor && 
              vendor.location && 
              vendor.location.coordinates && 
              typeof vendor.location.coordinates.latitude === 'number' && 
              typeof vendor.location.coordinates.longitude === 'number') {
            
            try {
              result.distance = VendorRepository.calculateDistance(
                filterOptions.userLocation.latitude,
                filterOptions.userLocation.longitude,
                vendor.location.coordinates.latitude,
                vendor.location.coordinates.longitude
              );
            } catch (distanceError) {
              Logger.warn(LogCategory.VENDORS, 'Error calculating distance', { 
                error: distanceError,
                vendorId: vendor.id
              });
              result.distance = Infinity;
            }
          } else {
            result.distance = Infinity;
          }
          
          return result;
        });
        
        // Sort by distance with null safety
        filtered.sort((a, b) => {
          const distA = typeof a.distance === 'number' ? a.distance : Infinity;
          const distB = typeof b.distance === 'number' ? b.distance : Infinity;
          return distA - distB;
        });
        
        // Apply max distance filter if specified
        if (typeof filterOptions.maxDistance === 'number') {
          filtered = filtered.filter(vendor => 
            typeof vendor.distance === 'number' && vendor.distance <= filterOptions.maxDistance
          );
        }
      }
      
      // Apply limit if specified
      if (typeof filterOptions.limit === 'number' && filterOptions.limit > 0) {
        filtered = filtered.slice(0, filterOptions.limit);
      }
      
      Logger.debug(LogCategory.VENDORS, `Filtered ${this.allVendors.length} vendors to ${filtered.length}`);
      return filtered;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error filtering vendors', { error });
      return [];
    }
  }

  /**
   * Get a specific vendor by ID with improved error handling
   * @param {string} id - Vendor ID
   * @returns {Object|null} Vendor object or null if not found
   */
  getVendorById(id) {
    if (!this.isLoaded) {
      Logger.warn(LogCategory.VENDORS, 'Attempted to get vendor before cache was loaded');
      return null;
    }
    
    if (!id) {
      Logger.warn(LogCategory.VENDORS, 'Invalid vendor ID provided');
      return null;
    }
    
    try {
      // Convert ID to string for consistent comparison
      const vendorId = String(id);
      
      // Find vendor in cache with null safety
      const vendor = this.allVendors.find(v => v && String(v.id) === vendorId);
      
      if (!vendor) {
        Logger.warn(LogCategory.VENDORS, `Vendor with ID ${vendorId} not found in cache`);
      }
      
      return vendor || null;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, `Error retrieving vendor with ID ${id}`, { error });
      return null;
    }
  }

  /**
   * Check if the cache is loaded
   * @returns {boolean} Whether the cache is loaded
   */
  isCacheLoaded() {
    return this.isLoaded && Array.isArray(this.allVendors) && this.allVendors.length > 0;
  }

  /**
   * Force refresh the cache
   * @returns {Promise<boolean>} Whether refresh was successful
   */
  async forceRefresh() {
    return await this.refreshCache(false);
  }
}

// Create singleton instance
const vendorCacheService = new VendorCacheService();

// Export as both default and named export
export { vendorCacheService };
export default vendorCacheService;