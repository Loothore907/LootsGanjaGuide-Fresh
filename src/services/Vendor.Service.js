// src/services/Vendor.Service.js
import { Logger, LogCategory } from '../services/LoggingService';
import { VendorRepository } from '../repositories/repositoryExports';
import { calculateDistance } from '../utils/locationUtils';

export const vendorService = {
  getAllVendors: async () => {
    try {
      Logger.info(LogCategory.VENDORS, 'Getting all vendors');
      return await VendorRepository.getAll();
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error getting all vendors', { error });
      return [];
    }
  },
  
  getVendorById: async (id) => {
    try {
      Logger.info(LogCategory.VENDORS, 'Getting vendor by ID', { vendorId: id });
      const vendor = await VendorRepository.getById(id);
      if (!vendor) {
        Logger.warn(LogCategory.VENDORS, `Vendor with ID ${id} not found`);
      }
      return vendor;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, `Error getting vendor with ID ${id}`, { error });
      return null;
    }
  },
  
  searchVendors: async ({ dealType, maxDistance, maxResults, currentLocation }) => {
    try {
      Logger.info(LogCategory.VENDORS, 'Searching vendors', {
        dealType,
        maxDistance,
        maxResults,
        hasLocation: !!currentLocation
      });
      
      // Get all vendors with user location for distance calculation
      const allVendors = await VendorRepository.getAll({
        userLocation: currentLocation
      });
      
      // Filter vendors by dealType and maxDistance
      let filtered = [...allVendors];
      
      // Filter by deal type if specified
      if (dealType) {
        filtered = filtered.filter(vendor => {
          // For birthday deals
          if (dealType === 'birthday' && vendor.deals?.birthday) {
            return true;
          }
          
          // For daily deals
          if (dealType === 'daily') {
            const today = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' });
            return vendor.deals?.daily && vendor.deals.daily[today] && vendor.deals.daily[today].length > 0;
          }
          
          // For special deals
          if (dealType === 'special') {
            const now = new Date();
            return vendor.deals?.specials && vendor.deals.specials.some(special => {
              const startDate = special.startDate ? new Date(special.startDate) : null;
              const endDate = special.endDate ? new Date(special.endDate) : null;
              
              return (!startDate || now >= startDate) && (!endDate || now <= endDate);
            });
          }
          
          return false;
        });
      }
      
      // Filter by distance if specified and location is available
      if (maxDistance && currentLocation) {
        filtered = filtered.filter(vendor => {
          return vendor.distance && vendor.distance <= maxDistance;
        });
      }
      
      // Sort by distance
      filtered.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
      
      // Limit results if specified
      if (maxResults && maxResults > 0) {
        filtered = filtered.slice(0, maxResults);
      }
      
      Logger.info(LogCategory.VENDORS, `Found ${filtered.length} vendors matching criteria`);
      return filtered;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error searching vendors', { error });
      return [];
    }
  },
  
  // Add additional methods that might be used in the app
  getFavoriteVendors: async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Logger.warn(LogCategory.VENDORS, 'Cannot get favorite vendors: User not logged in');
        return [];
      }
      
      const userFavorites = await VendorRepository.getUserFavorites(userId);
      return userFavorites;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error getting favorite vendors', { error });
      return [];
    }
  },
  
  getRecentVendors: async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Logger.warn(LogCategory.VENDORS, 'Cannot get recent vendors: User not logged in');
        return [];
      }
      
      const recentVisits = await VendorRepository.getUserRecentVisits(userId);
      return recentVisits;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error getting recent vendors', { error });
      return [];
    }
  },
  
  toggleFavorite: async (vendorId) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Logger.warn(LogCategory.VENDORS, 'Cannot toggle favorite: User not logged in');
        return { success: false, error: 'User not logged in' };
      }
      
      const result = await VendorRepository.toggleFavorite(userId, vendorId);
      Logger.info(LogCategory.VENDORS, 'Toggled favorite status', { vendorId, result });
      return { success: true };
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error toggling favorite status', { vendorId, error });
      return { success: false, error: error.message };
    }
  }
};

// For easy access in components that need it
export default vendorService;