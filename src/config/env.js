// src/config/env.js
import { 
  GOOGLE_MAPS_API_KEY, 
  API_BASE_URL, 
  ANALYTICS_KEY,
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID
} from '@env';

import { Platform } from 'react-native';
import { Logger, LogCategory } from '../services/LoggingService';

// For debugging in development mode
if (__DEV__) {
  Logger.debug(LogCategory.GENERAL, 'Environment variables status', {
    GOOGLE_MAPS_API_KEY: GOOGLE_MAPS_API_KEY ? 'SET' : 'NOT SET',
    API_BASE_URL: API_BASE_URL ? 'SET' : 'NOT SET',
    FIREBASE_API_KEY: FIREBASE_API_KEY ? 'SET' : 'NOT SET',
    FIREBASE_PROJECT_ID: FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET'
  });
}

// Validate required environment variables
const requiredVars = [
  { key: 'GOOGLE_MAPS_API_KEY', value: GOOGLE_MAPS_API_KEY },
  { key: 'API_BASE_URL', value: API_BASE_URL },
  { key: 'FIREBASE_API_KEY', value: FIREBASE_API_KEY },
  { key: 'FIREBASE_PROJECT_ID', value: FIREBASE_PROJECT_ID }
];

// In development, warn about missing variables
if (__DEV__) {
  requiredVars.forEach(({ key, value }) => {
    if (!value) {
      console.warn(`Environment variable ${key} is not set. Please check your .env file.`);
    }
  });
}

export default {
  // API Keys
  GOOGLE_MAPS_API_KEY,
  ANALYTICS_KEY,
  
  // Firebase Configuration
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID,
  
  // API Configuration
  API_BASE_URL,
  API_TIMEOUT: 30000, // 30 seconds
  
  // Feature Flags
  ENABLE_ANALYTICS: !!ANALYTICS_KEY,
  
  // App Configuration
  MIN_AGE_REQUIREMENT: 21,
  
  // Cache Configuration
  CACHE_TTL: 1000 * 60 * 60, // 1 hour in milliseconds
  
  // Map Configuration
  DEFAULT_LATITUDE: 61.217381, // Anchorage, Alaska
  DEFAULT_LONGITUDE: -149.863129,
  DEFAULT_DELTA: 0.05,
  
  // Other Constants
  DAYS_OF_WEEK: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  DEAL_TYPES: ['birthday', 'daily', 'special']
};