// src/services/ServiceProvider.js
import { Logger, LogCategory } from './LoggingService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseServiceAdapter from './adapters/FirebaseServiceAdapter';

// Import mock services for development
import * as MockDataService from './MockDataService';
import redemptionService from './RedemptionService';
import locationService from './LocationService';
import routeService from './RouteService';

/**
 * Service Provider that manages which data source to use (Firebase or mock)
 * This allows for easy switching between real and mock data during development
 */
class ServiceProvider {
  constructor() {
    this.useFirebase = false;
    this.services = {};
    this.repositories = {};
    
    Logger.info(LogCategory.GENERAL, 'ServiceProvider initialized');
  }
  
  /**
   * Initialize the service provider
   * @param {boolean} useFirebase - Whether to use Firebase
   * @returns {Promise<void>}
   */
  async initialize(useFirebase) {
    this.setUseFirebase(useFirebase);
    
    // Initialize Firebase adapter if using Firebase
    if (useFirebase && firebaseServiceAdapter.initialize) {
      await firebaseServiceAdapter.initialize();
    }
    
    Logger.info(LogCategory.GENERAL, 'Service provider initialization complete');
  }
  
  /**
   * Set whether to use Firebase or mock data
   * @param {boolean} useFirebase - Whether to use Firebase
   */
  setUseFirebase(useFirebase) {
    this.useFirebase = useFirebase;
    Logger.info(LogCategory.GENERAL, `Data source set to ${useFirebase ? 'Firebase' : 'mock data'}`);
    
    // Clear any cached services/repositories so they'll be re-created with the new setting
    this.services = {};
    this.repositories = {};
  }
  
  /**
   * Get featured deals
   * @param {Object} options - Options for fetching deals
   * @returns {Promise<Array>} Featured deals
   */
  async getFeaturedDeals(options = {}) {
    try {
      Logger.info(LogCategory.DEALS, 'Getting featured deals', { options });
      
      if (this.useFirebase) {
        return await firebaseServiceAdapter.getFeaturedDeals(options);
      } else {
        return await MockDataService.getFeaturedDeals(options);
      }
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error getting featured deals', { error });
      return [];
    }
  }
  
  /**
   * Get all vendors
   * @param {Object} options - Options for fetching vendors
   * @returns {Promise<Array>} Vendors
   */
  async getAllVendors(options = {}) {
    try {
      Logger.info(LogCategory.VENDORS, 'Getting all vendors', { options });
      
      if (this.useFirebase) {
        return await firebaseServiceAdapter.getAllVendors(options);
      } else {
        return await MockDataService.getAllVendors(options);
      }
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error getting all vendors', { error });
      return [];
    }
  }
  
  /**
   * Get the appropriate service implementation
   * @param {string} serviceName - Name of the service
   * @param {Object} implementations - Object with firebase and mock implementations
   * @returns {Object} The appropriate service implementation
   */
  getService(serviceName, implementations) {
    if (!this.services[serviceName]) {
      const { firebase, mock } = implementations;
      
      if (!firebase || !mock) {
        throw new Error(`Missing implementation for service: ${serviceName}`);
      }
      
      this.services[serviceName] = this.useFirebase ? firebase : mock;
      
      Logger.debug(
        LogCategory.GENERAL, 
        `Using ${this.useFirebase ? 'Firebase' : 'mock'} implementation for ${serviceName}`
      );
    }
    
    return this.services[serviceName];
  }
  
  /**
   * Get the appropriate repository implementation
   * @param {string} repoName - Name of the repository
   * @param {Object} implementations - Object with firebase and mock implementations
   * @returns {Object} The appropriate repository implementation
   */
  getRepository(repoName, implementations) {
    if (!this.repositories[repoName]) {
      const { firebase, mock } = implementations;
      
      if (!firebase || !mock) {
        throw new Error(`Missing implementation for repository: ${repoName}`);
      }
      
      this.repositories[repoName] = this.useFirebase ? firebase : mock;
      
      Logger.debug(
        LogCategory.GENERAL, 
        `Using ${this.useFirebase ? 'Firebase' : 'mock'} implementation for ${repoName}`
      );
    }
    
    return this.repositories[repoName];
  }
  
  /**
   * Check if Firebase is being used
   * @returns {boolean} Whether Firebase is being used
   */
  isUsingFirebase() {
    return this.useFirebase;
  }
}

export default new ServiceProvider();