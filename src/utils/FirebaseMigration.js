// src/utils/FirebaseMigration.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestore } from '../config/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Logger, LogCategory } from '../services/LoggingService';
import { tryCatch } from './ErrorHandler';

/**
 * Handles migration of local data to Firebase
 */
class FirebaseMigration {
  /**
   * Migrate all local data to Firebase
   * @returns {Promise<Object>} Migration results
   */
  async migrateAllData() {
    Logger.info(LogCategory.DATABASE, 'Starting Firebase migration');
    
    const results = {
      success: true,
      user: { success: false, message: '' },
      favorites: { success: false, message: '' },
      visits: { success: false, message: '' },
      vendors: { success: false, message: '' }
    };
    
    try {
      // Get user ID or create one
      const userId = await this.getUserId();
      
      // Migrate user profile
      results.user = await this.migrateUserProfile(userId);
      
      // Migrate favorites
      results.favorites = await this.migrateFavorites(userId);
      
      // Migrate visit history
      results.visits = await this.migrateVisitHistory(userId);
      
      // Migrate vendor ratings/reviews
      results.vendors = await this.migrateVendorInteractions(userId);
      
      // Check overall success
      results.success = results.user.success && 
                        results.favorites.success && 
                        results.visits.success && 
                        results.vendors.success;
      
      Logger.info(LogCategory.DATABASE, 'Firebase migration completed', { results });
      return results;
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error during Firebase migration', { error });
      results.success = false;
      return results;
    }
  }
  
  /**
   * Get the user ID or create one if it doesn't exist
   * @returns {Promise<string>} User ID
   */
  async getUserId() {
    return await tryCatch(async () => {
      // Check if we already have a user ID
      let userId = await AsyncStorage.getItem('firebase_user_id');
      
      if (!userId) {
        // Generate a new user ID (in a real app, this would come from Firebase Auth)
        userId = 'user_' + Math.random().toString(36).substring(2, 15);
        await AsyncStorage.setItem('firebase_user_id', userId);
        Logger.info(LogCategory.AUTH, 'Created new Firebase user ID', { userId });
      }
      
      return userId;
    }, LogCategory.AUTH, 'getting user ID', 'user_error');
  }
  
  /**
   * Migrate user profile data to Firebase
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Migration result
   */
  async migrateUserProfile(userId) {
    return await tryCatch(async () => {
      // Get user data from AsyncStorage
      const username = await AsyncStorage.getItem('username') || 'Anonymous';
      const ageVerified = await AsyncStorage.getItem('isAgeVerified') === 'true';
      const tosAccepted = await AsyncStorage.getItem('tosAccepted') === 'true';
      const points = parseInt(await AsyncStorage.getItem('points') || '0', 10);
      
      // Create user document in Firestore
      const userRef = doc(firestore, 'users', userId);
      await setDoc(userRef, {
        username,
        ageVerified,
        tosAccepted,
        points,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      return { success: true, message: 'User profile migrated successfully' };
    }, LogCategory.DATABASE, 'migrating user profile', { success: false, message: 'Failed to migrate user profile' });
  }
  
  /**
   * Migrate favorites to Firebase
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Migration result
   */
  async migrateFavorites(userId) {
    return await tryCatch(async () => {
      // Get favorites from AsyncStorage
      const favoritesJson = await AsyncStorage.getItem('favorites');
      const favorites = favoritesJson ? JSON.parse(favoritesJson) : [];
      
      if (favorites.length === 0) {
        return { success: true, message: 'No favorites to migrate' };
      }
      
      // Create favorites collection in Firestore
      const userFavoritesRef = collection(firestore, 'users', userId, 'favorites');
      
      // Add each favorite
      for (const favorite of favorites) {
        const docRef = doc(userFavoritesRef, favorite.id.toString());
        await setDoc(docRef, {
          ...favorite,
          createdAt: serverTimestamp()
        });
      }
      
      return { 
        success: true, 
        message: `Migrated ${favorites.length} favorites successfully` 
      };
    }, LogCategory.DATABASE, 'migrating favorites', { success: false, message: 'Failed to migrate favorites' });
  }
  
  /**
   * Migrate visit history to Firebase
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Migration result
   */
  async migrateVisitHistory(userId) {
    return await tryCatch(async () => {
      // Get visit history from AsyncStorage
      const visitsJson = await AsyncStorage.getItem('checkin_history');
      const visits = visitsJson ? JSON.parse(visitsJson) : [];
      
      if (visits.length === 0) {
        return { success: true, message: 'No visit history to migrate' };
      }
      
      // Create visits collection in Firestore
      const userVisitsRef = collection(firestore, 'users', userId, 'visits');
      
      // Add each visit
      for (const visit of visits) {
        const docRef = doc(userVisitsRef);
        await setDoc(docRef, {
          ...visit,
          timestamp: visit.timestamp || new Date().toISOString()
        });
      }
      
      return { 
        success: true, 
        message: `Migrated ${visits.length} visits successfully` 
      };
    }, LogCategory.DATABASE, 'migrating visit history', { success: false, message: 'Failed to migrate visit history' });
  }
  
  /**
   * Migrate vendor interactions (ratings, reviews) to Firebase
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Migration result
   */
  async migrateVendorInteractions(userId) {
    // This is a placeholder - in a real app, you would migrate vendor ratings and reviews
    return { success: true, message: 'No vendor interactions to migrate' };
  }
}

export default new FirebaseMigration();