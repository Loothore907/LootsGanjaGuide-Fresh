// src/services/adapters/FirebaseAuthAdapter.js
import { auth } from '../../config/firebase';
import { 
  signInAnonymously,
  updateProfile,
  signOut
} from 'firebase/auth';
import { firestore, serverTimestamp } from '../../config/firebase';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from '../LoggingService';

/**
 * Adapter for connecting app's AsyncStorage-based authentication
 * with Firebase Authentication
 */
class FirebaseAuthAdapter {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the adapter
   */
  async initialize() {
    try {
      Logger.info(LogCategory.AUTH, 'Initializing FirebaseAuthAdapter');
      this.initialized = true;
      return true;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error initializing FirebaseAuthAdapter', { error });
      return false;
    }
  }

  /**
   * Check if adapter is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get the current Firebase user
   * @returns {Object|null} The current Firebase user or null
   */
  getCurrentUser() {
    return auth.currentUser;
  }

  /**
   * Create a new anonymous user in Firebase when a user completes age verification
   * and sets up their username
   * 
   * @param {string} username - The username chosen by the user
   * @returns {Promise<Object>} - The created user object and auth state
   */
  async createAnonymousUser(username) {
    try {
      Logger.info(LogCategory.AUTH, 'Creating anonymous Firebase user', { username });

      if (!username) {
        throw new Error('Username is required');
      }

      // Create anonymous user in Firebase
      const userCredential = await signInAnonymously(auth);
      const { user } = userCredential;

      // Update the display name to match the username
      await updateProfile(user, {
        displayName: username
      });

      Logger.info(LogCategory.AUTH, 'Anonymous user created successfully', { 
        uid: user.uid,
        displayName: user.displayName
      });

      // Create the user document in Firestore
      await this.createUserDocument(user.uid, {
        username,
        isAnonymous: true,
        ageVerified: true,
        tosAccepted: true
      });

      return {
        user,
        isAnonymous: true,
        success: true
      };
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error creating anonymous user', { error, username });
      throw error;
    }
  }

  /**
   * Sign in a returning user
   * This handles both anonymous and email users
   */
  async signInReturningUser(username) {
    try {
      Logger.info(LogCategory.AUTH, 'Attempting to sign in returning user', { username });

      // First, try to find if this username exists in Firestore
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('username', '==', username), limit(1));
      const snapshot = await getDocs(q);

      // If user document exists, attempt to authenticate
      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        // For now, just do an anonymous signin 
        // (Later we can implement email/password flow if needed)
        const userCredential = await signInAnonymously(auth);
        const { user } = userCredential;

        // Update display name to match stored username
        await updateProfile(user, {
          displayName: username
        });

        Logger.info(LogCategory.AUTH, 'Returning user signed in successfully', { 
          uid: user.uid,
          username
        });

        return {
          user,
          success: true,
          isReturning: true
        };
      } else {
        // Username not found in Firebase, create a new user
        Logger.info(LogCategory.AUTH, 'Username not found in Firebase, creating new user', { username });
        return await this.createAnonymousUser(username);
      }
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error signing in returning user', { error, username });
      throw error;
    }
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    try {
      await signOut(auth);
      Logger.info(LogCategory.AUTH, 'User signed out from Firebase');
      return true;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error signing out from Firebase', { error });
      throw error;
    }
  }

  /**
   * Create or update the user document in Firestore
   */
  async createUserDocument(uid, userData) {
    try {
      const userRef = doc(firestore, 'users', uid);
      
      // Check if document already exists
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        // Update existing document
        await updateDoc(userRef, {
          ...userData,
          updatedAt: serverTimestamp()
        });
        Logger.info(LogCategory.AUTH, 'Updated user document', { uid });
      } else {
        // Create new document
        await setDoc(userRef, {
          id: uid,
          username: userData.username,
          email: userData.email || null,
          points: 0,
          favorites: [],
          tosAccepted: userData.tosAccepted || false,
          ageVerified: userData.ageVerified || false,
          ageVerificationDate: userData.ageVerified ? new Date().toISOString() : null,
          isAnonymous: userData.isAnonymous || true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        Logger.info(LogCategory.AUTH, 'Created user document', { uid });
      }
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error creating/updating user document', { error, uid });
      throw error;
    }
  }

  /**
   * Update user information in both Firebase Auth and Firestore
   */
  async updateUserInfo(userData) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('No authenticated user');
      }
      
      // Update Auth profile if username provided
      if (userData.username) {
        await updateProfile(currentUser, {
          displayName: userData.username
        });
      }
      
      // Update Firestore document
      await this.createUserDocument(currentUser.uid, userData);
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error updating user info', { error });
      throw error;
    }
  }

  /**
   * Set the user's age verification status
   */
  async setAgeVerified(isVerified) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        // No Firebase user yet, this will be handled during user creation
        return true;
      }
      
      await this.updateUserInfo({
        ageVerified: isVerified,
        ageVerificationDate: isVerified ? new Date().toISOString() : null
      });
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error setting age verification status', { error, isVerified });
      throw error;
    }
  }

  /**
   * Set the user's terms of service acceptance status
   */
  async setTosAccepted(isAccepted) {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        // No Firebase user yet, this will be handled during user creation
        return true;
      }
      
      await this.updateUserInfo({
        tosAccepted: isAccepted,
        tosAcceptedDate: isAccepted ? new Date().toISOString() : null
      });
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Error setting TOS acceptance status', { error, isAccepted });
      throw error;
    }
  }
}

// Create and export singleton instance
const firebaseAuthAdapter = new FirebaseAuthAdapter();
export default firebaseAuthAdapter;