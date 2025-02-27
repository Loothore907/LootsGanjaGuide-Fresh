// src/services/api/VendorService.js
import apiClient, { handleApiError } from './Client';
import { Logger, LogCategory } from '../LoggingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Service for handling vendor-related API requests
 */
export const VendorService = {
  /**
   * Get all vendors with optional filtering
   * @param {Object} options - Filter options
   * @param {number} options.maxDistance - Maximum distance in miles
   * @param {string} options.dealType - Type of deal (birthday, daily, special)
   * @param {string} options.day - Day of week for daily deals
   * @param {boolean} options.isPartner - Filter by partner status
   * @param {number} options.limit - Maximum number of results
   * @param {number} options.offset - Offset for pagination
   * @param {string} options.sortBy - Field to sort by
   * @param {string} options.sortDirection - Sort direction (asc or desc)
   * @returns {Promise<Array>} - Array of vendors
   */
  getAll: async (options = {}) => {
    try {
      const response = await apiClient.get('/vendors', { params: options });
      
      // Cache the result if successful
      if (response.data && Array.isArray(response.data)) {
        try {
          await AsyncStorage.setItem(
            'cached_vendors', 
            JSON.stringify({
              timestamp: Date.now(),
              data: response.data,
              options
            })
          );
        } catch (cacheError) {
          Logger.warn(LogCategory.STORAGE, 'Failed to cache vendors', { cacheError });
        }
      }
      
      return response.data;
    } catch (error) {
      // Try to get cached data if network request fails
      Logger.error(LogCategory.VENDORS, 'Failed to fetch vendors from API', { error });
      
      try {
        const cachedData = await AsyncStorage.getItem('cached_vendors');
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          
          // Return cached data if it's not too old (1 hour)
          const ONE_HOUR = 60 * 60 * 1000; // in milliseconds
          if (Date.now() - parsed.timestamp < ONE_HOUR) {
            Logger.info(LogCategory.VENDORS, 'Using cached vendor data');
            return parsed.data;
          }
        }
      } catch (cacheError) {
        Logger.warn(LogCategory.STORAGE, 'Failed to retrieve cached vendors', { cacheError });
      }
      
      throw handleApiError(error);
    }
  },
  
  /**
   * Get a vendor by ID
   * @param {string} id - Vendor ID
   * @returns {Promise<Object>} - Vendor object
   */
  getById: async (id) => {
    try {
      const response = await apiClient.get(`/vendors/${id}`);
      
      // Cache the individual vendor
      if (response.data) {
        try {
          await AsyncStorage.setItem(
            `vendor_${id}`, 
            JSON.stringify({
              timestamp: Date.now(),
              data: response.data
            })
          );
        } catch (cacheError) {
          Logger.warn(LogCategory.STORAGE, `Failed to cache vendor ${id}`, { cacheError });
        }
      }
      
      return response.data;
    } catch (error) {
      // Try to get cached vendor if network request fails
      Logger.error(LogCategory.VENDORS, `Failed to fetch vendor ${id} from API`, { error });
      
      try {
        const cachedData = await AsyncStorage.getItem(`vendor_${id}`);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          
          // Return cached data if it's not too old (1 hour)
          const ONE_HOUR = 60 * 60 * 1000; // in milliseconds
          if (Date.now() - parsed.timestamp < ONE_HOUR) {
            Logger.info(LogCategory.VENDORS, `Using cached data for vendor ${id}`);
            return parsed.data;
          }
        }
      } catch (cacheError) {
        Logger.warn(LogCategory.STORAGE, `Failed to retrieve cached vendor ${id}`, { cacheError });
      }
      
      throw handleApiError(error);
    }
  },
  
  /**
   * Get recent vendors the user has visited
   * @param {number} limit - Maximum number of vendors to return
   * @returns {Promise<Array>} - Array of recently visited vendors
   */
  getRecentVendors: async (limit = 5) => {
    try {
      const response = await apiClient.get('/vendors/recent', { params: { limit } });
      return response.data;
    } catch (error) {
      // For this endpoint, we'll try to build from local storage if the API fails
      Logger.error(LogCategory.VENDORS, 'Failed to fetch recent vendors from API', { error });
      
      try {
        // Try to build recent vendors from check-in history
        const recentVisits = await AsyncStorage.getItem('checkin_history');
        if (recentVisits) {
          const visits = JSON.parse(recentVisits);
          
          // Get unique vendor IDs from visits
          const uniqueVendorIds = [...new Set(visits.map(visit => visit.vendorId))];
          const recentVendorIds = uniqueVendorIds.slice(0, limit);
          
          // Try to get vendor details for each ID from cache
          const recentVendors = [];
          
          for (const vendorId of recentVendorIds) {
            const cachedVendor = await AsyncStorage.getItem(`vendor_${vendorId}`);
            if (cachedVendor) {
              const parsed = JSON.parse(cachedVendor);
              recentVendors.push({
                ...parsed.data,
                lastVisit: visits.find(v => v.vendorId === vendorId)?.timestamp
              });
            }
          }
          
          if (recentVendors.length > 0) {
            return recentVendors;
          }
        }
      } catch (localError) {
        Logger.warn(LogCategory.STORAGE, 'Failed to build recent vendors from local data', { localError });
      }
      
      throw handleApiError(error);
    }
  },
  
  /**
   * Get vendors with active deals
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of vendors with active deals
   */
  getVendorsWithDeals: async (options = {}) => {
    try {
      const response = await apiClient.get('/vendors/deals', { params: options });
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Failed to fetch vendors with deals', { error });
      throw handleApiError(error);
    }
  },
  
  /**
   * Check in at a vendor
   * @param {string} vendorId - Vendor ID
   * @param {Object} options - Check-in options
   * @returns {Promise<Object>} - Check-in result
   */
  checkIn: async (vendorId, options = {}) => {
    try {
      const response = await apiClient.post(`/vendors/${vendorId}/checkin`, options);
      
      // Add to local check-in history
      try {
        const historyKey = 'checkin_history';
        let history = [];
        
        const existingHistory = await AsyncStorage.getItem(historyKey);
        if (existingHistory) {
          history = JSON.parse(existingHistory);
        }
        
        history.unshift({
          vendorId,
          vendorName: response.data.vendorName || 'Unknown Vendor',
          timestamp: new Date().toISOString(),
          pointsEarned: response.data.pointsEarned || 0
        });
        
        // Keep only last 20 check-ins
        if (history.length > 20) {
          history = history.slice(0, 20);
        }
        
        await AsyncStorage.setItem(historyKey, JSON.stringify(history));
      } catch (storageError) {
        Logger.warn(LogCategory.STORAGE, 'Failed to update check-in history', { storageError });
      }
      
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.CHECKIN, `Failed to check in at vendor ${vendorId}`, { error });
      throw handleApiError(error);
    }
  },
  
  /**
   * Add a vendor to user's favorites
   * @param {string} vendorId - Vendor ID
   * @returns {Promise<Object>} - Result
   */
  addToFavorites: async (vendorId) => {
    try {
      const response = await apiClient.post(`/vendors/${vendorId}/favorite`);
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, `Failed to add vendor ${vendorId} to favorites`, { error });
      throw handleApiError(error);
    }
  },
  
  /**
   * Remove a vendor from user's favorites
   * @param {string} vendorId - Vendor ID
   * @returns {Promise<Object>} - Result
   */
  removeFromFavorites: async (vendorId) => {
    try {
      const response = await apiClient.delete(`/vendors/${vendorId}/favorite`);
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, `Failed to remove vendor ${vendorId} from favorites`, { error });
      throw handleApiError(error);
    }
  },
  
  /**
   * Get the user's favorite vendors
   * @returns {Promise<Array>} - Array of favorite vendors
   */
  getFavorites: async () => {
    try {
      const response = await apiClient.get('/vendors/favorites');
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Failed to fetch favorite vendors', { error });
      throw handleApiError(error);
    }
  }
};

export default VendorService;