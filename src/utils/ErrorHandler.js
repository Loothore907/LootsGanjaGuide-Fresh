// src/utils/ErrorHandler.js
import { Alert } from 'react-native';
import { Logger, LogCategory } from '../services/LoggingService';

/**
 * Error types to help categorize different errors
 */
export const ErrorType = {
  NETWORK: 'NETWORK_ERROR',
  STORAGE: 'STORAGE_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  AUTH: 'AUTH_ERROR',
  UNEXPECTED: 'UNEXPECTED_ERROR'
};

/**
 * Custom Error class with additional metadata
 */
export class AppError extends Error {
  constructor(message, type = ErrorType.UNEXPECTED, metadata = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Utility for handling errors consistently throughout the app
 * 
 * @param {Function} fn - The async function to execute
 * @param {LogCategory} category - The logging category
 * @param {string} action - Description of the action being performed
 * @param {any} defaultValue - Default value to return on error
 * @returns {Promise<any>} - The result of the function or defaultValue on error
 */
export const tryCatch = async (fn, category, action, defaultValue = null) => {
  try {
    return await fn();
  } catch (error) {
    Logger.error(
      category || LogCategory.GENERAL,
      `Error ${action || 'performing operation'}`,
      { error }
    );
    return defaultValue;
  }
};

/**
 * Format an error for display to the user
 * 
 * @param {Error} error - The error to format
 * @returns {string} - User-friendly error message
 */
export const formatError = (error) => {
  if (!error) return 'An unknown error occurred';
  
  // Firebase auth errors
  if (error.code) {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'The email address is not valid.';
      case 'auth/user-disabled':
        return 'This user account has been disabled.';
      case 'auth/user-not-found':
        return 'No user found with this email address.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/email-already-in-use':
        return 'This email is already in use.';
      case 'auth/weak-password':
        return 'The password is too weak.';
      case 'auth/operation-not-allowed':
        return 'This operation is not allowed.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      case 'permission-denied':
        return 'You do not have permission to perform this action.';
      default:
        if (error.code.startsWith('auth/')) {
          return 'Authentication error: ' + error.message;
        }
    }
  }
  
  // Network errors
  if (error.message && error.message.includes('Network Error')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  // Default error message
  return error.message || 'An unexpected error occurred. Please try again.';
};

/**
 * Handle an error with logging and optional alert
 * 
 * @param {Error} error - The error to handle
 * @param {LogCategory} category - The logging category
 * @param {string} action - Description of the action being performed
 * @param {boolean} showAlert - Whether to show an alert to the user
 */
export const handleError = (error, category, action, showAlert = false) => {
  Logger.error(category || LogCategory.GENERAL, `Error ${action || 'occurred'}`, { error });
  
  if (showAlert && typeof alert === 'function') {
    alert(formatError(error));
  }
  
  return formatError(error);
};

export default {
  tryCatch,
  formatError,
  handleError
};

/**
 * Create a validator function for input validation
 * @param {Function} validationFn - Function that returns true if valid, false if not
 * @param {string} errorMessage - Message to display if validation fails
 * @returns {Function} - Function that throws ValidationError if invalid
 */
export const createValidator = (validationFn, errorMessage) => {
  return (value) => {
    if (!validationFn(value)) {
      throw new AppError(errorMessage, ErrorType.VALIDATION);
    }
    return true;
  };
};

// Commonly used validators
export const Validators = {
  required: createValidator(value => value !== undefined && value !== null && value !== '', 
    'This field is required'),
  
  minLength: (min) => createValidator(value => value && value.length >= min, 
    `Must be at least ${min} characters`),
  
  maxLength: (max) => createValidator(value => !value || value.length <= max, 
    `Must be no more than ${max} characters`),
  
  email: createValidator(
    value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    'Please enter a valid email address'
  ),
  
  phone: createValidator(
    value => /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(value),
    'Please enter a valid phone number'
  ),
  
  age: (minAge) => createValidator(
    value => {
      if (!value) return false;
      const today = new Date();
      const birthDate = new Date(value);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= minAge;
    },
    `You must be at least ${minAge} years old`
  )
};