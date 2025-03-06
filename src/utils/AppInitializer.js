// src/utils/AppInitializer.js
import { Logger, LogCategory } from '../services/LoggingService';
import { auth } from '../config/firebase';
import { handleError } from './ErrorHandler';
import serviceProvider from '../services/ServiceProvider';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseMigration from './FirebaseMigration';
import firebaseAuthAdapter from '../services/adapters/FirebaseAuthAdapter';

/**
 * Handles app initialization tasks like setting up Firebase,
 * initializing services, and loading required data
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
   * @param {boolean} options.useFirebase - Whether to use Firebase (defaults to production setting)
   * @param {boolean} options.migrateData - Whether to migrate mock data to Firebase (dev only)
   * @param {Function} options.onAuthChange - Callback for auth state changes
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(options = {}) {
    if (this.isInitialized) return true;
    
    const {
      useFirebase = !__DEV__, // Default to mock in dev, Firebase in prod by default
      migrateData = false,
      onAuthChange = null
    } = options;
    
    try {
      Logger.info(LogCategory.GENERAL, 'Starting app initialization', options);
      
      // Initialize Logger
      await Logger.initialize();
      
      // Initialize service provider (switches between Firebase and mock data)
      await serviceProvider.initialize(useFirebase);
      
      // Initialize Firebase Auth Adapter
      if (useFirebase) {
        await firebaseAuthAdapter.initialize();
        Logger.info(LogCategory.AUTH, 'Firebase Auth Adapter initialized');
      }
      
      // Set up Firebase auth state listener if using Firebase
      if (useFirebase) {
        this.setupAuthListener(onAuthChange);
        
        // Migrate mock data to Firebase if requested (dev only)
        if (migrateData && __DEV__) {
          await this.migrateMockData();
        }
      }
      
      // Load and cache initial app data in the background
      this.preloadAppData();
      
      this.isInitialized = true;
      Logger.info(LogCategory.GENERAL, 'App initialization completed successfully');
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
        // Preload featured deals
        serviceProvider.getFeaturedDeals().catch(err => {
          Logger.warn(LogCategory.DEALS, 'Failed to preload featured deals', { err });
          return [];
        }),
        
        // Preload vendors
        serviceProvider.getAllVendors({ limit: 10 }).catch(err => {
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

  /**
   * Migrate mock data to Firebase
   * @private
   */
  async migrateMockData() {
    try {
      // Check if migration has already been done
      const migrationCompleted = await AsyncStorage.getItem('firebase_migration_completed');
      
      if (migrationCompleted === 'true') {
        Logger.info(LogCategory.DATABASE, 'Firebase data migration already completed');
        return;
      }
      
      // Run migration
      Logger.info(LogCategory.DATABASE, 'Starting Firebase data migration');
      
      const result = await firebaseMigration.migrateAllData();
      
      if (result.success) {
        // Mark migration as completed
        await AsyncStorage.setItem('firebase_migration_completed', 'true');
        Logger.info(LogCategory.DATABASE, 'Firebase data migration completed successfully');
      } else {
        Logger.warn(LogCategory.DATABASE, 'Firebase data migration completed with some issues', { result });
      }
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error during Firebase data migration', { error });
    }
  }

  /**
   * Toggle between Firebase and mock data
   * @param {boolean} useFirebase - Whether to use Firebase
   */
  async toggleDataSource(useFirebase) {
    try {
      // Store the setting
      await AsyncStorage.setItem('use_firebase', useFirebase ? 'true' : 'false');
      
      // Update the service provider
      serviceProvider.setUseFirebase(useFirebase);
      
      Logger.info(
        LogCategory.GENERAL, 
        `Data source switched to ${useFirebase ? 'Firebase' : 'mock data'}`
      );
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error toggling data source', { error });
      throw error;
    }
  }

  /**
   * Initialize the app's data source based on stored preference
   * @returns {Promise<boolean>} Whether Firebase is being used
   */
  async initializeDataSource() {
    try {
      // Check if we have a stored preference
      const storedPreference = await AsyncStorage.getItem('use_firebase');
      const useFirebase = storedPreference === 'true';
      
      // Set the service provider accordingly
      serviceProvider.setUseFirebase(useFirebase);
      
      Logger.info(
        LogCategory.GENERAL, 
        `Initialized data source: ${useFirebase ? 'Firebase' : 'mock data'}`
      );
      
      return useFirebase;
    } catch (error) {
      // Default to mock data on error
      Logger.error(LogCategory.GENERAL, 'Error initializing data source', { error });
      serviceProvider.setUseFirebase(false);
      return false;
    }
  }
}

// Create and export singleton instance
const appInitializer = new AppInitializer();
export default appInitializer;