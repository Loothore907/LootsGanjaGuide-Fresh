// src/services/api/DealService.js
import apiClient, { handleApiError } from './Client';
import { Logger, LogCategory } from '../LoggingService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import env from '../../config/env';

/**
 * Service for handling deal-related API requests
 */
export const DealService = {
  /**
   * Get all deals with optional filtering
   * @param {Object} options - Filter options
   * @param {string} options.type - Deal type (birthday, daily, special)
   * @param {string} options.day - Day of week for daily deals
   * @param {string} options.category - Deal category
   * @param {number} options.maxDistance - Maximum distance in miles
   * @param {boolean} options.activeOnly - Show only active deals
   * @param {number} options.limit - Maximum number of results
   * @param {number} options.offset - Offset for pagination
   * @returns {Promise<Array>} - Array of deals
   */
  getAll: async (options = {}) => {
    try {
      const response = await apiClient.get('/deals', { params: options });
      
      // Cache the result if successful
      if (response.data && Array.isArray(response.data)) {
        try {
          const cacheKey = `deals_${JSON.stringify(options)}`;
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({
              timestamp: Date.now(),
              data: response.data
            })
          );
        } catch (cacheError) {
          Logger.warn(LogCategory.STORAGE, 'Failed to cache deals', { cacheError });
        }
      }
      
      return response.data;
    } catch (error) {
      // Try to get cached data if network request fails
      Logger.error(LogCategory.DEALS, 'Failed to fetch deals from API', { error });
      
      try {
        const cacheKey = `deals_${JSON.stringify(options)}`;
        const cachedData = await AsyncStorage.getItem(cacheKey);
        
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          
          // Return cached data if it's not too old (1 hour)
          if (Date.now() - parsed.timestamp < env.CACHE_TTL) {
            Logger.info(LogCategory.DEALS, 'Using cached deal data');
            return parsed.data;
          }
        }
      } catch (cacheError) {
        Logger.warn(LogCategory.STORAGE, 'Failed to retrieve cached deals', { cacheError });
      }
      
      throw handleApiError(error);
    }
  },
  
  /**
   * Get a deal by ID
   * @param {string} id - Deal ID
   * @returns {Promise<Object>} - Deal object
   */
  getById: async (id) => {
    try {
      const response = await apiClient.get(`/deals/${id}`);
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.DEALS, `Failed to fetch deal ${id}`, { error });
      throw handleApiError(error);
    }
  },
  
  /**
   * Get featured deals
   * @param {number} limit - Maximum number of deals to return
   * @returns {Promise<Array>} - Array of featured deals
   */
  getFeatured: async (limit = 5) => {
    try {
      const response = await apiClient.get('/deals/featured', { params: { limit } });
      
      // Cache featured deals
      if (response.data && Array.isArray(response.data)) {
        try {
          await AsyncStorage.setItem(
            'featured_deals', 
            JSON.stringify({
              timestamp: Date.now(),
              data: response.data
            })
          );
        } catch (cacheError) {
          Logger.warn(LogCategory.STORAGE, 'Failed to cache featured deals', { cacheError });
        }
      }
      
      return response.data;
    } catch (error) {
      // Try to get cached featured deals if network request fails
      Logger.error(LogCategory.DEALS, 'Failed to fetch featured deals from API', { error });
      
      try {
        const cachedData = await AsyncStorage.getItem('featured_deals');
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          
          // Return cached data if it's not too old (1 hour)
          if (Date.now() - parsed.timestamp < env.CACHE_TTL) {
            Logger.info(LogCategory.DEALS, 'Using cached featured deals');
            return parsed.data;
          }
        }
      } catch (cacheError) {
        Logger.warn(LogCategory.STORAGE, 'Failed to retrieve cached featured deals', { cacheError });
      }
      
      throw handleApiError(error);
    }
  },
  
  /**
   * Get daily deals for a specific day
   * @param {string} day - Day of week (lowercase)
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of daily deals
   */
  getDailyDeals: async (day, options = {}) => {
    try {
      // Validate day parameter
      if (!env.DAYS_OF_WEEK.includes(day)) {
        throw new Error(`Invalid day: ${day}. Must be one of: ${env.DAYS_OF_WEEK.join(', ')}`);
      }
      
      const response = await apiClient.get(`/deals/daily/${day}`, { params: options });
      
      // Cache daily deals
      if (response.data && Array.isArray(response.data)) {
        try {
          const cacheKey = `daily_deals_${day}_${JSON.stringify(options)}`;
          await AsyncStorage.setItem(
            cacheKey, 
            JSON.stringify({
              timestamp: Date.now(),
              data: response.data
            })
          );
        } catch (cacheError) {
          Logger.warn(LogCategory.STORAGE, `Failed to cache daily deals for ${day}`, { cacheError });
        }
      }
      
      return response.data;
    } catch (error) {
      // Try to get cached daily deals if network request fails
      Logger.error(LogCategory.DEALS, `Failed to fetch daily deals for ${day}`, { error });
      
      try {
        const cacheKey = `daily_deals_${day}_${JSON.stringify(options)}`;
        const cachedData = await AsyncStorage.getItem(cacheKey);
        
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          
          // Return cached data if it's not too old
          if (Date.now() - parsed.timestamp < env.CACHE_TTL) {
            Logger.info(LogCategory.DEALS, `Using cached daily deals for ${day}`);
            return parsed.data;
          }
        }
      } catch (cacheError) {
        Logger.warn(LogCategory.STORAGE, `Failed to retrieve cached daily deals for ${day}`, { cacheError });
      }
      
      throw handleApiError(error);
    }
  },
  
  /**
   * Get multi-day deals for a specific day
   * @param {string} day - Day of week (lowercase)
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of multi-day deals
   */
  getMultiDayDeals: async (day, options = {}) => {
    try {
      // Validate day parameter
      if (!env.DAYS_OF_WEEK.includes(day)) {
        throw new Error(`Invalid day: ${day}. Must be one of: ${env.DAYS_OF_WEEK.join(', ')}`);
      }
      
      const response = await apiClient.get(`/deals/multi-day/${day}`, { params: options });
      
      // Cache multi-day deals
      if (response.data && Array.isArray(response.data)) {
        try {
          const cacheKey = `multi_day_deals_${day}_${JSON.stringify(options)}`;
          await AsyncStorage.setItem(
            cacheKey, 
            JSON.stringify({
              timestamp: Date.now(),
              data: response.data
            })
          );
        } catch (cacheError) {
          Logger.warn(LogCategory.STORAGE, `Failed to cache multi-day deals for ${day}`, { cacheError });
        }
      }
      
      return response.data;
    } catch (error) {
      // Try to get cached multi-day deals if network request fails
      Logger.error(LogCategory.DEALS, `Failed to fetch multi-day deals for ${day}`, { error });
      
      try {
        const cacheKey = `multi_day_deals_${day}_${JSON.stringify(options)}`;
        const cachedData = await AsyncStorage.getItem(cacheKey);
        
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          
          // Return cached data if it's not too old
          if (Date.now() - parsed.timestamp < env.CACHE_TTL) {
            Logger.info(LogCategory.DEALS, `Using cached multi-day deals for ${day}`);
            return parsed.data;
          }
        }
      } catch (cacheError) {
        Logger.warn(LogCategory.STORAGE, `Failed to retrieve cached multi-day deals for ${day}`, { cacheError });
      }
      
      throw handleApiError(error);
    }
  },
  
  /**
   * Get birthday deals
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of birthday deals
   */
  getBirthdayDeals: async (options = {}) => {
    try {
      const response = await apiClient.get('/deals/birthday', { params: options });
      
      // Cache birthday deals
      if (response.data && Array.isArray(response.data)) {
        try {
          const cacheKey = `birthday_deals_${JSON.stringify(options)}`;
          await AsyncStorage.setItem(
            cacheKey, 
            JSON.stringify({
              timestamp: Date.now(),
              data: response.data
            })
          );
        } catch (cacheError) {
          Logger.warn(LogCategory.STORAGE, 'Failed to cache birthday deals', { cacheError });
        }
      }
      
      return response.data;
    } catch (error) {
      // Try to get cached birthday deals if network request fails
      Logger.error(LogCategory.DEALS, 'Failed to fetch birthday deals', { error });
      
      try {
        const cacheKey = `birthday_deals_${JSON.stringify(options)}`;
        const cachedData = await AsyncStorage.getItem(cacheKey);
        
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          
          // Return cached data if it's not too old
          if (Date.now() - parsed.timestamp < env.CACHE_TTL) {
            Logger.info(LogCategory.DEALS, 'Using cached birthday deals');
            return parsed.data;
          }
        }
      } catch (cacheError) {
        Logger.warn(LogCategory.STORAGE, 'Failed to retrieve cached birthday deals', { cacheError });
      }
      
      throw handleApiError(error);
    }
  },
  
  /**
   * Get special deals
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of special deals
   */
  getSpecialDeals: async (options = {}) => {
    try {
      const response = await apiClient.get('/deals/special', { params: options });
      
      // Cache special deals
      if (response.data && Array.isArray(response.data)) {
        try {
          const cacheKey = `special_deals_${JSON.stringify(options)}`;
          await AsyncStorage.setItem(
            cacheKey, 
            JSON.stringify({
              timestamp: Date.now(),
              data: response.data
            })
          );
        } catch (cacheError) {
          Logger.warn(LogCategory.STORAGE, 'Failed to cache special deals', { cacheError });
        }
      }
      
      return response.data;
    } catch (error) {
      // Try to get cached special deals if network request fails
      Logger.error(LogCategory.DEALS, 'Failed to fetch special deals', { error });
      
      try {
        const cacheKey = `special_deals_${JSON.stringify(options)}`;
        const cachedData = await AsyncStorage.getItem(cacheKey);
        
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          
          // Return cached data if it's not too old
          if (Date.now() - parsed.timestamp < env.CACHE_TTL) {
            Logger.info(LogCategory.DEALS, 'Using cached special deals');
            return parsed.data;
          }
        }
      } catch (cacheError) {
        Logger.warn(LogCategory.STORAGE, 'Failed to retrieve cached special deals', { cacheError });
      }
      
      throw handleApiError(error);
    }
  },
  
  /**
   * Create an optimized route from a list of deals
   * @param {Array<string>} dealIds - Array of deal IDs
   * @param {Object} options - Route options
   * @returns {Promise<Object>} - Route object with vendors and navigation info
   */
  createRoute: async (dealIds, options = {}) => {
    try {
      const response = await apiClient.post('/deals/route', { 
        dealIds, 
        ...options 
      });
      
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.NAVIGATION, 'Failed to create route from deals', { error, dealIds });
      throw handleApiError(error);
    }
  }
};

export default DealService;