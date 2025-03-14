// src/services/DataLoaderService.js
import { Logger, LogCategory } from './LoggingService';
import { vendorCacheService } from './VendorCacheService';
import { dealCacheService } from './DealCacheService';

/**
 * Service for loading and synchronizing app data
 * Coordinates loading of vendors and deals into cache
 */
class DataLoaderService {
  constructor() {
    this.isLoading = false;
    this.lastLoadTime = null;
  }

  /**
   * Initialize all data caches
   * @param {Object} options - Load options
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(options = {}) {
    if (this.isLoading) {
      Logger.warn(LogCategory.GENERAL, 'Data loader already in progress, skipping new request');
      return false;
    }

    this.isLoading = true;
    try {
      Logger.info(LogCategory.GENERAL, 'Initializing app data', options);
      
      // Load vendors first (they should be loaded before deals)
      const vendorsSuccess = await vendorCacheService.loadAllVendors(options);
      
      if (!vendorsSuccess) {
        Logger.error(LogCategory.GENERAL, 'Failed to load vendors, aborting data initialization');
        return false;
      }
      
      // Now load deals
      const dealsSuccess = await dealCacheService.loadAllDeals(options);
      
      if (!dealsSuccess) {
        Logger.error(LogCategory.GENERAL, 'Failed to load deals, data initialization incomplete');
        return false;
      }
      
      this.lastLoadTime = new Date();
      Logger.info(LogCategory.GENERAL, 'App data initialization complete', {
        vendorsLoaded: vendorCacheService.getAllVendors().length,
        dealsLoaded: dealCacheService.getAllDeals().length,
        timestamp: this.lastLoadTime
      });
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error during data initialization', { error });
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Refresh all cached data
   * @param {Object} options - Refresh options
   * @returns {Promise<boolean>} - Success status
   */
  async refreshData(options = {}) {
    return this.initialize({ ...options, force: true });
  }

  /**
   * Check if cache needs refresh based on time threshold
   * @param {number} thresholdMinutes - Minutes threshold for cache refresh
   * @returns {boolean} - Whether cache needs refresh
   */
  needsRefresh(thresholdMinutes = 30) {
    if (!this.lastLoadTime) return true;
    
    const now = new Date();
    const diffMs = now - this.lastLoadTime;
    const diffMinutes = diffMs / (1000 * 60);
    
    return diffMinutes > thresholdMinutes;
  }
}

// Create and export singleton instance
const dataLoaderService = new DataLoaderService();
export default dataLoaderService; 