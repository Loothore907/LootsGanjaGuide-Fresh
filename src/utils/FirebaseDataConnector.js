// src/utils/FirebaseDataConnector.js
import { Logger, LogCategory } from '../services/LoggingService';
import serviceProvider from '../services/ServiceProvider';
import { hasValidFirebaseConfig } from '../config/firebase';
import { handleError, tryCatch } from './ErrorHandler';

/**
 * Utility to ensure the app is properly connected to Firebase
 */
class FirebaseDataConnector {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the Firebase data connection
   * @returns {Promise<boolean>} - Success status
   */
  async initialize() {
    try {
      Logger.info(LogCategory.GENERAL, 'Initializing Firebase Data Connector');
      
      // Check if Firebase config is valid
      const isValidConfig = hasValidFirebaseConfig();
      
      if (!isValidConfig) {
        Logger.warn(LogCategory.GENERAL, 'Invalid Firebase configuration');
        return false;
      }
      
      this.isInitialized = true;
      Logger.info(LogCategory.GENERAL, 'Firebase Data Connector initialized successfully');
      return true;
    } catch (error) {
      handleError(error, LogCategory.GENERAL, 'Error initializing Firebase Data Connector');
      return false;
    }
  }

  /**
   * Verify that the app is connected to Firebase
   * @returns {Promise<boolean>} - Whether Firebase connection is working
   */
  async verifyConnection() {
    try {
      // Use the service provider's verifyConnection method
      const isConnected = await serviceProvider.verifyConnection();
      
      Logger.info(LogCategory.GENERAL, `Firebase connection ${isConnected ? 'successful' : 'failed'}`);
      
      return isConnected;
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error verifying Firebase connection', { error });
      return false;
    }
  }
}

// Create and export singleton instance
const firebaseDataConnector = new FirebaseDataConnector();
export default firebaseDataConnector;
