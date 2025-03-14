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
    // Set repository reference first so it's available during reset
    this.vendorRepository = VendorRepository;
    
    // These properties should not be reset
    this.CACHE_KEY = 'vendors_cache';
    this.CACHE_TIMESTAMP_KEY = 'vendors_cache_timestamp';
    // Cache expiration: 24 hours in milliseconds
    this.CACHE_EXPIRATION = 24 * 60 * 60 * 1000;
    // Add subscribers array
    this.subscribers = [];
    
    // Initialize cache and other properties
    this.reset();
  }

  /**
   * Reset the cache to its initial state
   * Note: This only resets cache data, not service configuration
   */
  reset() {
    this._allVendors = [];
    this._vendorById = new Map();
    this._vendorsByRegion = new Map();
    this._vendorsByStatus = new Map();
    this._isCacheLoaded = false;
    this._lastCacheUpdate = null;
    
    // Do not reset the repository reference
    // this.vendorRepository = null; // This would cause problems!
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
   * Check if the cache is loaded
   * @returns {boolean} - Whether cache is loaded
   */
  isCacheLoaded() {
    return this._isCacheLoaded;
  }

  /**
   * Load all vendors into cache
   * @param {Object} options - Load options
   * @returns {Promise<boolean>} Whether load was successful
   */
  async loadAllVendors(options = {}) {
    try {
      Logger.info(LogCategory.VENDORS, 'Loading all vendors into cache', options);
      
      // Try to load from AsyncStorage first if not forced
      if (!options.force) {
        const cachedVendors = await this.loadFromStorage();
        
        if (cachedVendors.length > 0) {
          await this.setVendorData(cachedVendors);
          
          // If cache is older than expiration, refresh in background
          const timestamp = await AsyncStorage.getItem(this.CACHE_TIMESTAMP_KEY);
          const cacheAge = Date.now() - (timestamp ? parseInt(timestamp) : 0);
          
          if (cacheAge > this.CACHE_EXPIRATION) {
            Logger.info(LogCategory.VENDORS, 'Vendor cache expired, refreshing in background');
            this.refreshCache(true);
          }
          
          return true;
        }
      }
      
      // No valid cache or force refresh, load from repository
      return await this.refreshCache(options.background || false);
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error loading all vendors', { error });
      return false;
    }
  }

  /**
   * Initialize the vendor cache
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(options = {}) {
    // For backward compatibility, just call loadAllVendors
    return await this.loadAllVendors(options);
  }

  /**
   * Load vendors from persistent storage
   * @returns {Promise<Array>} Array of vendors
   */
  async loadFromStorage() {
    try {
      const cachedData = await AsyncStorage.getItem(this.CACHE_KEY);
      
      if (cachedData) {
        const vendors = JSON.parse(cachedData);
        
        if (Array.isArray(vendors) && vendors.length > 0) {
          Logger.info(LogCategory.VENDORS, `Loaded ${vendors.length} vendors from cache`);
          return vendors;
        }
      }
      
      return [];
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error loading vendors from storage', { error });
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
        this._isCacheLoaded = false;
      }
      
      // Reset the cache
      this.reset();
      
      // Ensure repository is available
      if (!this.vendorRepository) {
        Logger.error(LogCategory.VENDORS, 'Vendor repository is not available');
        return false;
      }
      
      // Get all vendors from repository
      const vendors = await this.vendorRepository.getAll({ ignoreDistance: true });
      
      if (vendors.length > 0) {
        // Set the vendor data
        await this.setVendorData(vendors);
        
        // Save to AsyncStorage
        await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(vendors));
        await AsyncStorage.setItem(this.CACHE_TIMESTAMP_KEY, Date.now().toString());
        
        Logger.info(LogCategory.VENDORS, `Cached ${vendors.length} vendors successfully`);
        
        return true;
      } else {
        Logger.warn(LogCategory.VENDORS, 'No vendors returned from repository');
        return false;
      }
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error refreshing vendor cache', { error });
      
      // If this was a background refresh and we have existing data, we're still considered loaded
      if (isBackground && this._allVendors.length > 0) {
        this._isCacheLoaded = true;
        return true;
      }
      
      return false;
    }
  }

  /**
   * Get all vendors from cache
   * @param {Object} options - Filter options
   * @returns {Array} - Array of vendor objects
   */
  getAllVendors(options = {}) {
    if (!this._isCacheLoaded) {
      Logger.warn(LogCategory.VENDORS, 'Vendor cache not loaded, returning empty array');
      return [];
    }

    try {
      // Start with all vendors
      let filteredVendors = [...this._allVendors];
      
      // Apply status filter if provided
      if (options.status) {
        filteredVendors = filteredVendors.filter(vendor => vendor.status === options.status);
      }
      
      // Apply region filter if provided
      if (options.region) {
        filteredVendors = filteredVendors.filter(vendor => 
          vendor.regions && vendor.regions.includes(options.region)
        );
      }
      
      // Apply partner filter if provided
      if (options.isPartner === true) {
        filteredVendors = filteredVendors.filter(vendor => vendor.isPartner === true);
      }
      
      // Apply active regions filter if provided
      if (options.activeRegionsOnly) {
        filteredVendors = filteredVendors.filter(vendor => 
          vendor.status === 'Active-Operating'
        );
      }
      
      // Calculate distances if user location provided
      if (options.userLocation && typeof options.userLocation === 'object') {
        filteredVendors = filteredVendors.map(vendor => {
          const distance = this.calculateDistance(
            options.userLocation.latitude,
            options.userLocation.longitude,
            vendor.location?.coordinates?.latitude,
            vendor.location?.coordinates?.longitude
          );
          
          return {
            ...vendor,
            distance
          };
        });
        
        // Apply distance filter if provided
        if (options.maxDistance && !options.ignoreDistance) {
          filteredVendors = filteredVendors.filter(vendor => 
            vendor.distance <= options.maxDistance
          );
        }
        
        // Sort by distance if not ignoring distance
        if (!options.ignoreDistance) {
          filteredVendors.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        }
      }
      
      // Apply limit if specified
      if (options.limit && options.limit > 0) {
        filteredVendors = filteredVendors.slice(0, options.limit);
      }
      
      return filteredVendors;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error filtering vendors', { error });
      return [];
    }
  }

  /**
   * Get a vendor by ID
   * @param {string} id - Vendor ID
   * @returns {Object|null} - Vendor object or null if not found
   */
  getVendorById(id) {
    if (!this._isCacheLoaded) {
      Logger.warn(LogCategory.VENDORS, 'Vendor cache not loaded, returning null');
      return null;
    }
    
    try {
      // Get from ID map for faster lookup
      return this._vendorById.get(id) || null;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error getting vendor by ID', { error, id });
      return null;
    }
  }

  /**
   * Calculate distance between two coordinates
   * @param {number} lat1 - Latitude of first point
   * @param {number} lon1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lon2 - Longitude of second point
   * @returns {number} - Distance in miles
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return Infinity;
    }
    
    // Convert to radians
    const toRad = value => value * Math.PI / 180;
    const R = 3958.8; // Earth's radius in miles
    
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return parseFloat(distance.toFixed(2));
  }

  /**
   * Set vendor data directly (used for loading from cache)
   * @param {Array} vendors - Array of vendor objects
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async setVendorData(vendors) {
    if (!Array.isArray(vendors) || vendors.length === 0) {
      Logger.warn(LogCategory.VENDORS, 'Invalid vendor data provided to setVendorData');
      return false;
    }

    try {
      // Reset the cache
      this.reset();
      
      // Set all vendors
      this._allVendors = vendors;
      
      // Populate ID map for faster lookups
      vendors.forEach(vendor => {
        if (vendor.id) {
          this._vendorById.set(vendor.id, vendor);
        }
        
        // Add to region map
        if (vendor.regions && Array.isArray(vendor.regions)) {
          vendor.regions.forEach(region => {
            if (!this._vendorsByRegion.has(region)) {
              this._vendorsByRegion.set(region, []);
            }
            
            this._vendorsByRegion.get(region).push(vendor);
          });
        }
        
        // Add to status map
        if (vendor.status) {
          if (!this._vendorsByStatus.has(vendor.status)) {
            this._vendorsByStatus.set(vendor.status, []);
          }
          
          this._vendorsByStatus.get(vendor.status).push(vendor);
        }
      });
      
      // Mark cache as loaded
      this._isCacheLoaded = true;
      this._lastCacheUpdate = new Date();
      
      // Notify subscribers
      this.notifySubscribers({ type: 'init', count: vendors.length });
      
      Logger.info(LogCategory.VENDORS, `Set ${vendors.length} vendors from external data`);
      return true;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error setting vendor data', { error });
      return false;
    }
  }

  /**
   * Force refresh the cache
   * @returns {Promise<boolean>} Whether refresh was successful
   */
  async forceRefresh() {
    return await this.refreshCache(false);
  }
}

// Create and export singleton instance
const vendorCacheService = new VendorCacheService();
export { vendorCacheService };
export default vendorCacheService;