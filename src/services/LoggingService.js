// src/services/LoggingService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * LogLevel enum for different severity levels
 */
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

/**
 * Log categories to organize logs by feature area
 */
export const LogCategory = {
  AUTH: 'AUTH',
  NAVIGATION: 'NAVIGATION',
  DEALS: 'DEALS',
  VENDORS: 'VENDORS',
  CHECKIN: 'CHECKIN',
  JOURNEY: 'JOURNEY',
  STORAGE: 'STORAGE',
  NETWORK: 'NETWORK',
  GENERAL: 'GENERAL'
};

class LoggingService {
  constructor() {
    this.logs = [];
    this.maxLogSize = 1000; // Maximum number of logs to keep in memory
    this.isInitialized = false;
    this.shouldPersistLogs = true; // Set to false in production if not needed
    this.shouldLogToConsole = __DEV__; // Only log to console in development
  }

  /**
   * Initialize the logging service, loading any persisted logs
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      if (this.shouldPersistLogs) {
        const storedLogs = await AsyncStorage.getItem('app_logs');
        if (storedLogs) {
          this.logs = JSON.parse(storedLogs);
          // Ensure we don't exceed max log size
          if (this.logs.length > this.maxLogSize) {
            this.logs = this.logs.slice(this.logs.length - this.maxLogSize);
          }
        }
      }
      this.isInitialized = true;
      this.log(LogLevel.INFO, LogCategory.GENERAL, 'Logging service initialized');
    } catch (error) {
      console.error('Failed to initialize logging service:', error);
      this.isInitialized = true; // Still mark as initialized to prevent retry loops
    }
  }

  /**
   * Log a message with the specified level and category
   * @param {LogLevel} level - Severity level
   * @param {LogCategory} category - Feature category
   * @param {string} message - Log message
   * @param {Object} [data] - Optional data to include with the log
   */
  log(level, category, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      category,
      message,
      data: data ? JSON.stringify(data) : null
    };

    // Add to in-memory logs
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogSize) {
      this.logs.shift(); // Remove oldest log if exceeding max size
    }

    // Log to console in development
    if (this.shouldLogToConsole) {
      const consoleMethod = this._getConsoleMethod(level);
      consoleMethod(`[${timestamp}] [${level}] [${category}] ${message}`, data || '');
    }

    // Persist logs if configured
    if (this.shouldPersistLogs) {
      this._persistLogs();
    }
  }

  /**
   * Log debug message
   */
  debug(category, message, data = null) {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  /**
   * Log info message
   */
  info(category, message, data = null) {
    this.log(LogLevel.INFO, category, message, data);
  }

  /**
   * Log warning message
   */
  warn(category, message, data = null) {
    this.log(LogLevel.WARNING, category, message, data);
  }

  /**
   * Log error message
   */
  error(category, message, data = null) {
    this.log(LogLevel.ERROR, category, message, data);
  }

  /**
   * Log critical error message
   */
  critical(category, message, data = null) {
    this.log(LogLevel.CRITICAL, category, message, data);
  }

  /**
   * Get all logs for a specific category
   * @param {LogCategory} category - Category to filter by
   */
  getLogsByCategory(category) {
    return this.logs.filter(log => log.category === category);
  }

  /**
   * Get logs of a specific level
   * @param {LogLevel} level - Level to filter by
   */
  getLogsByLevel(level) {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get all logs
   */
  getAllLogs() {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  async clearLogs() {
    this.logs = [];
    if (this.shouldPersistLogs) {
      try {
        await AsyncStorage.removeItem('app_logs');
      } catch (error) {
        console.error('Failed to clear persisted logs:', error);
      }
    }
  }

  /**
   * Persist logs to AsyncStorage
   * @private
   */
  async _persistLogs() {
    try {
      await AsyncStorage.setItem('app_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to persist logs:', error);
    }
  }

  /**
   * Get the appropriate console method based on log level
   * @private
   */
  _getConsoleMethod(level) {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARNING:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        return console.error;
      default:
        return console.log;
    }
  }
}

// Export singleton instance
export const Logger = new LoggingService();

// Error boundary for catching and logging unhandled errors
export const logError = (error, componentStack = null, componentName = null) => {
  const category = componentName ? LogCategory.GENERAL : LogCategory.GENERAL;
  const message = `Unhandled error${componentName ? ` in ${componentName}` : ''}`;
  const data = {
    message: error.message,
    stack: error.stack,
    componentStack
  };
  
  Logger.error(category, message, data);
};