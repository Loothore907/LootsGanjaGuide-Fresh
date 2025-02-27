import { 
    GOOGLE_MAPS_API_KEY, 
    API_BASE_URL, 
    ANALYTICS_KEY 
  } from '@env';
  
  // Validate required environment variables
  const requiredVars = [
    { key: 'GOOGLE_MAPS_API_KEY', value: GOOGLE_MAPS_API_KEY },
    { key: 'API_BASE_URL', value: API_BASE_URL }
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