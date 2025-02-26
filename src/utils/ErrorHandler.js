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
 * Handle an error appropriately based on its type
 * @param {Error} error - The error to handle
 * @param {LogCategory} category - The category for logging
 * @param {string} context - Description of where/when the error occurred
 * @param {boolean} showAlert - Whether to show an alert to the user
 * @param {Function} [callback] - Optional callback after error is handled
 */
export const handleError = (error, category, context, showAlert = true, callback = null) => {
  // Determine error type
  const errorType = error instanceof AppError ? error.type : ErrorType.UNEXPECTED;
  
  // Log the error
  Logger.error(category, `Error in ${context}: ${error.message}`, {
    type: errorType,
    stack: error.stack,
    metadata: error instanceof AppError ? error.metadata : {}
  });

  // Prepare user-friendly message
  let userMessage;
  switch (errorType) {
    case ErrorType.NETWORK:
      userMessage = 'Network connection issue. Please check your internet connection and try again.';
      break;
    case ErrorType.STORAGE:
      userMessage = 'Unable to access local storage. Please restart the app and try again.';
      break;
    case ErrorType.VALIDATION:
      userMessage = error.message || 'Invalid data. Please check your input and try again.';
      break;
    case ErrorType.PERMISSION:
      userMessage = 'Permission denied. Please grant the required permissions in your device settings.';
      break;
    case ErrorType.AUTH:
      userMessage = 'Authentication error. Please try again.';
      break;
    default:
      userMessage = 'Something went wrong. Please try again later.';
  }

  // Show alert if requested
  if (showAlert) {
    Alert.alert('Error', userMessage, [{ text: 'OK' }]);
  }

  // Execute callback if provided
  if (callback && typeof callback === 'function') {
    callback(error);
  }

  return userMessage;
};

/**
 * Try to execute a function and handle any errors
 * @param {Function} fn - Function to execute
 * @param {LogCategory} category - Category for logging
 * @param {string} context - Description of operation
 * @param {boolean} showAlert - Whether to show alerts
 * @returns {Promise} - Resolves with function result or rejects with handled error
 */
export const tryCatch = async (fn, category, context, showAlert = true) => {
  try {
    return await fn();
  } catch (error) {
    handleError(error, category, context, showAlert);
    throw error; // Re-throw so caller can handle if needed
  }
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