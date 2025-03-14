// src/services/DealCacheService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from './LoggingService';
import DealRepository from '../repositories/DealRepository';
import { getDayOfWeek } from '../utils/DateUtils';

/**
 * Service for caching and accessing deals data
 * Works alongside the VendorCacheService to provide a comprehensive data layer
 */
class DealCacheService {
  constructor() {
    // Set repository reference first so it's available during reset
    this.dealRepository = DealRepository;
    
    // These properties should not be reset
    this.CACHE_KEY = 'deals_cache';
    this.CACHE_TIMESTAMP_KEY = 'deals_cache_timestamp';
    // Cache expiration: 24 hours in milliseconds
    this.CACHE_EXPIRATION = 24 * 60 * 60 * 1000;
    // Add subscribers array
    this.subscribers = [];
    
    // Initialize cache and other properties
    this.reset();
  }

  /**
   * Reset the cache to empty state
   * Note: This only resets cache data, not service configuration
   */
  reset() {
    this._allDeals = [];
    this._dealsByVendor = new Map();
    this._dealsByType = {
      birthday: [],
      daily: [],
      special: [],
      everyday: [],
      multi_day: []
    };
    this._dealsByDay = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
      everyday: []
    };
    this._isCacheLoaded = false;
    this._lastCacheUpdate = null;
    
    // Do not reset the repository reference
    // this.dealRepository = null; // This would cause problems!
  }

  /**
   * Subscribe to cache updates
   * @param {Function} callback - Function to call when cache updates
   * @returns {Function} - Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      Logger.warn(LogCategory.DEALS, 'Invalid subscriber callback');
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
        Logger.error(LogCategory.DEALS, 'Error in deal cache subscriber', { error });
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
   * Get all cached deals
   * @param {Object} options - Options for filtering
   * @returns {Array} - Array of deal objects
   */
  getAllDeals(options = {}) {
    if (!this._isCacheLoaded) {
      Logger.warn(LogCategory.DEALS, 'Deal cache not loaded, returning empty array');
      return [];
    }

    console.log('getAllDeals called with options:', options);
    console.log('Current _dealsByType:', {
      birthday: this._dealsByType.birthday.length,
      daily: this._dealsByType.daily.length,
      special: this._dealsByType.special.length,
      everyday: this._dealsByType.everyday.length,
      multi_day: this._dealsByType.multi_day.length
    });

    // Start with all deals
    let filteredDeals = [...this._allDeals];

    // Apply dealType filter if provided
    if (options.type && this._dealsByType[options.type]) {
      console.log(`Filtering by type: ${options.type}, found ${this._dealsByType[options.type].length} deals`);
      filteredDeals = this._dealsByType[options.type];
    }

    // Apply day filter for daily deals
    if (options.day && options.type === 'daily' && this._dealsByDay[options.day]) {
      console.log(`Filtering by day: ${options.day}, found ${this._dealsByDay[options.day].length} deals`);
      filteredDeals = this._dealsByDay[options.day];
    }

    // Apply day filter for multi_day deals
    if (options.day && options.type === 'multi_day') {
      console.log(`Filtering multi_day deals by day: ${options.day}`);
      filteredDeals = filteredDeals.filter(deal => 
        deal.activeDays && 
        Array.isArray(deal.activeDays) && 
        deal.activeDays.includes(options.day)
      );
      console.log(`Found ${filteredDeals.length} multi_day deals for ${options.day}`);
    }

    // Apply vendor filter if provided
    if (options.vendorId) {
      filteredDeals = this.getDealsByVendorId(options.vendorId, options);
    }

    // Apply active filter
    if (options.activeOnly !== false) {
      const beforeCount = filteredDeals.length;
      filteredDeals = filteredDeals.filter(deal => deal.isActive !== false);
      console.log(`Active filter removed ${beforeCount - filteredDeals.length} deals`);
    }

    // Apply limit if specified
    if (options.limit && options.limit > 0) {
      filteredDeals = filteredDeals.slice(0, options.limit);
    }

    console.log(`Returning ${filteredDeals.length} deals after filtering`);
    return filteredDeals;
  }

  /**
   * Get deals for a specific vendor
   * @param {string} vendorId - Vendor ID
   * @param {Object} options - Filter options
   * @returns {Array} - Array of deal objects for the vendor
   */
  getDealsByVendorId(vendorId, options = {}) {
    if (!this._isCacheLoaded) {
      Logger.warn(LogCategory.DEALS, 'Deal cache not loaded, returning empty array');
      return [];
    }

    // Add debug logging
    console.log(`getDealsByVendorId called with vendorId: ${vendorId} (${typeof vendorId})`, options);
    console.log("Vendor map has entries:", this._dealsByVendor.size);
    
    // Check both string and number formats for vendorId
    const vendorIdAsString = String(vendorId);
    const vendorIdAsNumber = Number(vendorId);
    
    // Try to get deals with the original ID, string ID, and number ID
    let vendorDeals = this._dealsByVendor.get(vendorId) || 
                      this._dealsByVendor.get(vendorIdAsString) || 
                      this._dealsByVendor.get(vendorIdAsNumber) || 
                      [];
    
    console.log(`Found ${vendorDeals.length} total deals for vendor ID`);

    // Return all vendor deals if no additional filters
    if (!options.type && !options.day) {
      return vendorDeals;
    }
    
    // Filter by deal type if provided - FIX: use dealType instead of type
    let filteredDeals = vendorDeals;
    if (options.type) {
      console.log(`Filtering by type: ${options.type}`);
      filteredDeals = vendorDeals.filter(deal => {
        const isMatch = deal.dealType === options.type;
        console.log(`Deal ${deal.id} type=${deal.dealType}, matches ${options.type}? ${isMatch}`);
        return isMatch;
      });
      console.log(`After type filtering: ${filteredDeals.length} deals`);
    }
    
    // Further filter daily deals by day if provided
    if (options.type === 'daily' && options.day) {
      filteredDeals = filteredDeals.filter(deal => deal.day === options.day);
      console.log(`After day filtering: ${filteredDeals.length} deals`);
    }

    // Always include everyday deals for this vendor if retrieving daily deals
    if (options.type === 'daily') {
      const everydayDeals = vendorDeals.filter(deal => deal.dealType === 'everyday');
      filteredDeals = [...filteredDeals, ...everydayDeals];
      console.log(`After adding everyday deals: ${filteredDeals.length} deals`);
    }
    
    return filteredDeals;
  }

  /**
   * Get daily deals for a vendor on the specified day
   * @param {Object} vendor - Vendor object
   * @param {string} day - Day of the week
   * @returns {Array} - Array of daily deals for the vendor
   */
  getDailyDealsForVendor(vendor, day) {
    if (!vendor || !vendor.id) {
      return [];
    }
    
    // Get all deals for this vendor
    return this.getDealsByVendorId(vendor.id, {
      type: 'daily',
      day: day
    });
  }

  /**
   * Get birthday deals for a vendor
   * @param {Object} vendor - Vendor object
   * @returns {Array} - Array of birthday deals for the vendor
   */
  getBirthdayDealsForVendor(vendor) {
    if (!vendor || !vendor.id) {
      return [];
    }
    
    return this.getDealsByVendorId(vendor.id, {
      type: 'birthday'
    });
  }

  /**
   * Get special deals for a vendor
   * @param {Object} vendor - Vendor object
   * @returns {Array} - Array of special deals for the vendor
   */
  getSpecialDealsForVendor(vendor) {
    if (!vendor || !vendor.id) {
      return [];
    }
    
    return this.getDealsByVendorId(vendor.id, {
      type: 'special'
    });
  }

  /**
   * Get everyday deals for a specific vendor
   * @param {Object} vendor - Vendor object
   * @returns {Array} - Array of everyday deals for the vendor
   */
  getEverydayDealsForVendor(vendor) {
    if (!vendor || !vendor.id) {
      return [];
    }
    
    return this.getDealsByVendorId(vendor.id, {
      type: 'everyday'
    });
  }

  /**
   * Check if the cache needs to be refreshed
   * @returns {Promise<boolean>} Whether the cache needs to be refreshed
   */
  async needsRefresh() {
    try {
      // If cache isn't loaded, it needs a refresh
      if (!this._isCacheLoaded) {
        return true;
      }
      
      // Check if we have a timestamp
      const timestamp = await AsyncStorage.getItem(this.CACHE_TIMESTAMP_KEY);
      if (!timestamp) {
        return true;
      }
      
      // Check if cache is older than expiration
      const cacheAge = Date.now() - parseInt(timestamp);
      return cacheAge > this.CACHE_EXPIRATION;
    } catch (error) {
      Logger.warn(LogCategory.DEALS, 'Error checking if cache needs refresh', { error });
      return true; // If in doubt, refresh
    }
  }

  /**
   * Load all deals into cache
   * @param {Object} options - Load options
   * @returns {Promise<boolean>} - Success status
   */
  async loadAllDeals(options = {}) {
    try {
      Logger.info(LogCategory.DEALS, 'Loading all deals into cache', options);
      
      // Check if we need to refresh (safely)
      let needsRefresh = true;
      try {
        if (typeof this.needsRefresh === 'function') {
          needsRefresh = await this.needsRefresh();
        }
      } catch (refreshError) {
        Logger.warn(LogCategory.DEALS, 'Error checking if cache needs refresh', { error: refreshError });
        // Default to true if there's an error
        needsRefresh = true;
      }
      
      // If we don't need to refresh and we have data, return early
      if (!needsRefresh && this._allDeals.length > 0 && !options.force) {
        Logger.info(LogCategory.DEALS, 'Using existing deal cache', { 
          dealCount: this._allDeals.length,
          lastUpdate: this._lastCacheUpdate
        });
        return true;
      }
      
      // Try to load from storage first
      const cachedDeals = await this.loadFromStorage();
      
      if (cachedDeals.length > 0 && !options.force) {
        // If we have cached data and aren't forcing a refresh, use it
        await this.setDealData(cachedDeals);
        
        Logger.info(LogCategory.DEALS, 'Loaded deals from storage cache', { 
          dealCount: this._allDeals.length,
          dealTypes: this.countDealsByType(this._allDeals)
        });
        
        // Start a background refresh if needed
        if (needsRefresh) {
          this.refreshCache(true).catch(error => {
            Logger.warn(LogCategory.DEALS, 'Background refresh failed', { error });
          });
        }
        
        return true;
      }
      
      // If we don't have cached data or are forcing a refresh, refresh now
      const refreshSuccess = await this.refreshCache(options.background || false);
      
      if (!refreshSuccess) {
        Logger.error(LogCategory.DEALS, 'Failed to refresh deal cache');
        return false;
      }
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error loading deals', { error });
      return false;
    }
  }

  /**
   * Count deals by type
   * @param {Array} deals - Array of deals to count
   * @returns {Object} - Count of deals by type
   */
  countDealsByType(deals) {
    const counts = {
      birthday: 0,
      daily: 0,
      special: 0,
      everyday: 0,
      multi_day: 0,
      unknown: 0
    };
    
    deals.forEach(deal => {
      if (deal.dealType && counts[deal.dealType] !== undefined) {
        counts[deal.dealType]++;
      } else {
        counts.unknown++;
      }
    });
    
    return counts;
  }

  /**
   * Load deals from persistent storage
   * @returns {Promise<Array>} Array of deals
   */
  async loadFromStorage() {
    try {
      const cachedData = await AsyncStorage.getItem(this.CACHE_KEY);
      
      if (cachedData) {
        const deals = JSON.parse(cachedData);
        
        if (Array.isArray(deals) && deals.length > 0) {
          Logger.info(LogCategory.DEALS, `Loaded ${deals.length} deals from cache`);
          return deals;
        }
      }
      
      return [];
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error loading deals from storage', { error });
      return [];
    }
  }

  /**
   * Set deal data directly (used for loading from cache)
   * @param {Array} deals - Array of deal objects
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async setDealData(deals) {
    if (!Array.isArray(deals) || deals.length === 0) {
      Logger.warn(LogCategory.DEALS, 'Invalid deal data provided to setDealData');
      return false;
    }

    try {
      // Reset the cache
      this.reset();
      
      // Set all deals
      this._allDeals = deals;
      
      // Log the first deal to see its structure
      if (deals.length > 0) {
        console.log('First deal structure:', JSON.stringify(deals[0], null, 2));
      }
      
      // Populate type-specific caches
      deals.forEach(deal => {
        // Add to type-specific cache
        if (deal.dealType && this._dealsByType[deal.dealType]) {
          this._dealsByType[deal.dealType].push(deal);
        }
        
        // Add to day-specific cache for daily deals
        if (deal.dealType === 'daily' && deal.day && this._dealsByDay[deal.day]) {
          this._dealsByDay[deal.day].push(deal);
        }
        
        // Add to vendor-specific cache
        if (deal.vendorId) {
          if (!this._dealsByVendor.has(deal.vendorId)) {
            this._dealsByVendor.set(deal.vendorId, []);
          }
          
          this._dealsByVendor.get(deal.vendorId).push(deal);
        }
      });
      
      // Log the counts by type to verify
      console.log('Deals by type after categorization:', {
        birthday: this._dealsByType.birthday.length,
        daily: this._dealsByType.daily.length,
        special: this._dealsByType.special.length,
        everyday: this._dealsByType.everyday.length,
        multi_day: this._dealsByType.multi_day.length
      });
      
      // Mark cache as loaded
      this._isCacheLoaded = true;
      this._lastCacheUpdate = new Date();
      
      // Notify subscribers
      this.notifySubscribers({ type: 'init', count: deals.length });
      
      Logger.info(LogCategory.DEALS, `Set ${deals.length} deals from external data`);
      return true;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error setting deal data', { error });
      return false;
    }
  }

  /**
   * Refresh the deal cache by fetching all deals from the repository
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
      if (!this.dealRepository) {
        Logger.error(LogCategory.DEALS, 'Deal repository is not available');
        return false;
      }
      
      // Get all deals from repository
      const birthdayDeals = await this.dealRepository.getBirthdayDeals();
      const dailyDeals = [];
      const multiDayDeals = [];
      
      // Get daily deals for each day of the week
      for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
        const dealsForDay = await this.dealRepository.getDailyDeals(day);
        dailyDeals.push(...dealsForDay);
        
        // Store in day-specific cache
        this._dealsByDay[day] = dealsForDay;
        
        // Get multi-day deals for each day
        const multiDealsForDay = await this.dealRepository.getMultiDayDeals(day);
        
        // Only add unique deals to avoid duplicates (since multi-day deals can apply to multiple days)
        multiDealsForDay.forEach(deal => {
          if (!multiDayDeals.some(d => d.id === deal.id)) {
            multiDayDeals.push(deal);
          }
        });
        
        // Add multi-day deals to the day's cache
        this._dealsByDay[day] = [...this._dealsByDay[day], ...multiDealsForDay];
      }
      
      // Get special deals
      const specialDeals = await this.dealRepository.getSpecialDeals();
      
      // Get everyday deals
      const everydayDeals = await this.dealRepository.getEverydayDeals();
      
      // Store everyday deals in the everyday day cache
      this._dealsByDay.everyday = everydayDeals;
      
      // Combine all deals
      this._allDeals = [...birthdayDeals, ...dailyDeals, ...multiDayDeals, ...specialDeals, ...everydayDeals];
      
      // Populate type-specific caches
      this._dealsByType.birthday = birthdayDeals;
      this._dealsByType.daily = dailyDeals;
      this._dealsByType.multi_day = multiDayDeals;
      this._dealsByType.special = specialDeals;
      this._dealsByType.everyday = everydayDeals;
      
      // Populate vendor-specific cache
      this._allDeals.forEach(deal => {
        if (!deal.vendorId) return;
        
        if (!this._dealsByVendor.has(deal.vendorId)) {
          this._dealsByVendor.set(deal.vendorId, []);
        }
        
        this._dealsByVendor.get(deal.vendorId).push(deal);
      });
      
      // Mark cache as loaded
      this._isCacheLoaded = true;
      this._lastCacheUpdate = new Date();
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(this._allDeals));
      await AsyncStorage.setItem(this.CACHE_TIMESTAMP_KEY, Date.now().toString());
      
      // Notify subscribers
      this.notifySubscribers({ type: 'update', count: this._allDeals.length });
      
      Logger.info(LogCategory.DEALS, 'Deal cache loaded successfully', {
        totalDeals: this._allDeals.length,
        birthdayDeals: birthdayDeals.length,
        dailyDeals: dailyDeals.length,
        specialDeals: specialDeals.length,
        everydayDeals: everydayDeals.length,
        uniqueVendors: this._dealsByVendor.size
      });
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error refreshing deal cache', { error });
      
      // If this was a background refresh and we have existing data, we're still considered loaded
      if (isBackground && this._allDeals.length > 0) {
        this._isCacheLoaded = true;
        return true;
      }
      
      return false;
    }
  }

  /**
   * Get today's deals for a specific vendor
   * Combines daily deals for the current day and everyday deals
   * @param {Object} vendor - Vendor object
   * @returns {Array} - Array of deals for today
   */
  getTodaysDealsForVendor(vendor) {
    if (!vendor || !vendor.id) {
      return [];
    }
    
    // Get current day of week
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];
    
    // Get daily deals for today
    const dailyDeals = this.getDailyDealsForVendor(vendor, today);
    
    // Get multi-day deals for today
    const multiDayDeals = this.getMultiDayDealsForVendor(vendor, today);
    
    // Also get everyday deals
    const everydayDeals = this.getEverydayDealsForVendor(vendor);
    
    // Combine all types
    return [...dailyDeals, ...multiDayDeals, ...everydayDeals];
  }

  /**
   * Get multi-day deals for a specific vendor and day
   * @param {Object} vendor - Vendor object
   * @param {string} day - Day of week
   * @returns {Array} - Array of multi-day deals for the specified day
   */
  getMultiDayDealsForVendor(vendor, day) {
    if (!vendor || !vendor.id || !this._isCacheLoaded) {
      return [];
    }
    
    // Filter multi-day deals for this vendor and day
    return this._dealsByType.multi_day.filter(deal => 
      deal.vendorId === vendor.id && 
      deal.activeDays && 
      Array.isArray(deal.activeDays) && 
      deal.activeDays.includes(day)
    );
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
const dealCacheService = new DealCacheService();
export { dealCacheService };
export default dealCacheService;