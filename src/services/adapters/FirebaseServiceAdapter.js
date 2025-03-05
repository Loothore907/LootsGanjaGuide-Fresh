// src/services/adapters/FirebaseServiceAdapter.js
import { Logger, LogCategory } from '../LoggingService';
import { 
  VendorRepository,
  DealRepository, 
  UserRepository,
  JourneyRepository
} from '../../repositories/repositoryExports';
import locationService from '../LocationService';

/**
 * Adapter class that bridges existing service calls to Firebase repositories
 * This provides a smooth transition path from mock data to Firebase
 */
class FirebaseServiceAdapter {
  constructor() {
    this.vendorRepository = VendorRepository;
    this.dealRepository = DealRepository;
    this.userRepository = UserRepository;
    this.journeyRepository = JourneyRepository;
  }

  /**
   * Initialize Firebase adapter
   */
  async initialize() {
    Logger.info(LogCategory.GENERAL, 'Initializing Firebase Service Adapter');
  }

  /**
   * Vendor service adapters
   */
  async getAllVendors(options = {}) {
    try {
      // Get user location for distance calculations if needed
      let userLocation = null;
      if (options.includeDistance !== false) {
        userLocation = await locationService.getCurrentLocation();
      }

      // Map options to Firebase repository format
      const repoOptions = {
        ...options,
        userLocation
      };

      // Convert filters if present
      if (options.dealType) {
        repoOptions.filters = [
          ...(repoOptions.filters || []),
          ['deals.' + options.dealType, '!=', null]
        ];
      }

      // Get vendors from Firebase
      return await this.vendorRepository.getAll(repoOptions);
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error in getAllVendors adapter', { error });
      throw error;
    }
  }

  async getVendorById(vendorId) {
    try {
      if (!vendorId) throw new Error('Vendor ID is required');
      return await this.vendorRepository.getById(vendorId);
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error in getVendorById adapter', { error, vendorId });
      throw error;
    }
  }

  async getRecentVendors(limit = 5) {
    try {
      // Get current user ID from Firebase Auth
      const userId = this.vendorRepository.getCurrentUserId();
      if (!userId) {
        return []; // No logged-in user, return empty array
      }
      
      return await this.vendorRepository.getRecentVendors(userId, limit);
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error in getRecentVendors adapter', { error });
      throw error;
    }
  }

  async checkInAtVendor(vendorId, options = {}) {
    try {
      if (!vendorId) throw new Error('Vendor ID is required');
      
      // Get current user ID from Firebase Auth
      const userId = this.vendorRepository.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be authenticated to check in');
      }
      
      return await this.vendorRepository.checkIn(vendorId, userId, options);
    } catch (error) {
      Logger.error(LogCategory.CHECKIN, 'Error in checkInAtVendor adapter', { error, vendorId });
      throw error;
    }
  }

  async addToFavorites(vendorId) {
    try {
      if (!vendorId) throw new Error('Vendor ID is required');
      
      // Get current user ID from Firebase Auth
      const userId = this.vendorRepository.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be authenticated to add favorites');
      }
      
      return await this.vendorRepository.addToFavorites(vendorId, userId);
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error in addToFavorites adapter', { error, vendorId });
      throw error;
    }
  }

  async removeFromFavorites(vendorId) {
    try {
      if (!vendorId) throw new Error('Vendor ID is required');
      
      // Get current user ID from Firebase Auth
      const userId = this.vendorRepository.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be authenticated to remove favorites');
      }
      
      return await this.vendorRepository.removeFromFavorites(vendorId, userId);
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error in removeFromFavorites adapter', { error, vendorId });
      throw error;
    }
  }

  async getFavorites() {
    try {
      // Get current user ID from Firebase Auth
      const userId = this.vendorRepository.getCurrentUserId();
      if (!userId) {
        return []; // No logged-in user, return empty array
      }
      
      return await this.vendorRepository.getFavorites(userId);
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error in getFavorites adapter', { error });
      throw error;
    }
  }

  /**
   * Deal service adapters
   */
  async getFeaturedDeals(options = {}) {
    try {
      // Get featured deals from Firebase
      return await this.dealRepository.getFeatured(options.limit || 5, options);
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error in getFeaturedDeals adapter', { error });
      throw error;
    }
  }

  async getDailyDeals(day, options = {}) {
    try {
      if (!day) {
        day = this.getCurrentDayOfWeek();
      }
      
      // Get user location for distance calculations if needed
      let userLocation = null;
      if (options.includeDistance !== false) {
        userLocation = await locationService.getCurrentLocation();
      }
      
      // Prepare options for repository
      const repoOptions = {
        ...options,
        userLocation
      };
      
      // Get daily deals from Firebase
      return await this.dealRepository.getDailyDeals(day, repoOptions);
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error in getDailyDeals adapter', { error, day });
      throw error;
    }
  }

  async getBirthdayDeals(options = {}) {
    try {
      // Get user location for distance calculations if needed
      let userLocation = null;
      if (options.includeDistance !== false) {
        userLocation = await locationService.getCurrentLocation();
      }
      
      // Prepare options for repository
      const repoOptions = {
        ...options,
        userLocation
      };
      
      // Get birthday deals from Firebase
      return await this.dealRepository.getBirthdayDeals(repoOptions);
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error in getBirthdayDeals adapter', { error });
      throw error;
    }
  }

  async getSpecialDeals(options = {}) {
    try {
      // Get user location for distance calculations if needed
      let userLocation = null;
      if (options.includeDistance !== false) {
        userLocation = await locationService.getCurrentLocation();
      }
      
      // Prepare options for repository
      const repoOptions = {
        ...options,
        userLocation
      };
      
      // Get special deals from Firebase
      return await this.dealRepository.getSpecialDeals(repoOptions);
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error in getSpecialDeals adapter', { error });
      throw error;
    }
  }

  /**
   * Journey/Route service adapters
   */
  async createOptimizedRoute(vendorIds, options = {}) {
    try {
      // Get user location for route creation
      let startLocation = options.startLocation;
      if (!startLocation) {
        startLocation = await locationService.getCurrentLocation();
        if (!startLocation) {
          throw new Error('Unable to get current location for route creation');
        }
      }
      
      // Create journey data structure
      const journeyData = {
        dealType: options.dealType || 'daily',
        vendors: [],
        maxDistance: options.maxDistance || 25,
        startLocation
      };
      
      // Get vendor details for each ID
      for (const vendorId of vendorIds) {
        const vendor = await this.vendorRepository.getById(vendorId);
        if (vendor) {
          journeyData.vendors.push(vendor);
        }
      }
      
      // Calculate route using Deal Repository
      return await this.dealRepository.createRoute(vendorIds, {
        ...options,
        userLocation: startLocation
      });
    } catch (error) {
      Logger.error(LogCategory.NAVIGATION, 'Error in createOptimizedRoute adapter', { error, vendorIds });
      throw error;
    }
  }

  async createJourney(journeyData) {
    try {
      return await this.journeyRepository.createJourney(journeyData);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error in createJourney adapter', { error });
      throw error;
    }
  }

  async getActiveJourney() {
    try {
      return await this.journeyRepository.getActiveJourney();
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error in getActiveJourney adapter', { error });
      throw error;
    }
  }

  async nextVendor(journeyId) {
    try {
      return await this.journeyRepository.nextVendor(journeyId);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error in nextVendor adapter', { error, journeyId });
      throw error;
    }
  }

  async skipVendor(journeyId, vendorIndex = null) {
    try {
      return await this.journeyRepository.skipVendor(journeyId, vendorIndex);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error in skipVendor adapter', { error, journeyId, vendorIndex });
      throw error;
    }
  }

  async checkInAtVendorDuringJourney(journeyId, vendorIndex, checkInType = 'qr') {
    try {
      return await this.journeyRepository.checkInAtVendor(journeyId, vendorIndex, checkInType);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error in checkInAtVendorDuringJourney adapter', { error, journeyId, vendorIndex });
      throw error;
    }
  }

  async completeJourney(journeyId) {
    try {
      return await this.journeyRepository.completeJourney(journeyId);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error in completeJourney adapter', { error, journeyId });
      throw error;
    }
  }

  async cancelJourney(journeyId) {
    try {
      return await this.journeyRepository.cancelJourney(journeyId);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error in cancelJourney adapter', { error, journeyId });
      throw error;
    }
  }

  async getRecentJourneys(limit = 5) {
    try {
      return await this.journeyRepository.getRecentJourneys(limit);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error in getRecentJourneys adapter', { error });
      throw error;
    }
  }

  /**
   * User service adapters
   */
  async registerWithEmail(data) {
    try {
      return await this.userRepository.registerWithEmail(data);
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error in registerWithEmail adapter', { error });
      throw error;
    }
  }

  async registerAnonymous(data) {
    try {
      return await this.userRepository.registerAnonymous(data);
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error in registerAnonymous adapter', { error });
      throw error;
    }
  }

  async loginWithEmail(data) {
    try {
      return await this.userRepository.loginWithEmail(data);
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error in loginWithEmail adapter', { error });
      throw error;
    }
  }

  async logout() {
    try {
      return await this.userRepository.logout();
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error in logout adapter', { error });
      throw error;
    }
  }

  async getCurrentUser() {
    try {
      return await this.userRepository.getCurrentUser();
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error in getCurrentUser adapter', { error });
      throw error;
    }
  }

  async isAuthenticated() {
    try {
      return await this.userRepository.isAuthenticated();
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error in isAuthenticated adapter', { error });
      return false;
    }
  }

  async setUsername(username) {
    try {
      return await this.userRepository.setUsername(username);
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error in setUsername adapter', { error, username });
      throw error;
    }
  }

  async setAgeVerification(isVerified) {
    try {
      return await this.userRepository.setAgeVerification(isVerified);
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error in setAgeVerification adapter', { error, isVerified });
      throw error;
    }
  }

  async setTosAccepted(isAccepted) {
    try {
      return await this.userRepository.setTosAccepted(isAccepted);
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error in setTosAccepted adapter', { error, isAccepted });
      throw error;
    }
  }

  async updatePoints(points, source, metadata = {}) {
    try {
      return await this.userRepository.updatePoints(points, source, metadata);
    } catch (error) {
      Logger.error(LogCategory.USER, 'Error in updatePoints adapter', { error, points, source });
      throw error;
    }
  }

  async getPreferences() {
    try {
      return await this.userRepository.getPreferences();
    } catch (error) {
      Logger.error(LogCategory.USER, 'Error in getPreferences adapter', { error });
      throw error;
    }
  }

  async updatePreferences(preferences) {
    try {
      return await this.userRepository.updatePreferences(preferences);
    } catch (error) {
      Logger.error(LogCategory.USER, 'Error in updatePreferences adapter', { error, preferences });
      throw error;
    }
  }

  /**
   * Utility functions
   */
  getCurrentDayOfWeek() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayIndex = new Date().getDay();
    return days[dayIndex];
  }
}

// Create and export a singleton instance
const firebaseServiceAdapter = new FirebaseServiceAdapter();
export default firebaseServiceAdapter;