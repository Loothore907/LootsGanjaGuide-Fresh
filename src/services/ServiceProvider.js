// src/services/ServiceProvider.js
import { Logger, LogCategory } from './LoggingService';
import { 
  VendorRepository,
  DealRepository, 
  UserRepository,
  JourneyRepository
} from '../repositories/repositoryExports';
import { firestore, hasValidFirebaseConfig } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import redemptionService from './RedemptionService';

/**
 * Service provider that exclusively uses Firebase
 * We've removed all mock data functionality completely
 */
class ServiceProvider {
  constructor() {
    this.initialized = false;
    this.services = {};
    this.repositories = {};
    
    // Set up repository references
    this.vendorRepository = VendorRepository;
    this.dealRepository = DealRepository;
    this.userRepository = UserRepository;
    this.journeyRepository = JourneyRepository;
    
    Logger.info(LogCategory.GENERAL, 'Firebase-only ServiceProvider initialized');
  }

  /**
   * Initialize the service provider
   * @returns {Promise<boolean>} - Success status
   */
  async initialize() {
    try {
      // Check if Firebase config is valid
      if (!hasValidFirebaseConfig()) {
        throw new Error('Invalid Firebase configuration. Please check your environment variables.');
      }
      
      Logger.info(LogCategory.GENERAL, 'Firebase ServiceProvider initialized successfully');
      this.initialized = true;
      return true;
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error initializing Firebase ServiceProvider', { error });
      throw error;
    }
  }

  /**
   * Check if Firebase is connected
   * @returns {Promise<boolean>} - Connection status
   */
  async verifyConnection() {
    try {
      if (!firestore) {
        return false;
      }
      
      // Try a simple query to verify connection
      // Using limit: 1 is appropriate here since we're just checking connectivity
      const testQuery = await this.vendorRepository.getAll({ limit: 1 });
      Logger.info(LogCategory.GENERAL, 'Firebase connection verified', { success: true });
      return true;
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Firebase connection failed', { error });
      return false;
    }
  }

  // Vendor service methods
  async getAllVendors(options = {}) {
    return await this.vendorRepository.getAll(options);
  }

  async getVendorById(vendorId) {
    return await this.vendorRepository.getById(vendorId);
  }

  async getRecentVendors(limit = 5) {
    const userId = this.vendorRepository.getCurrentUserId();
    if (!userId) return [];
    return await this.vendorRepository.getRecentVendors(userId, limit);
  }

  async checkInAtVendor(vendorId, options = {}) {
    const userId = this.vendorRepository.getCurrentUserId();
    if (!userId) throw new Error('User must be authenticated to check in');
    return await this.vendorRepository.checkIn(vendorId, userId, options);
  }

  async addToFavorites(vendorId) {
    const userId = this.vendorRepository.getCurrentUserId();
    if (!userId) throw new Error('User must be authenticated to add favorites');
    return await this.vendorRepository.addToFavorites(vendorId, userId);
  }

  async removeFromFavorites(vendorId) {
    const userId = this.vendorRepository.getCurrentUserId();
    if (!userId) throw new Error('User must be authenticated to remove favorites');
    return await this.vendorRepository.removeFromFavorites(vendorId, userId);
  }

  async getFavorites() {
    const userId = this.vendorRepository.getCurrentUserId();
    if (!userId) return [];
    return await this.vendorRepository.getFavorites(userId);
  }

  // Deal service methods
  async getFeaturedDeals(options = {}) {
    return await this.dealRepository.getFeatured(options.limit || 5, options);
  }

  async getDailyDeals(day, options = {}) {
    return await this.dealRepository.getDailyDeals(day, options);
  }

  async getBirthdayDeals(options = {}) {
    return await this.dealRepository.getBirthdayDeals(options);
  }

  async getSpecialDeals(options = {}) {
    return await this.dealRepository.getSpecialDeals(options);
  }

  // Journey/Route service methods
  async createOptimizedRoute(vendorIds, options = {}) {
    return await this.dealRepository.createRoute(vendorIds, options);
  }

  async createJourney(journeyData) {
    return await this.journeyRepository.createJourney(journeyData);
  }

  async getActiveJourney() {
    return await this.journeyRepository.getActiveJourney();
  }

  async nextVendor(journeyId) {
    return await this.journeyRepository.nextVendor(journeyId);
  }

  async skipVendor(journeyId, vendorIndex = null) {
    return await this.journeyRepository.skipVendor(journeyId, vendorIndex);
  }

  async checkInAtVendorDuringJourney(journeyId, vendorIndex, checkInType = 'qr') {
    return await this.journeyRepository.checkInAtVendor(journeyId, vendorIndex, checkInType);
  }

  async completeJourney(journeyId) {
    return await this.journeyRepository.completeJourney(journeyId);
  }

  async cancelJourney(journeyId) {
    return await this.journeyRepository.cancelJourney(journeyId);
  }

  /**
   * Get recent journeys for the user
   * @param {number} limit - Maximum number of journeys to return
   * @returns {Promise<Array>} - Array of journey objects
   */
  async getRecentJourneys(limit = 5) {
    try {
      return await this.journeyRepository.getRecentJourneys(limit);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error getting recent journeys', { error });
      return [];
    }
  }

  // User service methods
  async registerWithEmail(data) {
    return await this.userRepository.registerWithEmail(data);
  }

  async registerAnonymous(data) {
    return await this.userRepository.registerAnonymous(data);
  }

  async loginWithEmail(data) {
    return await this.userRepository.loginWithEmail(data);
  }

  async logout() {
    return await this.userRepository.logout();
  }

  async getCurrentUser() {
    return await this.userRepository.getCurrentUser();
  }

  async isAuthenticated() {
    return await this.userRepository.isAuthenticated();
  }

  async setUsername(username) {
    return await this.userRepository.setUsername(username);
  }

  async setAgeVerification(isVerified) {
    return await this.userRepository.setAgeVerification(isVerified);
  }

  async setTosAccepted(isAccepted) {
    return await this.userRepository.setTosAccepted(isAccepted);
  }

  async updatePoints(points, source, metadata = {}) {
    return await this.userRepository.updatePoints(points, source, metadata);
  }

  async getPreferences() {
    return await this.userRepository.getPreferences();
  }

  async updatePreferences(preferences) {
    return await this.userRepository.updatePreferences(preferences);
  }

  /**
   * Get user metrics and statistics
   * @returns {Promise<Object>} - Object containing metrics data
   */
  async getMetrics() {
    try {
      Logger.info(LogCategory.USER, 'Getting user metrics');
      
      // Get redemption statistics
      const redemptionStats = await redemptionService.getRedemptionStats();
      
      // Get journey history stats - handle potential errors separately
      let journeyStats = { total: 0, completed: 0 };
      try {
        // Check if the method exists and is callable
        if (typeof this.journeyRepository.getRecentJourneys === 'function') {
          // Pass limit as a number, not an object
          const journeyHistory = await this.journeyRepository.getRecentJourneys(20);
          journeyStats = {
            total: Array.isArray(journeyHistory) ? journeyHistory.length : 0,
            completed: Array.isArray(journeyHistory) ? 
              journeyHistory.filter(j => j && j.completedAt).length : 0
          };
        } else {
          Logger.warn(LogCategory.USER, 'Journey repository method not available');
        }
      } catch (journeyError) {
        Logger.error(LogCategory.USER, 'Error getting journey history', { error: journeyError });
        // Keep default journey stats
      }
      
      // Combine all metrics
      const metrics = {
        today: redemptionStats.today || { count: 0, uniqueVendors: 0 },
        week: redemptionStats.week || { count: 0, uniqueVendors: 0 },
        month: redemptionStats.month || { count: 0, uniqueVendors: 0 },
        total: redemptionStats.total || { count: 0, uniqueVendors: 0 },
        journeys: journeyStats
      };
      
      Logger.info(LogCategory.USER, 'Retrieved user metrics');
      return metrics;
    } catch (error) {
      Logger.error(LogCategory.USER, 'Error getting user metrics', { error });
      
      // Return default metrics on error
      return {
        today: { count: 0, uniqueVendors: 0 },
        week: { count: 0, uniqueVendors: 0 },
        month: { count: 0, uniqueVendors: 0 },
        total: { count: 0, uniqueVendors: 0 },
        journeys: { total: 0, completed: 0 }
      };
    }
  }
}

// Create and export singleton instance
const serviceProvider = new ServiceProvider();
export default serviceProvider;