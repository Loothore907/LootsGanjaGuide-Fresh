// src/utils/AppInitializer.js
import { Logger, LogCategory } from '../services/LoggingService';
import { auth, hasValidFirebaseConfig } from '../config/firebase';
import { handleError } from './ErrorHandler';
import serviceProvider from '../services/ServiceProvider';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseAuthAdapter from '../services/adapters/FirebaseAuthAdapter';
import dataLoaderService from '../services/DataLoaderService';
import { vendorCacheService } from '../services/VendorCacheService';
import { dealCacheService } from '../services/DealCacheService';

/**
 * Handles app initialization tasks
 * Now exclusively uses Firebase with live data
 * Includes improved caching functionality
 */
class AppInitializer {
  constructor() {
    this.isInitialized = false;
    this.authListener = null;
    this.userAuthState = null;
    this.CACHE_TIMESTAMP_KEY = 'data_cache_timestamp';
    this.CACHE_MAX_AGE = 60 * 60 * 1000; // 1 hour in milliseconds
  }

  /**
   * Initialize the app
   * @param {Object} options - Initialization options
   * @param {Function} options.onAuthChange - Callback for auth state changes
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(options = {}) {
    if (this.isInitialized) return true;
    
    const { onAuthChange = null } = options;
    
    try {
      Logger.info(LogCategory.GENERAL, 'Initializing app');
      
      // Check if Firebase is configured
      if (!hasValidFirebaseConfig) {
        Logger.error(LogCategory.GENERAL, 'Firebase not configured properly');
        return false;
      }
      
      // Set up auth listener
      if (onAuthChange) {
        this.setupAuthListener(onAuthChange);
      }
      
      // First, check if we have cached data that can be loaded immediately
      const hasValidCache = await this.loadFromLocalCache();
      
      // Preload app data in the background regardless of cache status
      // to ensure we have the latest data
      const dataLoadPromise = this.preloadAppData();
      
      // If we have valid cache, we can mark as initialized immediately
      if (hasValidCache) {
        this.isInitialized = true;
        
        // Still wait for the data load to complete in the background
        dataLoadPromise.then(success => {
          if (success) {
            // Save the updated data to cache
            this.saveToLocalCache();
          }
        });
        
        Logger.info(LogCategory.GENERAL, 'App initialized with cached data');
        return true;
      }
      
      // Otherwise, wait for the data load to complete
      const dataLoaded = await dataLoadPromise;
      
      if (!dataLoaded) {
        Logger.error(LogCategory.GENERAL, 'Failed to load app data and no valid cache available');
        return false;
      }
      
      // Save the loaded data to cache
      await this.saveToLocalCache();
      
      Logger.info(LogCategory.GENERAL, 'Firebase ServiceProvider initialized successfully');
      this.isInitialized = true;
      return true;
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error initializing Firebase ServiceProvider', { error });
      throw error;
    }
  }

  /**
   * Set up Firebase auth state change listener
   * @param {Function} onAuthChange - Callback for auth state changes
   */
  setupAuthListener(onAuthChange) {
    if (this.authListener) {
      this.authListener();
      this.authListener = null;
    }
    
    this.authListener = onAuthStateChanged(auth, (user) => {
      this.userAuthState = user;
      
      Logger.info(LogCategory.AUTH, user 
        ? `User authenticated: ${user.uid}` 
        : 'User signed out'
      );
      
      // Call the callback if provided
      if (typeof onAuthChange === 'function') {
        onAuthChange(user);
      }
    });
  }

  /**
   * Clean up resources when the app is shutting down
   */
  cleanup() {
    // Remove auth listener if present
    if (this.authListener) {
      this.authListener();
      this.authListener = null;
    }
    
    Logger.info(LogCategory.GENERAL, 'App cleanup performed');
  }

  /**
   * Preload and cache common app data
   * @returns {Promise<boolean>} Whether data was loaded successfully
   * @private
   */
  async preloadAppData() {
    try {
      // Use the DataLoaderService to preload all app data
      const success = await dataLoaderService.initialize({
        background: true, // Load in background
        priority: 'high'  // High priority for initial load
      });
      
      if (success) {
        Logger.info(LogCategory.GENERAL, 'Initial app data preloaded successfully');
      } else {
        Logger.warn(LogCategory.GENERAL, 'Some data failed to preload');
      }
      
      // Also preload featured deals separately for immediate display
      serviceProvider.getFeaturedDeals({ limit: 20 }).catch(err => {
        Logger.warn(LogCategory.DEALS, 'Failed to preload featured deals', { err });
      });
      
      return success;
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error during data preloading', { error });
      return false;
    }
  }

  /**
   * Try to load data from local cache
   * @returns {Promise<boolean>} Whether valid cache was loaded
   */
  async loadFromLocalCache() {
    try {
      // Check for cached data timestamp
      const cacheTimestamp = await AsyncStorage.getItem(this.CACHE_TIMESTAMP_KEY);
      
      if (!cacheTimestamp) {
        return false;
      }
      
      // Check if cache is still valid (within max age)
      const timestamp = parseInt(cacheTimestamp, 10);
      const now = Date.now();
      const cacheAge = now - timestamp;
      
      if (cacheAge > this.CACHE_MAX_AGE) {
        Logger.info(LogCategory.GENERAL, 'Cache is too old, will refresh', {
          cacheAge: Math.round(cacheAge / 1000 / 60),
          maxCacheAge: Math.round(this.CACHE_MAX_AGE / 1000 / 60)
        });
        return false;
      }
      
      // Load vendors from cache
      const vendorsJson = await AsyncStorage.getItem('cached_vendors');
      if (vendorsJson) {
        const vendors = JSON.parse(vendorsJson);
        if (Array.isArray(vendors) && vendors.length > 0) {
          vendorCacheService.setVendorData(vendors);
        }
      }
      
      // Load deals from cache
      const dealsJson = await AsyncStorage.getItem('cached_deals');
      if (dealsJson) {
        const deals = JSON.parse(dealsJson);
        if (Array.isArray(deals) && deals.length > 0) {
          dealCacheService.setDealData(deals);
        }
      }
      
      Logger.info(LogCategory.GENERAL, 'Loaded data from local cache', {
        timestamp: new Date(parseInt(cacheTimestamp, 10)).toISOString(),
        vendorCount: vendorCacheService.getAllVendors().length,
        dealCount: dealCacheService.getAllDeals().length
      });
      
      return vendorCacheService.isCacheLoaded() && dealCacheService.isCacheLoaded();
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error loading from local cache', { error });
      return false;
    }
  }

  /**
   * Save current cache to local storage
   * @returns {Promise<boolean>} Success status
   */
  async saveToLocalCache() {
    try {
      if (!vendorCacheService.isCacheLoaded() || !dealCacheService.isCacheLoaded()) {
        Logger.warn(LogCategory.GENERAL, 'Cannot save to cache, data not loaded');
        return false;
      }
      
      // Save vendors
      const vendors = vendorCacheService.getAllVendors();
      await AsyncStorage.setItem('cached_vendors', JSON.stringify(vendors));
      
      // Save deals
      const deals = dealCacheService.getAllDeals();
      await AsyncStorage.setItem('cached_deals', JSON.stringify(deals));
      
      // Save timestamp
      await AsyncStorage.setItem(this.CACHE_TIMESTAMP_KEY, Date.now().toString());
      
      Logger.info(LogCategory.GENERAL, 'Saved data to local cache', {
        vendorCount: vendors.length,
        dealCount: deals.length
      });
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error saving to local cache', { error });
      return false;
    }
  }

  /**
   * Clear all cached data
   * @returns {Promise<boolean>} Success status
   */
  async clearCache() {
    try {
      await AsyncStorage.multiRemove([
        'cached_vendors',
        'cached_deals',
        this.CACHE_TIMESTAMP_KEY
      ]);
      
      // Reset in-memory caches if the services have a reset method
      if (typeof vendorCacheService.reset === 'function') {
        vendorCacheService.reset();
      }
      
      if (typeof dealCacheService.reset === 'function') {
        dealCacheService.reset();
      }
      
      Logger.info(LogCategory.GENERAL, 'Cache cleared successfully');
      return true;
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error clearing cache', { error });
      return false;
    }
  }
}

// Create and export singleton instance
const appInitializer = new AppInitializer();
export default appInitializer;