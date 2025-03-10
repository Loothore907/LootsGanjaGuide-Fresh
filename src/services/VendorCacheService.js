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
        const cacheAge = Date.now() - (timestamp ? parseInt(timestamp) : 0);
        
        if (cacheAge > this.CACHE_EXPIRATION) {
          Logger.info(LogCategory.VENDORS, 'Cache expired, refreshing in background');
          this.refreshCache(true);
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
      
      // Fetch all vendors from all collections
      const vendors = await VendorRepository.getAll({
        includeAllRegions: true,
        includePriorityRegions: true,
        includeUnknownRegions: true,
        skipFiltering: true
      });
      
      if (vendors && vendors.length > 0) {
        // Update in-memory cache
        this.allVendors = vendors;
        this.isLoaded = true;
        this.lastUpdated = new Date();
        
        // Update persistent cache
        await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(vendors));
        await AsyncStorage.setItem(this.CACHE_TIMESTAMP_KEY, Date.now().toString());
        
        Logger.info(LogCategory.VENDORS, `Cached ${vendors.length} vendors successfully`);

        // Notify subscribers of update
        this.notifySubscribers({ type: 'update', count: vendors.length });
        
        return true;
      } else {
        throw new Error('No vendors returned from repository');
      }
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
   * Get all vendors from cache
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
      // Filter by region if specified
      if (filterOptions.regionId) {
        filtered = filtered.filter(vendor => 
          vendor?.regionInfo?.regionId === filterOptions.regionId
        );
      }
      
      // Only show active region vendors if specified
      if (filterOptions.onlyActiveRegions) {
        filtered = filtered.filter(vendor => 
          vendor?.regionInfo?.inActiveRegion === true
        );
      }
      
      // Only show priority region vendors if specified
      if (filterOptions.onlyPriorityRegions) {
        filtered = filtered.filter(vendor => 
          vendor?.regionInfo?.inPriorityRegion === true
        );
      }
      
      // Filter by partner status if specified
      if (filterOptions.isPartner !== undefined) {
        filtered = filtered.filter(vendor => vendor?.isPartner === filterOptions.isPartner);
      }
      
      // Sort by distance if user location provided
      if (filterOptions.userLocation) {
        filtered.forEach(vendor => {
          if (vendor?.location?.coordinates?.latitude != null && 
              vendor?.location?.coordinates?.longitude != null) {
            vendor.distance = VendorRepository.calculateDistance(
              filterOptions.userLocation.latitude,
              filterOptions.userLocation.longitude,
              vendor.location.coordinates.latitude,
              vendor.location.coordinates.longitude
            );
          } else {
            vendor.distance = Infinity;
          }
        });
        
        // Sort by distance
        filtered.sort((a, b) => (a?.distance || Infinity) - (b?.distance || Infinity));
        
        // Apply max distance filter if specified
        if (filterOptions.maxDistance) {
          filtered = filtered.filter(vendor => 
            vendor?.distance != null && vendor.distance <= filterOptions.maxDistance
          );
        }
      }
      
      // Apply limit if specified
      if (filterOptions.limit && filterOptions.limit > 0) {
        filtered = filtered.slice(0, filterOptions.limit);
      }
      
      return filtered;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error filtering vendors', { error });
      return [];
    }
  }

  /**
   * Get a specific vendor by ID
   * @param {string} id - Vendor ID
   * @returns {Object|null} Vendor object or null if not found
   */
  getVendorById(id) {
    if (!this.isLoaded) {
      Logger.warn(LogCategory.VENDORS, 'Attempted to get vendor before cache was loaded');
      return null;
    }
    
    // Convert ID to string for consistent comparison
    const vendorId = String(id);
    
    // Find vendor in cache
    const vendor = this.allVendors.find(v => String(v.id) === vendorId);
    
    if (!vendor) {
      Logger.warn(LogCategory.VENDORS, `Vendor with ID ${vendorId} not found in cache`);
    }
    
    return vendor || null;
  }

  /**
   * Check if the cache is loaded
   * @returns {boolean} Whether the cache is loaded
   */
  isCacheLoaded() {
    return this.isLoaded;
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