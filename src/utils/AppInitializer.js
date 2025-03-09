// src/utils/AppInitializer.js
import { Logger, LogCategory } from '../services/LoggingService';
import { auth, hasValidFirebaseConfig } from '../config/firebase';
import { handleError } from './ErrorHandler';
import serviceProvider from '../services/ServiceProvider';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseAuthAdapter from '../services/adapters/FirebaseAuthAdapter';

/**
 * Handles app initialization tasks
 * Now exclusively uses Firebase with no mock data
 */
class AppInitializer {
  constructor() {
    this.isInitialized = false;
    this.authListener = null;
    this.userAuthState = null;
  }

  /**
   * Initialize the app
   * @param {Object} options - Initialization options
   * @param {Function} options.onAuthChange - Callback for auth state changes
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(options = {}) {
    if (this.isInitialized) return true;
    
    const { onAuthChange = null } = options;
    
    try {
      Logger.info(LogCategory.GENERAL, 'Starting app initialization');
      
      // First check if Firebase config is valid
      if (!hasValidFirebaseConfig()) {
        throw new Error('Invalid Firebase configuration. Please check your environment variables.');
      }
      
      // Initialize Logger
      await Logger.initialize();
      
      // Initialize service provider
      await serviceProvider.initialize();
      
      // Initialize Firebase Auth Adapter
      await firebaseAuthAdapter.initialize();
      Logger.info(LogCategory.AUTH, 'Firebase Auth Adapter initialized');
      
      // Set up Firebase auth state listener
      this.setupAuthListener(onAuthChange);
      
      // Load and cache initial app data in the background
      this.preloadAppData();
      
      this.isInitialized = true;
      Logger.info(LogCategory.GENERAL, 'App initialization completed successfully');
      
      // Verify Firebase connection
      const connected = await serviceProvider.verifyConnection();
      Logger.info(LogCategory.GENERAL, `Firebase connection status: ${connected ? 'CONNECTED' : 'NOT CONNECTED'}`);
      
      return true;
    } catch (error) {
      handleError(error, LogCategory.GENERAL, 'Error during app initialization');
      return false;
    }
  }

  /**
   * Set up Firebase auth state change listener
   * @param {Function} onAuthChange - Callback for auth state changes
   */
  setupAuthListener(onAuthChange) {
    if (this.authListener) {
      this.authListener();
      this.authListener = null;
    }
    
    this.authListener = onAuthStateChanged(auth, (user) => {
      this.userAuthState = user;
      
      Logger.info(LogCategory.AUTH, user 
        ? `User authenticated: ${user.uid}` 
        : 'User signed out'
      );
      
      // Call the callback if provided
      if (typeof onAuthChange === 'function') {
        onAuthChange(user);
      }
    });
  }

  /**
   * Clean up resources when the app is shutting down
   */
  cleanup() {
    // Remove auth listener if present
    if (this.authListener) {
      this.authListener();
      this.authListener = null;
    }
    
    Logger.info(LogCategory.GENERAL, 'App cleanup performed');
  }

  /**
   * Preload and cache common app data
   * @private
   */
  async preloadAppData() {
    try {
      // Start loading data in parallel
      const preloadTasks = [
        // Preload featured deals - increase limit to 20
        serviceProvider.getFeaturedDeals({ limit: 20 }).catch(err => {
          Logger.warn(LogCategory.DEALS, 'Failed to preload featured deals', { err });
          return [];
        }),
        
        // Preload vendors - remove limit to get all vendors
        serviceProvider.getAllVendors().catch(err => {
          Logger.warn(LogCategory.VENDORS, 'Failed to preload vendors', { err });
          return [];
        })
      ];
      
      // Don't await the result - let it load in background
      Promise.all(preloadTasks).then(() => {
        Logger.info(LogCategory.GENERAL, 'Initial app data preloaded successfully');
      }).catch(err => {
        Logger.warn(LogCategory.GENERAL, 'Some initial data failed to preload', { err });
      });
    } catch (error) {
      Logger.warn(LogCategory.GENERAL, 'Error during data preloading', { error });
    }
  }
}

// Create and export singleton instance
const appInitializer = new AppInitializer();
export default appInitializer;