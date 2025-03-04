// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Logger, LogCategory } from '../services/LoggingService';

// Your web app's Firebase configuration - replace with your actual config from Firebase Console
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

// Enable offline persistence when not on web
if (Platform.OS !== 'web') {
  enableIndexedDbPersistence(db)
    .then(() => {
      Logger.info(LogCategory.STORAGE, 'Firestore persistence enabled');
    })
    .catch((err) => {
      Logger.error(LogCategory.STORAGE, 'Error enabling persistence:', { error: err });
    });
}

// Export Firebase services
export { app, auth };
export const firestore = db;

// Export Firebase utility functions
import { serverTimestamp as fsServerTimestamp, increment as fsIncrement } from 'firebase/firestore';
export const serverTimestamp = () => fsServerTimestamp();
export const increment = (amount) => fsIncrement(amount);