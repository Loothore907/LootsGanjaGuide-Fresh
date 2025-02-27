// This is a utility function to add to your src/utils/DateUtils.js file (create if needed)

/**
 * Safely converts any value to lowercase
 * Handles Date objects by converting to string first
 * @param {any} value - The value to convert to lowercase
 * @returns {string} - Lowercase string value
 */
export const toLowerCaseSafe = (value) => {
    if (value instanceof Date) {
      // Convert Date to ISO string first
      return value.toISOString().toLowerCase();
    }
    
    // For strings, use toLowerCase directly
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    
    // For other types, convert to string first
    return String(value).toLowerCase();
  };
  
  /**
   * Converts a Date object to a string in the format: YYYY-MM-DD
   * @param {Date} date - The date to format
   * @returns {string} - The formatted date string
   */
  export const formatDate = (date) => {
    if (!(date instanceof Date)) {
      return '';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };
  
  /**
   * Gets the current day of week as a lowercase string
   * @returns {string} - day of week (e.g., 'monday', 'tuesday', etc.)
   */
  export const getDayOfWeek = () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay(); // Returns 0-6 (Sunday-Saturday)
    return days[today];
  };