// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Logger, LogCategory } from '../services/LoggingService';
import ENV from './env';

// Firebase configuration
// Using environment variables from ENV
const firebaseConfig = {
  apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROJECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID,
  measurementId: ENV.FIREBASE_MEASUREMENT_ID
};

// Log the configuration for debugging (remove in production)
if (__DEV__) {
  Logger.debug(LogCategory.AUTH, 'Firebase config', {
    apiKey: firebaseConfig.apiKey ? 'SET' : 'NOT SET',
    authDomain: firebaseConfig.authDomain ? 'SET' : 'NOT SET',
    projectId: firebaseConfig.projectId ? 'SET' : 'NOT SET',
    appId: firebaseConfig.appId ? 'SET' : 'NOT SET',
  });
}

// Flag to check if Firebase config is valid
export const hasValidFirebaseConfig = () => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
  
  for (const field of requiredFields) {
    // Check if the field is missing or empty
    if (!firebaseConfig[field]) {
      Logger.warn(LogCategory.AUTH, `Firebase config missing required field: ${field}`);
      return false;
    }
  }
  
  return true;
};

let app;
let auth;
let firestore;

// Initialize Firebase conditionally
try {
  if (hasValidFirebaseConfig()) {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    
    // Initialize Auth with AsyncStorage persistence
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
    
    // Initialize Firestore
    firestore = getFirestore(app);
    
    // Enable offline persistence when not on web
    if (Platform.OS !== 'web') {
      enableIndexedDbPersistence(firestore)
        .then(() => {
          Logger.info(LogCategory.STORAGE, 'Firestore persistence enabled');
        })
        .catch((err) => {
          Logger.error(LogCategory.STORAGE, 'Error enabling persistence:', { error: err });
        });
    }
    
    Logger.info(LogCategory.AUTH, 'Firebase initialized successfully');
  } else {
    Logger.warn(LogCategory.AUTH, 'Invalid Firebase configuration - operating in local-only mode');
    // Set fallback values for exports to prevent crashes
    app = null;
    auth = null;
    firestore = null;
  }
} catch (error) {
  Logger.error(LogCategory.AUTH, 'Error initializing Firebase', { error });
  // Set fallback values for exports to prevent crashes
  app = null;
  auth = null;
  firestore = null;
}

// Export Firebase services
export { app, auth, firestore };

// Export Firebase utility functions
import { serverTimestamp as fsServerTimestamp, increment as fsIncrement } from 'firebase/firestore';
export const serverTimestamp = () => fsServerTimestamp();
export const increment = (amount) => fsIncrement(amount);