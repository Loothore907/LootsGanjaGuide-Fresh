// services.js
// This file exports services from the src/services directory for easier imports

import dataLoaderService from './src/services/DataLoaderService';
import { vendorCacheService } from './src/services/VendorCacheService';
import { dealCacheService } from './src/services/DealCacheService';
import DealRepository from './src/repositories/DealRepository';
import VendorRepository from './src/repositories/VendorRepository';

// Export services
export const dataLoader = dataLoaderService;
export const vendorCache = vendorCacheService;
export const dealCache = dealCacheService;
export const dealRepository = DealRepository;
export const vendorRepository = VendorRepository;

// Default export for convenience
export default {
  dataLoader: dataLoaderService,
  vendorCache: vendorCacheService,
  dealCache: dealCacheService,
  dealRepository: DealRepository,
  vendorRepository: VendorRepository
}; 