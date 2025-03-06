// src/services/ServiceProvider.js
import { Logger, LogCategory } from './LoggingService';
import * as MockDataService from './MockDataService';
import firebaseServiceAdapter from './adapters/FirebaseServiceAdapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseAuthAdapter from './adapters/FirebaseAuthAdapter';

/**
 * Service provider that switches between Firebase and mock data
 * This provides a consistent API regardless of which backend is being used
 */
class ServiceProvider {
  constructor() {
    this.useFirebase = false;
    this.initialized = false;
    this.services = {};
    this.repositories = {};
    
    Logger.info(LogCategory.GENERAL, 'ServiceProvider initialized');
  }

  /**
   * Initialize the service provider
   * @param {boolean} useFirebase - Whether to use Firebase
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(useFirebase = false) {
    try {
      this.useFirebase = useFirebase;
      
      if (useFirebase) {
        // Initialize Firebase adapters
        await firebaseServiceAdapter.initialize();
        await firebaseAuthAdapter.initialize();
        Logger.info(LogCategory.GENERAL, 'Initialized service provider with Firebase');
      } else {
        Logger.info(LogCategory.GENERAL, 'Initialized service provider with mock data');
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error initializing service provider', { error });
      return false;
    }
  }

  /**
   * Set whether to use Firebase or mock data
   * @param {boolean} useFirebase - Whether to use Firebase
   */
  setUseFirebase(useFirebase) {
    this.useFirebase = useFirebase;
    Logger.info(LogCategory.GENERAL, `Service provider now using ${useFirebase ? 'Firebase' : 'mock data'}`);
  }

  /**
   * Get whether the service provider is using Firebase
   * @returns {boolean} - Whether Firebase is being used
   */
  isUsingFirebase() {
    return this.useFirebase;
  }

  /**
   * Get user preferences
   * @returns {Promise<Object>} - User preferences
   */
  async getPreferences() {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.getPreferences();
    } else {
      return await MockDataService.getPreferences();
    }
  }

  /**
   * Update user preferences
   * @param {Object} preferences - Preferences to update
   * @returns {Promise<Object>} - Updated preferences
   */
  async updatePreferences(preferences) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.updatePreferences(preferences);
    } else {
      return await MockDataService.updatePreferences(preferences);
    }
  }

  /**
   * Get all vendors
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of vendors
   */
  async getAllVendors(options = {}) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.getAllVendors(options);
    } else {
      return await MockDataService.getAllVendors(options);
    }
  }

  /**
   * Get a vendor by ID
   * @param {string} vendorId - Vendor ID
   * @returns {Promise<Object>} - Vendor data
   */
  async getVendorById(vendorId) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.getVendorById(vendorId);
    } else {
      return await MockDataService.getVendorById(vendorId);
    }
  }

  /**
   * Get recent vendors
   * @param {number} limit - Maximum number of vendors to return
   * @returns {Promise<Array>} - Array of vendors
   */
  async getRecentVendors(limit = 5) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.getRecentVendors(limit);
    } else {
      return await MockDataService.getRecentVendors(limit);
    }
  }

  /**
   * Check in at a vendor
   * @param {string} vendorId - Vendor ID
   * @param {Object} options - Check-in options
   * @returns {Promise<Object>} - Check-in result
   */
  async checkInAtVendor(vendorId, options = {}) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.checkInAtVendor(vendorId, options);
    } else {
      return await MockDataService.checkInAtVendor(vendorId, options);
    }
  }

  /**
   * Add a vendor to favorites
   * @param {string} vendorId - Vendor ID
   * @returns {Promise<boolean>} - Success status
   */
  async addToFavorites(vendorId) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.addToFavorites(vendorId);
    } else {
      return await MockDataService.addToFavorites(vendorId);
    }
  }

  /**
   * Remove a vendor from favorites
   * @param {string} vendorId - Vendor ID
   * @returns {Promise<boolean>} - Success status
   */
  async removeFromFavorites(vendorId) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.removeFromFavorites(vendorId);
    } else {
      return await MockDataService.removeFromFavorites(vendorId);
    }
  }

  /**
   * Get favorite vendors
   * @returns {Promise<Array>} - Array of favorite vendors
   */
  async getFavorites() {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.getFavorites();
    } else {
      return await MockDataService.getFavorites();
    }
  }

  /**
   * Get featured deals
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of featured deals
   */
  async getFeaturedDeals(options = {}) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.getFeaturedDeals(options);
    } else {
      return await MockDataService.getFeaturedDeals(options);
    }
  }

  /**
   * Get daily deals
   * @param {string} day - Day of week
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of daily deals
   */
  async getDailyDeals(day, options = {}) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.getDailyDeals(day, options);
    } else {
      return await MockDataService.getDailyDeals(day, options);
    }
  }

  /**
   * Get birthday deals
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of birthday deals
   */
  async getBirthdayDeals(options = {}) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.getBirthdayDeals(options);
    } else {
      return await MockDataService.getBirthdayDeals(options);
    }
  }

  /**
   * Get special deals
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of special deals
   */
  async getSpecialDeals(options = {}) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.getSpecialDeals(options);
    } else {
      return await MockDataService.getSpecialDeals(options);
    }
  }

  /**
   * Create optimized route
   * @param {Array<string>} vendorIds - Array of vendor IDs
   * @param {Object} options - Route options
   * @returns {Promise<Object>} - Route object
   */
  async createOptimizedRoute(vendorIds, options = {}) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.createOptimizedRoute(vendorIds, options);
    } else {
      return await MockDataService.createOptimizedRoute(vendorIds, options);
    }
  }

  /**
   * Create journey
   * @param {Object} journeyData - Journey data
   * @returns {Promise<Object>} - Created journey
   */
  async createJourney(journeyData) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.createJourney(journeyData);
    } else {
      return await MockDataService.createJourney(journeyData);
    }
  }

  /**
   * Get active journey
   * @returns {Promise<Object>} - Active journey
   */
  async getActiveJourney() {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.getActiveJourney();
    } else {
      return await MockDataService.getActiveJourney();
    }
  }

  /**
   * Move to next vendor in journey
   * @param {string} journeyId - Journey ID
   * @returns {Promise<Object>} - Updated journey
   */
  async nextVendor(journeyId) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.nextVendor(journeyId);
    } else {
      return await MockDataService.nextVendor(journeyId);
    }
  }

  /**
   * Skip vendor in journey
   * @param {string} journeyId - Journey ID
   * @param {number} vendorIndex - Vendor index
   * @returns {Promise<Object>} - Updated journey
   */
  async skipVendor(journeyId, vendorIndex = null) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.skipVendor(journeyId, vendorIndex);
    } else {
      return await MockDataService.skipVendor(journeyId, vendorIndex);
    }
  }

  /**
   * Check in at vendor during journey
   * @param {string} journeyId - Journey ID
   * @param {number} vendorIndex - Vendor index
   * @param {string} checkInType - Check-in type
   * @returns {Promise<Object>} - Updated journey
   */
  async checkInAtVendorDuringJourney(journeyId, vendorIndex, checkInType = 'qr') {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.checkInAtVendorDuringJourney(journeyId, vendorIndex, checkInType);
    } else {
      return await MockDataService.checkInAtVendorDuringJourney(journeyId, vendorIndex, checkInType);
    }
  }

  /**
   * Complete journey
   * @param {string} journeyId - Journey ID
   * @returns {Promise<boolean>} - Success status
   */
  async completeJourney(journeyId) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.completeJourney(journeyId);
    } else {
      return await MockDataService.completeJourney(journeyId);
    }
  }

  /**
   * Cancel journey
   * @param {string} journeyId - Journey ID
   * @returns {Promise<boolean>} - Success status
   */
  async cancelJourney(journeyId) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.cancelJourney(journeyId);
    } else {
      return await MockDataService.cancelJourney(journeyId);
    }
  }

  /**
   * Get recent journeys
   * @param {number} limit - Maximum number of journeys to return
   * @returns {Promise<Array>} - Array of journeys
   */
  async getRecentJourneys(limit = 5) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.getRecentJourneys(limit);
    } else {
      return await MockDataService.getRecentJourneys(limit);
    }
  }

  /**
   * Create user account with email
   * @param {Object} data - Registration data
   * @returns {Promise<Object>} - User data
   */
  async registerWithEmail(data) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.registerWithEmail(data);
    } else {
      return await MockDataService.registerWithEmail(data);
    }
  }

  /**
   * Create anonymous user
   * @param {Object} data - User data
   * @returns {Promise<Object>} - User data
   */
  async registerAnonymous(data) {
    if (this.useFirebase) {
      // For Firebase, use our auth adapter
      const authResult = await firebaseAuthAdapter.createAnonymousUser(data.username);
      return {
        success: authResult.success,
        user: {
          id: authResult.user.uid,
          username: data.username,
          isAnonymous: true
        }
      };
    } else {
      return await MockDataService.registerAnonymous(data);
    }
  }

  /**
   * Log in user with email
   * @param {Object} data - Login data
   * @returns {Promise<Object>} - User data
   */
  async loginWithEmail(data) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.loginWithEmail(data);
    } else {
      return await MockDataService.loginWithEmail(data);
    }
  }

  /**
   * Sign in returning user
   * @param {string} username - Username
   * @returns {Promise<Object>} - User data
   */
  async signInReturningUser(username) {
    if (this.useFirebase) {
      // For Firebase, use our auth adapter
      const authResult = await firebaseAuthAdapter.signInReturningUser(username);
      return {
        success: authResult.success,
        user: {
          id: authResult.user.uid,
          username: username,
          isAnonymous: true
        }
      };
    } else {
      // Mock implementation
      return {
        success: true,
        user: {
          id: 'mock-user-id',
          username: username,
          isAnonymous: true
        }
      };
    }
  }

  /**
   * Log out current user
   * @returns {Promise<boolean>} - Success status
   */
  async logout() {
    if (this.useFirebase) {
      // Sign out from Firebase
      await firebaseAuthAdapter.signOut();
      return await firebaseServiceAdapter.logout();
    } else {
      return await MockDataService.logout();
    }
  }

  /**
   * Get current user
   * @returns {Promise<Object>} - User data
   */
  async getCurrentUser() {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.getCurrentUser();
    } else {
      return await MockDataService.getCurrentUser();
    }
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>} - Auth status
   */
  async isAuthenticated() {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.isAuthenticated();
    } else {
      return await MockDataService.isAuthenticated();
    }
  }

  /**
   * Set username
   * @param {string} username - Username
   * @returns {Promise<Object>} - Updated user
   */
  async setUsername(username) {
    if (this.useFirebase) {
      // Update Firebase Auth profile
      await firebaseAuthAdapter.updateUserInfo({ username });
      return await firebaseServiceAdapter.setUsername(username);
    } else {
      return await MockDataService.setUsername(username);
    }
  }

  /**
   * Set age verification status
   * @param {boolean} isVerified - Verification status
   * @returns {Promise<Object>} - Updated user
   */
  async setAgeVerification(isVerified) {
    if (this.useFirebase) {
      // Update Firebase user data
      await firebaseAuthAdapter.setAgeVerified(isVerified);
      return await firebaseServiceAdapter.setAgeVerification(isVerified);
    } else {
      return await MockDataService.setAgeVerification(isVerified);
    }
  }

  /**
   * Set ToS acceptance status
   * @param {boolean} isAccepted - Acceptance status
   * @returns {Promise<Object>} - Updated user
   */
  async setTosAccepted(isAccepted) {
    if (this.useFirebase) {
      // Update Firebase user data
      await firebaseAuthAdapter.setTosAccepted(isAccepted);
      return await firebaseServiceAdapter.setTosAccepted(isAccepted);
    } else {
      return await MockDataService.setTosAccepted(isAccepted);
    }
  }

  /**
   * Update user points
   * @param {number} points - Points to add
   * @param {string} source - Source of points
   * @param {Object} metadata - Additional data
   * @returns {Promise<Object>} - Updated points
   */
  async updatePoints(points, source, metadata = {}) {
    if (this.useFirebase) {
      return await firebaseServiceAdapter.updatePoints(points, source, metadata);
    } else {
      return await MockDataService.updatePoints(points, source, metadata);
    }
  }

  /**
   * Get service by name
   * @param {string} serviceName - Service name
   * @param {Object} implementations - Service implementations
   * @returns {Object} - Service instance
   */
  getService(serviceName, implementations) {
    if (this.services[serviceName]) {
      return this.services[serviceName];
    }
    
    if (!implementations) {
      throw new Error(`No implementations provided for service: ${serviceName}`);
    }
    
    const service = this.useFirebase && implementations.firebase 
      ? implementations.firebase 
      : implementations.mock;
    
    if (!service) {
      throw new Error(`No ${this.useFirebase ? 'firebase' : 'mock'} implementation found for service: ${serviceName}`);
    }
    
    this.services[serviceName] = service;
    return service;
  }

  /**
   * Get repository by name
   * @param {string} repoName - Repository name
   * @param {Object} implementations - Repository implementations
   * @returns {Object} - Repository instance
   */
  getRepository(repoName, implementations) {
    if (this.repositories[repoName]) {
      return this.repositories[repoName];
    }
    
    if (!implementations) {
      throw new Error(`No implementations provided for repository: ${repoName}`);
    }
    
    const repo = this.useFirebase && implementations.firebase 
      ? implementations.firebase 
      : implementations.mock;
    
    if (!repo) {
      throw new Error(`No ${this.useFirebase ? 'firebase' : 'mock'} implementation found for repository: ${repoName}`);
    }
    
    this.repositories[repoName] = repo;
    return repo;
  }
}

// Create and export singleton instance
const serviceProvider = new ServiceProvider();
export default serviceProvider;