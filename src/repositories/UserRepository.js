// src/repositories/UserRepository.js
import { BaseRepository } from './index';
import { firestore, serverTimestamp, auth, increment } from '../config/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  runTransaction
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  updatePassword,
  signInAnonymously
} from 'firebase/auth';
import { Logger, LogCategory } from '../services/LoggingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Repository for user-related Firestore operations
 */
class UserRepository extends BaseRepository {
  constructor() {
    super('users');
    this.preferencesCollection = collection(firestore, 'user_preferences');
    this.pointsHistoryCollection = collection(firestore, 'points_history');
  }

  /**
   * Create a new user account with email/password
   * @param {Object} data - User data
   * @param {string} data.email - User email
   * @param {string} data.password - User password
   * @param {string} data.username - Username
   * @param {string} [data.birthdate] - User's birthdate (YYYY-MM-DD)
   * @returns {Promise<Object>} - Created user data
   */
  async registerWithEmail(data) {
    try {
      Logger.info(LogCategory.AUTH, 'Registering new user with email', { email: data.email });
      
      // Create Firebase auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      
      const { user } = userCredential;
      
      // Update display name
      await updateProfile(user, {
        displayName: data.username
      });
      
      // Send email verification
      await sendEmailVerification(user);
      
      // Create user document in Firestore
      const userData = {
        id: user.uid,
        username: data.username,
        email: data.email,
        points: 0,
        favorites: [],
        tosAccepted: true,
        ageVerified: true,
        ageVerificationDate: new Date().toISOString(),
        birthdate: data.birthdate || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(doc(this.collectionRef, user.uid), userData);
      
      // Create default user preferences
      await setDoc(doc(this.preferencesCollection, user.uid), {
        theme: 'light',
        notifications: true,
        maxDistance: 25, // Default max distance in miles
        showPartnerOnly: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Return the normalized user data (without the password)
      const { password, ...userDataWithoutPassword } = userData;
      return this.normalizeTimestamps(userDataWithoutPassword);
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error registering user with email', { error, email: data.email });
      throw this.mapAuthError(error);
    }
  }

  /**
   * Create an anonymous user (device-based)
   * @param {Object} data - User data
   * @param {string} data.username - Username
   * @param {boolean} data.ageVerified - Whether age has been verified
   * @param {boolean} data.tosAccepted - Whether TOS has been accepted
   * @returns {Promise<Object>} - Created user data
   */
  async registerAnonymous(data) {
    try {
      Logger.info(LogCategory.AUTH, 'Registering anonymous user');
      
      // Create Firebase anonymous auth user
      const userCredential = await signInAnonymously(auth);
      const { user } = userCredential;
      
      // Update display name if provided
      if (data.username) {
        await updateProfile(user, {
          displayName: data.username
        });
      }
      
      // Create user document in Firestore
      const userData = {
        id: user.uid,
        username: data.username || null,
        points: 0,
        favorites: [],
        tosAccepted: !!data.tosAccepted,
        ageVerified: !!data.ageVerified,
        ageVerificationDate: data.ageVerified ? new Date().toISOString() : null,
        isAnonymous: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(doc(this.collectionRef, user.uid), userData);
      
      // Create default user preferences
      await setDoc(doc(this.preferencesCollection, user.uid), {
        theme: 'light',
        notifications: true,
        maxDistance: 25, // Default max distance in miles
        showPartnerOnly: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return this.normalizeTimestamps(userData);
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error registering anonymous user', { error });
      throw this.mapAuthError(error);
    }
  }

  /**
   * Log in with email and password
   * @param {Object} data - Login data
   * @param {string} data.email - User email
   * @param {string} data.password - User password
   * @returns {Promise<Object>} - User data
   */
  async loginWithEmail(data) {
    try {
      Logger.info(LogCategory.AUTH, 'Logging in user with email', { email: data.email });
      
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      
      const { user } = userCredential;
      
      // Get the user data from Firestore
      const userData = await this.getById(user.uid);
      
      if (!userData) {
        // If user auth exists but no Firestore data, create a basic profile
        Logger.warn(LogCategory.AUTH, 'User auth exists but no profile found, creating new profile', {
          uid: user.uid,
          email: user.email
        });
        
        const newUserData = {
          id: user.uid,
          username: user.displayName || user.email.split('@')[0],
          email: user.email,
          points: 0,
          favorites: [],
          tosAccepted: true,
          ageVerified: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(doc(this.collectionRef, user.uid), newUserData);
        
        return this.normalizeTimestamps(newUserData);
      }
      
      // Update login timestamp
      await updateDoc(doc(this.collectionRef, user.uid), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return userData;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error logging in user with email', { error, email: data.email });
      throw this.mapAuthError(error);
    }
  }

  /**
   * Log out the current user
   * @returns {Promise<boolean>} - Success status
   */
  async logout() {
    try {
      await signOut(auth);
      
      // Clear auth-related storage
      await AsyncStorage.multiRemove([
        'auth_token',
        'refresh_token',
        'user_data'
      ]);
      
      Logger.info(LogCategory.AUTH, 'User logged out successfully');
      return true;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error logging out user', { error });
      throw error;
    }
  }

  /**
   * Get the current authenticated user's data
   * @returns {Promise<Object|null>} - User data or null if not authenticated
   */
  async getCurrentUser() {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        return null;
      }
      
      // Get the user data from Firestore
      const userData = await this.getById(currentUser.uid);
      
      if (!userData) {
        Logger.warn(LogCategory.AUTH, 'Current auth user has no profile data', {
          uid: currentUser.uid,
          email: currentUser.email
        });
        
        // Return basic info from auth
        return {
          id: currentUser.uid,
          username: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : null),
          email: currentUser.email,
          emailVerified: currentUser.emailVerified,
          isAnonymous: currentUser.isAnonymous
        };
      }
      
      return userData;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error getting current user', { error });
      throw error;
    }
  }

  /**
   * Check if a user is currently authenticated
   * @returns {Promise<boolean>} - Whether a user is authenticated
   */
  async isAuthenticated() {
    try {
      return !!auth.currentUser;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error checking authentication status', { error });
      return false;
    }
  }

  /**
   * Set or update a user's username
   * @param {string} username - New username
   * @returns {Promise<Object>} - Updated user data
   */
  async setUsername(username) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      // Update Firebase Auth profile
      await updateProfile(currentUser, {
        displayName: username
      });
      
      // Update Firestore user document
      await updateDoc(doc(this.collectionRef, currentUser.uid), {
        username,
        updatedAt: serverTimestamp()
      });
      
      Logger.info(LogCategory.AUTH, 'Username updated successfully', { username });
      
      // Get updated user data
      return await this.getById(currentUser.uid);
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error setting username', { error, username });
      throw error;
    }
  }

  /**
   * Set age verification status
   * @param {boolean} isVerified - Whether age is verified
   * @returns {Promise<Object>} - Updated user data
   */
  async setAgeVerification(isVerified) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      // Update Firestore user document
      await updateDoc(doc(this.collectionRef, currentUser.uid), {
        ageVerified: isVerified,
        ageVerificationDate: isVerified ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
      
      // Also store in AsyncStorage for quick access
      await AsyncStorage.setItem('isAgeVerified', isVerified ? 'true' : 'false');
      
      Logger.info(LogCategory.AUTH, 'Age verification status updated', { isVerified });
      
      // Get updated user data
      return await this.getById(currentUser.uid);
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error setting age verification', { error, isVerified });
      throw error;
    }
  }

  /**
   * Set terms of service acceptance status
   * @param {boolean} isAccepted - Whether TOS is accepted
   * @returns {Promise<Object>} - Updated user data
   */
  async setTosAccepted(isAccepted) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      // Update Firestore user document
      await updateDoc(doc(this.collectionRef, currentUser.uid), {
        tosAccepted: isAccepted,
        tosAcceptedDate: isAccepted ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
      
      // Also store in AsyncStorage for quick access
      await AsyncStorage.setItem('tosAccepted', isAccepted ? 'true' : 'false');
      
      Logger.info(LogCategory.AUTH, 'TOS acceptance status updated', { isAccepted });
      
      // Get updated user data
      return await this.getById(currentUser.uid);
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error setting TOS acceptance', { error, isAccepted });
      throw error;
    }
  }

  /**
   * Update user points
   * @param {number} points - Points to add (positive) or remove (negative)
   * @param {string} source - Source of points update (e.g., 'check-in', 'journey', 'referral')
   * @param {Object} metadata - Additional metadata about the points change
   * @returns {Promise<Object>} - Updated user data with new points total
   */
  async updatePoints(points, source, metadata = {}) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      const userId = currentUser.uid;
      Logger.info(LogCategory.USER, 'Updating user points', { userId, points, source });
      
      // Use a transaction to ensure atomic updates
      const result = await runTransaction(firestore, async (transaction) => {
        // Get current user data
        const userRef = doc(this.collectionRef, userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error(`User document with ID ${userId} not found`);
        }
        
        const userData = userDoc.data();
        const currentPoints = userData.points || 0;
        const newPointsTotal = currentPoints + points;
        
        // Update user points
        transaction.update(userRef, {
          points: newPointsTotal,
          updatedAt: serverTimestamp()
        });
        
        // Record points history
        const pointsHistoryRef = doc(this.pointsHistoryCollection);
        transaction.set(pointsHistoryRef, {
          userId,
          points, // The points change (can be positive or negative)
          newTotal: newPointsTotal,
          source,
          metadata,
          timestamp: serverTimestamp()
        });
        
        // Return new points total
        return {
          points: newPointsTotal,
          change: points,
          source,
          timestamp: new Date().toISOString()
        };
      });
      
      // Also update in AsyncStorage for quick access
      await AsyncStorage.setItem('points', result.points.toString());
      
      return result;
    } catch (error) {
      Logger.error(LogCategory.USER, 'Error updating user points', { error, points, source });
      throw error;
    }
  }

  /**
   * Get user preferences
   * @returns {Promise<Object>} - User preferences
   */
  async getPreferences() {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      const userId = currentUser.uid;
      const preferencesRef = doc(this.preferencesCollection, userId);
      const preferencesSnap = await getDoc(preferencesRef);
      
      if (!preferencesSnap.exists()) {
        // Create default preferences if none exist
        const defaultPreferences = {
          theme: 'light',
          notifications: true,
          maxDistance: 25,
          showPartnerOnly: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(preferencesRef, defaultPreferences);
        
        return {
          ...defaultPreferences,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
      
      return this.normalizeTimestamps(preferencesSnap.data());
    } catch (error) {
      Logger.error(LogCategory.USER, 'Error getting user preferences', { error });
      throw error;
    }
  }

  /**
   * Update user preferences
   * @param {Object} preferences - Preferences to update
   * @returns {Promise<Object>} - Updated preferences
   */
  async updatePreferences(preferences) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      const userId = currentUser.uid;
      const preferencesRef = doc(this.preferencesCollection, userId);
      
      const updateData = {
        ...preferences,
        updatedAt: serverTimestamp()
      };
      
      // Store theme and notifications in AsyncStorage for quick access
      if (preferences.theme) {
        await AsyncStorage.setItem('theme', preferences.theme);
      }
      
      if (preferences.notifications !== undefined) {
        await AsyncStorage.setItem('notifications', preferences.notifications.toString());
      }
      
      await updateDoc(preferencesRef, updateData);
      
      // Get updated preferences
      const updatedPreferencesSnap = await getDoc(preferencesRef);
      return this.normalizeTimestamps(updatedPreferencesSnap.data());
    } catch (error) {
      Logger.error(LogCategory.USER, 'Error updating user preferences', { error, preferences });
      throw error;
    }
  }

  /**
   * Request a password reset for a user
   * @param {string} email - User's email address
   * @returns {Promise<boolean>} - Success status
   */
  async requestPasswordReset(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      Logger.info(LogCategory.AUTH, 'Password reset email sent', { email });
      return true;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error sending password reset email', { error, email });
      throw this.mapAuthError(error);
    }
  }

  /**
   * Update user's password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} - Success status
   */
  async updatePassword(currentPassword, newPassword) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      // Re-authenticate user before changing password
      if (currentUser.email) {
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          currentPassword
        );
        
        await reauthenticateWithCredential(currentUser, credential);
      } else {
        throw new Error('Cannot update password for anonymous users');
      }
      
      // Update password
      await updatePassword(currentUser, newPassword);
      
      Logger.info(LogCategory.AUTH, 'Password updated successfully');
      return true;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error updating password', { error });
      throw this.mapAuthError(error);
    }
  }

  /**
   * Maps Firebase Auth errors to user-friendly messages
   * @param {Error} error - Firebase Auth error
   * @returns {Error} - Error with user-friendly message
   */
  mapAuthError(error) {
    // Original error code is preserved on the error object
    const originalError = error;
    
    // Map Firebase Auth error codes to user-friendly messages
    switch (error.code) {
      case 'auth/email-already-in-use':
        originalError.message = 'This email is already in use. Please try a different email or log in.';
        break;
      case 'auth/invalid-email':
        originalError.message = 'The email address is invalid. Please check and try again.';
        break;
      case 'auth/user-disabled':
        originalError.message = 'This account has been disabled. Please contact support.';
        break;
      case 'auth/user-not-found':
        originalError.message = 'No account found with this email. Please check or create a new account.';
        break;
      case 'auth/wrong-password':
        originalError.message = 'Incorrect password. Please try again or reset your password.';
        break;
      case 'auth/weak-password':
        originalError.message = 'The password is too weak. Please use a stronger password.';
        break;
      case 'auth/operation-not-allowed':
        originalError.message = 'This operation is not allowed. Please contact support.';
        break;
      case 'auth/invalid-credential':
        originalError.message = 'Invalid login credentials. Please check and try again.';
        break;
      case 'auth/too-many-requests':
        originalError.message = 'Too many unsuccessful login attempts. Please try again later or reset your password.';
        break;
      case 'auth/requires-recent-login':
        originalError.message = 'This action requires you to reauthenticate. Please log in again.';
        break;
    }
    
    return originalError;
  }
}

// Export as default
export default new UserRepository();