// src/services/api/client.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from '../LoggingService';
import env from '../../config/env';

/**
 * Creates and configures the API client for making requests to the backend
 */
const apiClient = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: env.API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// Request interceptor for adding auth token and handling request logging
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Add auth token if available
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Log outgoing requests in development
      if (__DEV__) {
        Logger.debug(
          LogCategory.NETWORK, 
          `API Request: ${config.method?.toUpperCase()} ${config.url}`, 
          { params: config.params, data: config.data }
        );
      }
      
      return config;
    } catch (error) {
      Logger.error(LogCategory.NETWORK, 'Error in request interceptor', { error });
      return config;
    }
  },
  (error) => {
    Logger.error(LogCategory.NETWORK, 'Request interceptor error', { error });
    return Promise.reject(error);
  }
);

// Response interceptor for handling responses and errors
apiClient.interceptors.response.use(
  (response) => {
    // Log successful responses in development
    if (__DEV__) {
      Logger.debug(
        LogCategory.NETWORK, 
        `API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`,
        { responseData: response.data }
      );
    }
    
    return response;
  },
  async (error) => {
    // Handle response errors
    const originalRequest = error.config;
    
    // Log the error
    Logger.error(
      LogCategory.NETWORK, 
      `API Error: ${error.response?.status || 'Network Error'} ${originalRequest.method?.toUpperCase()} ${originalRequest.url}`,
      { 
        error: error.message,
        data: error.response?.data,
        status: error.response?.status,
        headers: originalRequest.headers
      }
    );
    
    // Handle token expiration
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt to refresh the token
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        
        if (refreshToken) {
          // Call token refresh endpoint
          const response = await axios.post(`${env.API_BASE_URL}/auth/refresh`, {
            refreshToken
          });
          
          // Store new tokens
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          await AsyncStorage.setItem('auth_token', accessToken);
          await AsyncStorage.setItem('refresh_token', newRefreshToken);
          
          // Update Authorization header and retry the original request
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // If refresh fails, clear tokens and require re-login
        await AsyncStorage.multiRemove(['auth_token', 'refresh_token']);
        Logger.error(LogCategory.AUTH, 'Token refresh failed', { refreshError });
        
        // You could emit an event here to notify the app to redirect to login
        // Example: EventEmitter.emit('AUTH_FAILURE');
      }
    }
    
    return Promise.reject(error);
  }
);

/**
 * Handles API response errors in a consistent way
 * @param {Error} error - The error from axios
 * @returns {Object} - Standardized error object
 */
export const handleApiError = (error) => {
  const errorResponse = {
    message: 'An unexpected error occurred',
    status: 500,
    data: null
  };
  
  if (error.response) {
    // Server responded with a status code outside of 2xx range
    errorResponse.message = error.response.data?.message || error.message;
    errorResponse.status = error.response.status;
    errorResponse.data = error.response.data;
  } else if (error.request) {
    // Request was made but no response was received
    errorResponse.message = 'No response received from server';
    errorResponse.status = 0;
  } else {
    // Error in setting up the request
    errorResponse.message = error.message;
  }
  
  return errorResponse;
};

export default apiClient;