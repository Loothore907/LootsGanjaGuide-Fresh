// src/utils/CacheTest.js
import { Logger, LogCategory } from '../services/LoggingService';
import { vendorCacheService } from '../services/VendorCacheService';
import { dealCacheService } from '../services/DealCacheService';
import dataLoaderService from '../services/DataLoaderService';
import VendorRepository from '../repositories/VendorRepository';
import DealRepository from '../repositories/DealRepository';

/**
 * Test utility for verifying the caching implementation
 * This can be run from the developer tools or via a test screen
 */
class CacheTest {
  /**
   * Run a full test of the caching system
   * @returns {Promise<Object>} Test results
   */
  async runFullTest() {
    Logger.info(LogCategory.GENERAL, '🧪 Starting cache system test');
    const results = {
      vendorCache: { success: false, count: 0, time: 0 },
      dealCache: { success: false, count: 0, time: 0 },
      vendorRepo: { success: false, count: 0, time: 0 },
      dealRepo: { success: false, count: 0, time: 0 },
      dataLoader: { success: false, time: 0 }
    };

    try {
      // Test 1: Test data loader service
      const dataLoaderStart = Date.now();
      const dataLoaderResult = await dataLoaderService.initialize({ force: true });
      const dataLoaderTime = Date.now() - dataLoaderStart;
      
      results.dataLoader = {
        success: dataLoaderResult,
        time: dataLoaderTime
      };
      
      Logger.info(LogCategory.GENERAL, `🧪 Data loader test: ${dataLoaderResult ? 'SUCCESS' : 'FAILED'}`, {
        time: `${dataLoaderTime}ms`
      });

      // Test 2: Test vendor cache service directly
      const vendorCacheStart = Date.now();
      const vendors = vendorCacheService.getAllVendors();
      const vendorCacheTime = Date.now() - vendorCacheStart;
      
      results.vendorCache = {
        success: Array.isArray(vendors) && vendors.length > 0,
        count: vendors.length,
        time: vendorCacheTime
      };
      
      Logger.info(LogCategory.GENERAL, `🧪 Vendor cache test: ${results.vendorCache.success ? 'SUCCESS' : 'FAILED'}`, {
        count: vendors.length,
        time: `${vendorCacheTime}ms`
      });

      // Test 3: Test deal cache service directly
      const dealCacheStart = Date.now();
      const deals = dealCacheService.getAllDeals();
      const dealCacheTime = Date.now() - dealCacheStart;
      
      results.dealCache = {
        success: Array.isArray(deals) && deals.length > 0,
        count: deals.length,
        time: dealCacheTime
      };
      
      Logger.info(LogCategory.GENERAL, `🧪 Deal cache test: ${results.dealCache.success ? 'SUCCESS' : 'FAILED'}`, {
        count: deals.length,
        time: `${dealCacheTime}ms`
      });

      // Test 4: Test vendor repository with cache
      const vendorRepoStart = Date.now();
      const vendorsFromRepo = await VendorRepository.getAll();
      const vendorRepoTime = Date.now() - vendorRepoStart;
      
      results.vendorRepo = {
        success: Array.isArray(vendorsFromRepo) && vendorsFromRepo.length > 0,
        count: vendorsFromRepo.length,
        time: vendorRepoTime
      };
      
      Logger.info(LogCategory.GENERAL, `🧪 Vendor repo test: ${results.vendorRepo.success ? 'SUCCESS' : 'FAILED'}`, {
        count: vendorsFromRepo.length,
        time: `${vendorRepoTime}ms`
      });

      // Test 5: Test deal repository with cache
      const dealRepoStart = Date.now();
      const dealsFromRepo = await DealRepository.getAll();
      const dealRepoTime = Date.now() - dealRepoStart;
      
      results.dealRepo = {
        success: Array.isArray(dealsFromRepo) && dealsFromRepo.length > 0,
        count: dealsFromRepo.length,
        time: dealRepoTime
      };
      
      Logger.info(LogCategory.GENERAL, `🧪 Deal repo test: ${results.dealRepo.success ? 'SUCCESS' : 'FAILED'}`, {
        count: dealsFromRepo.length,
        time: `${dealRepoTime}ms`
      });

      // Log overall results
      const allTestsPassed = Object.values(results).every(r => r.success);
      Logger.info(LogCategory.GENERAL, `🧪 Cache system test complete: ${allTestsPassed ? 'ALL PASSED' : 'SOME FAILED'}`, results);
      
      return {
        success: allTestsPassed,
        results
      };
    } catch (error) {
      Logger.error(LogCategory.GENERAL, '🧪 Cache system test failed with error', { error });
      return {
        success: false,
        error: error.message,
        results
      };
    }
  }

  /**
   * Test cache performance by comparing cached vs uncached requests
   * @returns {Promise<Object>} Performance comparison results
   */
  async testPerformance() {
    Logger.info(LogCategory.GENERAL, '🧪 Starting cache performance test');
    
    try {
      // First, ensure cache is loaded
      await dataLoaderService.initialize({ force: true });
      
      // Test 1: Get all vendors with cache
      const cachedVendorStart = Date.now();
      const cachedVendors = await VendorRepository.getAll();
      const cachedVendorTime = Date.now() - cachedVendorStart;
      
      // Test 2: Get all vendors without cache
      const uncachedVendorStart = Date.now();
      const uncachedVendors = await VendorRepository.getAll({ bypassCache: true });
      const uncachedVendorTime = Date.now() - uncachedVendorStart;
      
      // Test 3: Get all deals with cache
      const cachedDealStart = Date.now();
      const cachedDeals = await DealRepository.getAll();
      const cachedDealTime = Date.now() - cachedDealStart;
      
      // Test 4: Get all deals without cache
      const uncachedDealStart = Date.now();
      const uncachedDeals = await DealRepository.getAll({ bypassCache: true });
      const uncachedDealTime = Date.now() - uncachedDealStart;
      
      // Calculate performance improvements
      const vendorSpeedup = uncachedVendorTime > 0 ? 
        (uncachedVendorTime / cachedVendorTime).toFixed(2) : 'N/A';
      
      const dealSpeedup = uncachedDealTime > 0 ? 
        (uncachedDealTime / cachedDealTime).toFixed(2) : 'N/A';
      
      const results = {
        vendors: {
          cached: { time: cachedVendorTime, count: cachedVendors.length },
          uncached: { time: uncachedVendorTime, count: uncachedVendors.length },
          speedup: vendorSpeedup
        },
        deals: {
          cached: { time: cachedDealTime, count: cachedDeals.length },
          uncached: { time: uncachedDealTime, count: uncachedDeals.length },
          speedup: dealSpeedup
        }
      };
      
      Logger.info(LogCategory.GENERAL, '🧪 Cache performance test results', results);
      
      return {
        success: true,
        results
      };
    } catch (error) {
      Logger.error(LogCategory.GENERAL, '🧪 Cache performance test failed with error', { error });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create and export singleton instance
const cacheTest = new CacheTest();
export default cacheTest; 