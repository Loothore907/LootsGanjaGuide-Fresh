// src/types/schema.js
/**
 * Schema definitions for the Loot's Ganja Guide application
 * 
 * This file defines the structure of the main data types used throughout the app.
 * These schemas serve as contracts for data consistency and type checking.
 */

/**
 * Days of the week enum (lowercase for API compatibility)
 * @readonly
 * @enum {string}
 */
export const DayOfWeek = {
    MONDAY: 'monday',
    TUESDAY: 'tuesday',
    WEDNESDAY: 'wednesday',
    THURSDAY: 'thursday',
    FRIDAY: 'friday',
    SATURDAY: 'saturday',
    SUNDAY: 'sunday'
  };
  
  /**
   * Deal type enum
   * @readonly
   * @enum {string}
   */
  export const DealType = {
    BIRTHDAY: 'birthday',
    DAILY: 'daily',
    SPECIAL: 'special'
  };
  
  /**
   * Interaction type enum
   * @readonly
   * @enum {string}
   */
  export const InteractionType = {
    CHECK_IN: 'check-in',
    SOCIAL_POST: 'social-post',
    ROUTE_COMPLETION: 'route-completion'
  };
  
  /**
   * Deal Model
   * Base deal type containing common properties for all deal types
   * 
   * @typedef {Object} Deal
   * @property {string} description - Description of the deal
   * @property {string} discount - Discount amount or description (e.g. "20% OFF", "BOGO")
   * @property {string[]} restrictions - Array of restriction strings
   */
  
  /**
   * Special Deal Model
   * Extends the base Deal with special-deal specific properties
   * 
   * @typedef {Deal & {
   *   title: string,
   *   startDate: string, // ISO date string
   *   endDate: string,   // ISO date string
   * }} SpecialDeal
   */
  
  /**
   * Business Hours Model
   * 
   * @typedef {Object} BusinessHours
   * @property {string} open - Opening time in 24-hour format (e.g. "09:00")
   * @property {string} close - Closing time in 24-hour format (e.g. "21:00")
   */
  
  /**
   * Vendor Location Model
   * 
   * @typedef {Object} VendorLocation
   * @property {string} address - Full address string
   * @property {Object} coordinates - Geographic coordinates
   * @property {number} coordinates.latitude - Latitude coordinate
   * @property {number} coordinates.longitude - Longitude coordinate
   */
  
  /**
   * Vendor Contact Model
   * 
   * @typedef {Object} VendorContact
   * @property {string} phone - Phone number
   * @property {string} email - Email address
   * @property {Object} social - Social media handles
   * @property {string} social.instagram - Instagram handle (without @)
   * @property {string} social.facebook - Facebook page identifier
   */
  
  /**
   * Vendor Deals Model
   * 
   * @typedef {Object} VendorDeals
   * @property {Deal} [birthday] - Birthday deal if available
   * @property {Object.<DayOfWeek, Deal[]>} daily - Daily deals organized by day of week
   * @property {SpecialDeal[]} special - Array of special/limited time deals
   */
  
  /**
   * Vendor Model
   * Main vendor data structure
   * 
   * @typedef {Object} Vendor
   * @property {string} id - Unique identifier
   * @property {string} name - Vendor name
   * @property {VendorLocation} location - Vendor location information
   * @property {VendorContact} contact - Vendor contact information
   * @property {Object.<DayOfWeek, BusinessHours>} hours - Business hours for each day
   * @property {VendorDeals} deals - Deals offered by the vendor
   * @property {boolean} isPartner - Whether vendor is a premium partner
   * @property {number} rating - Vendor rating (0-5)
   * @property {string} lastUpdated - ISO date string of last update
   * @property {string} [logoUrl] - URL to vendor logo image
   * @property {string} [bannerUrl] - URL to vendor banner image
   * @property {number} [distance] - Distance from user in miles (calculated field)
   */
  
  /**
   * User Model
   * User profile and preferences
   * 
   * @typedef {Object} User
   * @property {string} id - Unique identifier
   * @property {string} username - User's chosen username
   * @property {number} points - Reward points accumulated
   * @property {string} [email] - User's email if provided
   * @property {string} [birthdate] - User's birthdate (YYYY-MM-DD)
   * @property {boolean} tosAccepted - Whether user accepted TOS
   * @property {string} ageVerificationDate - When age was verified
   * @property {string[]} favorites - Array of favorite vendor IDs
   * @property {string} createdAt - ISO date string of account creation
   */
  
  /**
   * User Preferences Model
   * User app settings
   * 
   * @typedef {Object} UserPreferences
   * @property {string} theme - UI theme preference ('light' or 'dark')
   * @property {boolean} notifications - Notification preference
   * @property {number} maxDistance - Default max distance for deals in miles
   * @property {boolean} showPartnerOnly - Whether to only show partner vendors
   */
  
  /**
   * Recent Visit Model
   * Tracks user's recent vendor visits
   * 
   * @typedef {Object} RecentVisit
   * @property {string} vendorId - Vendor's unique identifier
   * @property {string} vendorName - Vendor name
   * @property {string} lastVisit - ISO date string of last visit
   * @property {number} visitCount - Number of visits to this vendor
   */
  
  /**
   * User Interaction Model
   * Records interactions between users and vendors
   * 
   * @typedef {Object} UserInteraction
   * @property {string} id - Unique identifier
   * @property {string} userId - User's unique identifier
   * @property {string} vendorId - Vendor's unique identifier
   * @property {InteractionType} interactionType - Type of interaction
   * @property {string} timestamp - ISO date string when interaction occurred
   * @property {number} pointsEarned - Points earned from this interaction
   * @property {Object} [metadata] - Additional interaction details
   */
  
  /**
   * Journey Model
   * Represents a planned route between multiple vendors
   * 
   * @typedef {Object} Journey
   * @property {string} id - Unique identifier
   * @property {string} userId - User's unique identifier
   * @property {DealType} dealType - Type of deals being pursued
   * @property {Vendor[]} vendors - Array of vendors in the journey
   * @property {number} currentVendorIndex - Index of current vendor in journey
   * @property {number} maxDistance - Maximum distance in miles
   * @property {number} totalVendors - Total number of vendors in journey
   * @property {string} createdAt - ISO date string of journey creation
   * @property {string} [completedAt] - ISO date string of journey completion
   */
  
  /**
   * Route Model
   * Navigation details for a journey
   * 
   * @typedef {Object} Route
   * @property {Object[]} coordinates - Array of coordinates for the route
   * @property {number} coordinates[].latitude - Latitude coordinate
   * @property {number} coordinates[].longitude - Longitude coordinate
   * @property {number} totalDistance - Total distance in miles
   * @property {number} estimatedTime - Estimated time in minutes
   */
  
  /**
   * Vendor Analytics Model
   * Analytics data for vendors
   * 
   * @typedef {Object} VendorAnalytics
   * @property {string} vendorId - Vendor's unique identifier
   * @property {Object} interactions - Interaction counts
   * @property {number} interactions.checkIns - Number of check-ins
   * @property {number} interactions.socialPosts - Number of social posts
   * @property {number} interactions.routeVisits - Number of route visits
   * @property {Object} userStats - User statistics
   * @property {number} userStats.uniqueVisitors - Number of unique visitors
   * @property {number} userStats.repeatVisitors - Number of repeat visitors
   * @property {string} lastUpdated - ISO date string of last update
   */
  
  // Constants
  export const DAYS_OF_WEEK = Object.values(DayOfWeek);
  export const DEAL_TYPES = Object.values(DealType);
  export const INTERACTION_TYPES = Object.values(InteractionType);
  
  // Validation functions
  /**
   * Validates a vendor object against the schema
   * @param {Object} vendor - Vendor object to validate
   * @returns {boolean} True if valid
   */
  export const isValidVendor = (vendor) => {
    if (!vendor || typeof vendor !== 'object') return false;
    
    // Required fields
    const requiredFields = ['id', 'name', 'location', 'contact', 'hours', 'deals'];
    for (const field of requiredFields) {
      if (!vendor[field]) return false;
    }
    
    // Location validation
    if (!vendor.location.address || 
        !vendor.location.coordinates ||
        typeof vendor.location.coordinates.latitude !== 'number' ||
        typeof vendor.location.coordinates.longitude !== 'number') {
      return false;
    }
    
    // Hours validation
    for (const day of DAYS_OF_WEEK) {
      if (vendor.hours[day] && 
          (!vendor.hours[day].open || !vendor.hours[day].close)) {
        return false;
      }
    }
    
    return true;
  };
  
  /**
   * Validates a deal object against the schema
   * @param {Object} deal - Deal object to validate
   * @returns {boolean} True if valid
   */
  export const isValidDeal = (deal) => {
    if (!deal || typeof deal !== 'object') return false;
    
    // Required fields
    const requiredFields = ['description', 'discount'];
    for (const field of requiredFields) {
      if (!deal[field]) return false;
    }
    
    // Restrictions should be an array if present
    if (deal.restrictions && !Array.isArray(deal.restrictions)) {
      return false;
    }
    
    return true;
  };
  
  /**
   * Validates a special deal object against the schema
   * @param {Object} deal - Special deal object to validate
   * @returns {boolean} True if valid
   */
  export const isValidSpecialDeal = (deal) => {
    if (!isValidDeal(deal)) return false;
    
    // Additional required fields for special deals
    const additionalFields = ['title', 'startDate', 'endDate'];
    for (const field of additionalFields) {
      if (!deal[field]) return false;
    }
    
    // Validate dates
    try {
      new Date(deal.startDate);
      new Date(deal.endDate);
    } catch (e) {
      return false;
    }
    
    return true;
  };
  
  // Export schema types for use in the application
  export default {
    DayOfWeek,
    DealType,
    InteractionType,
    DAYS_OF_WEEK,
    DEAL_TYPES,
    INTERACTION_TYPES,
    
    // Validation functions
    isValidVendor,
    isValidDeal,
    isValidSpecialDeal
  };