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