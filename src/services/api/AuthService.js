// src/services/api/AuthService.js
import apiClient, { handleApiError } from './Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from '../LoggingService';
import env from '../../config/env';

/**
 * Service for handling authentication-related API requests
 */
export const AuthService = {
  /**
   * Verify user's age without requiring account creation
   * @param {Object} data - Age verification data
   * @param {string} data.birthdate - User's birthdate in YYYY-MM-DD format
   * @returns {Promise<Object>} - Result with verification status
   */
  verifyAge: async (data) => {
    try {
      const response = await apiClient.post('/auth/verify-age', data);
      
      // Store age verification result
      if (response.data && response.data.verified) {
        await AsyncStorage.setItem('isAgeVerified', 'true');
        await AsyncStorage.setItem('ageVerificationDate', new Date().toISOString());
      }
      
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Age verification failed', { error });
      throw handleApiError(error);
    }
  },
  
  /**
   * Accept terms of service
   * @returns {Promise<Object>} - Result with acceptance status
   */
  acceptTerms: async () => {
    try {
      const response = await apiClient.post('/auth/accept-terms');
      
      // Store terms acceptance
      if (response.data && response.data.accepted) {
        await AsyncStorage.setItem('tosAccepted', 'true');
        await AsyncStorage.setItem('tosAcceptedDate', new Date().toISOString());
      }
      
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Terms acceptance failed', { error });
      throw handleApiError(error);
    }
  },
  
  /**
   * Create or update user's username
   * @param {Object} data - Username data
   * @param {string} data.username - User's chosen username
   * @returns {Promise<Object>} - Result with user data
   */
  setUsername: async (data) => {
    try {
      const response = await apiClient.post('/auth/username', data);
      
      // Store username
      if (response.data && response.data.username) {
        await AsyncStorage.setItem('username', response.data.username);
      }
      
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Username setup failed', { error });
      throw handleApiError(error);
    }
  },
  
  /**
   * Create a new user account
   * @param {Object} data - Registration data
   * @param {string} data.email - User's email
   * @param {string} data.password - User's password
   * @param {string} data.username - User's username
   * @returns {Promise<Object>} - Result with user data and tokens
   */
  register: async (data) => {
    try {
      const response = await apiClient.post('/auth/register', data);
      
      // Store auth tokens and user data
      if (response.data) {
        if (response.data.accessToken) {
          await AsyncStorage.setItem('auth_token', response.data.accessToken);
        }
        
        if (response.data.refreshToken) {
          await AsyncStorage.setItem('refresh_token', response.data.refreshToken);
        }
        
        if (response.data.user) {
          await AsyncStorage.setItem('user_data', JSON.stringify(response.data.user));
        }
      }
      
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'User registration failed', { error });
      throw handleApiError(error);
    }
  },
  
  /**
   * Log in with existing credentials
   * @param {Object} data - Login data
   * @param {string} data.email - User's email
   * @param {string} data.password - User's password
   * @returns {Promise<Object>} - Result with user data and tokens
   */
  login: async (data) => {
    try {
      const response = await apiClient.post('/auth/login', data);
      
      // Store auth tokens and user data
      if (response.data) {
        if (response.data.accessToken) {
          await AsyncStorage.setItem('auth_token', response.data.accessToken);
        }
        
        if (response.data.refreshToken) {
          await AsyncStorage.setItem('refresh_token', response.data.refreshToken);
        }
        
        if (response.data.user) {
          await AsyncStorage.setItem('user_data', JSON.stringify(response.data.user));
        }
      }
      
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'User login failed', { error });
      throw handleApiError(error);
    }
  },
  
  /**
   * Log out the current user
   * @returns {Promise<Object>} - Result with logout status
   */
  logout: async () => {
    try {
      // Get refresh token for server-side invalidation
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      
      // Call logout endpoint if we have a token
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken });
      }
      
      // Clear auth-related storage
      await AsyncStorage.multiRemove([
        'auth_token',
        'refresh_token',
        'user_data'
      ]);
      
      return { success: true };
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Logout failed', { error });
      
      // Still clear local storage even if API call fails
      try {
        await AsyncStorage.multiRemove([
          'auth_token',
          'refresh_token',
          'user_data'
        ]);
      } catch (storageError) {
        Logger.error(LogCategory.STORAGE, 'Failed to clear auth data during logout', { storageError });
      }
      
      throw handleApiError(error);
    }
  },
  
  /**
   * Refresh access token using refresh token
   * @returns {Promise<Object>} - Result with new tokens
   */
  refreshToken: async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await apiClient.post('/auth/refresh', { refreshToken });
      
      // Store new tokens
      if (response.data) {
        if (response.data.accessToken) {
          await AsyncStorage.setItem('auth_token', response.data.accessToken);
        }
        
        if (response.data.refreshToken) {
          await AsyncStorage.setItem('refresh_token', response.data.refreshToken);
        }
      }
      
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Token refresh failed', { error });
      
      // Clear tokens if refresh fails
      await AsyncStorage.multiRemove(['auth_token', 'refresh_token']);
      
      throw handleApiError(error);
    }
  },
  
  /**
   * Get the current user's data
   * @returns {Promise<Object>} - User data
   */
  getCurrentUser: async () => {
    try {
      // Try to get from API first
      const response = await apiClient.get('/auth/me');
      
      // Update stored user data
      if (response.data) {
        await AsyncStorage.setItem('user_data', JSON.stringify(response.data));
      }
      
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Failed to get current user from API', { error });
      
      // Try to get from local storage
      try {
        const userData = await AsyncStorage.getItem('user_data');
        if (userData) {
          return JSON.parse(userData);
        }
      } catch (storageError) {
        Logger.error(LogCategory.STORAGE, 'Failed to get user data from storage', { storageError });
      }
      
      throw handleApiError(error);
    }
  },
  
  /**
   * Check if the user is authenticated
   * @returns {Promise<boolean>} - True if user is authenticated
   */
  isAuthenticated: async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      return !!token;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Failed to check authentication status', { error });
      return false;
    }
  },
  
  /**
   * Request a password reset email
   * @param {Object} data - Request data
   * @param {string} data.email - User's email
   * @returns {Promise<Object>} - Result with request status
   */
  requestPasswordReset: async (data) => {
    try {
      const response = await apiClient.post('/auth/forgot-password', data);
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Password reset request failed', { error });
      throw handleApiError(error);
    }
  },
  
  /**
   * Reset password with token
   * @param {Object} data - Reset data
   * @param {string} data.token - Reset token
   * @param {string} data.password - New password
   * @returns {Promise<Object>} - Result with reset status
   */
  resetPassword: async (data) => {
    try {
      const response = await apiClient.post('/auth/reset-password', data);
      return response.data;
    } catch (error) {
      Logger.error(LogCategory.AUTH, 'Password reset failed', { error });
      throw handleApiError(error);
    }
  }
};

export default AuthService; 