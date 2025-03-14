// src/repositories/SimpleVendorRepository.js
import { firestore } from '../config/firebase';
import { Logger, LogCategory } from '../services/LoggingService';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, setDoc } from 'firebase/firestore';
import { isValidVendor } from '../types/Schema';
import { auth } from '../config/firebase';

/**
 * Simplified Repository for vendor-related Firestore operations
 * Focuses on getting all active vendors without complex filtering logic
 */
class SimpleVendorRepository {
  constructor() {
    this.collectionRef = collection(firestore, 'vendors');
  }

  /**
   * Get all vendors without complex filtering
   * @param {Object} options - Basic options (mainly for compatibility)
   * @returns {Promise<Array>} - Array of vendors
   */
  async getAll(options = {}) {
    try {
      Logger.info(LogCategory.VENDORS, 'Getting all vendors', { options });
      
      // Query the collection directly
      const querySnapshot = await getDocs(this.collectionRef);
      
      const vendors = [];
      
      // Process each vendor and normalize schema
      querySnapshot.forEach(doc => {
        try {
          const rawVendor = { id: doc.id, ...doc.data() };
          
          // Basic validation to ensure vendor has required fields
          if (isValidVendor(rawVendor)) {
            // Ensure hasQrCode property exists without logging a warning
            if (rawVendor.hasQrCode === undefined) {
              rawVendor.hasQrCode = true;
            }
            vendors.push(this.normalizeVendorSchema(rawVendor));
          } else {
            Logger.warn(LogCategory.VENDORS, `Skipping invalid vendor ${doc.id}`);
          }
        } catch (vendorError) {
          Logger.warn(LogCategory.VENDORS, `Error processing vendor ${doc.id}`, { error: vendorError });
        }
      });
      
      // Only calculate distances if user location is provided
      if (options.userLocation && typeof options.userLocation === 'object') {
        vendors.forEach(vendor => {
          if (vendor.location?.coordinates?.latitude && vendor.location?.coordinates?.longitude) {
            vendor.distance = this.calculateDistance(
              options.userLocation.latitude,
              options.userLocation.longitude,
              vendor.location.coordinates.latitude,
              vendor.location.coordinates.longitude
            );
          } else {
            vendor.distance = Infinity;
          }
        });
        
        // Sort by distance
        vendors.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
      }
      
      Logger.info(LogCategory.VENDORS, `Found ${vendors.length} vendors`);
      return vendors;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error getting vendors', { error });
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Get a vendor by ID
   * @param {string} id - Vendor ID
   * @returns {Promise<Object|null>} - Vendor document or null if not found
   */
  async getById(id) {
    try {
      if (!id) {
        Logger.warn(LogCategory.VENDORS, 'getById called with no ID');
        return null;
      }
      
      const docRef = doc(this.collectionRef, id.toString());
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const vendor = { id: docSnap.id, ...docSnap.data() };
        return this.normalizeVendorSchema(vendor);
      }
      
      // Use debug level instead of info to reduce console noise
      Logger.debug(LogCategory.VENDORS, `No vendor found with ID: ${id}`);
      return null;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, `Error getting vendor with ID: ${id}`, { error });
      return null;
    }
  }

  /**
   * Calculate distance between two coordinates
   * @param {number} lat1 - Latitude of first point
   * @param {number} lon1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lon2 - Longitude of second point
   * @returns {number} - Distance in miles
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return Infinity;
    }
    
    // Convert to radians
    const toRad = value => value * Math.PI / 180;
    const R = 3958.8; // Earth's radius in miles
    
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return parseFloat(distance.toFixed(2));
  }

  /**
   * Normalize vendor schema to ensure consistent structure
   * @param {Object} vendor - Raw vendor data
   * @returns {Object} - Normalized vendor data
   */
  normalizeVendorSchema(vendor) {
    // Ensure hasQrCode property exists without logging a warning
    if (vendor.hasQrCode === undefined) {
      vendor.hasQrCode = true;
    }
    
    // Create a deep copy to avoid mutating the original
    const normalizedVendor = JSON.parse(JSON.stringify(vendor));
    
    // Fix location structure
    if (normalizedVendor.location) {
      // Ensure coordinates are properly structured
      if (!normalizedVendor.location.coordinates) {
        // If we don't have a coordinates object but have lat/lng on location directly
        if (typeof normalizedVendor.location.latitude === 'number' && 
            typeof normalizedVendor.location.longitude === 'number') {
            
          normalizedVendor.location.coordinates = {
            latitude: normalizedVendor.location.latitude,
            longitude: normalizedVendor.location.longitude
          };
          
          // Clean up original properties
          delete normalizedVendor.location.latitude;
          delete normalizedVendor.location.longitude;
        }
      }
    } else {
      // Create empty location if missing
      normalizedVendor.location = {
        address: 'Address not available',
        coordinates: {
          latitude: 61.2181,  // Default to Anchorage
          longitude: -149.9003
        }
      };
    }
    
    // Ensure contact structure
    if (!normalizedVendor.contact) {
      normalizedVendor.contact = {
        phone: '',
        email: '',
        social: {
          instagram: '',
          facebook: ''
        }
      };
    } else if (!normalizedVendor.contact.social) {
      normalizedVendor.contact.social = {
        instagram: '',
        facebook: ''
      };
    }
    
    // Ensure hours structure
    if (!normalizedVendor.hours) {
      normalizedVendor.hours = {};
    }
    
    // Ensure deals structure
    if (!normalizedVendor.deals) {
      normalizedVendor.deals = {
        daily: {},
        special: [],
        birthday: null
      };
    } else {
      // Make sure daily deals object exists
      if (!normalizedVendor.deals.daily) {
        normalizedVendor.deals.daily = {};
      }
      
      // Make sure special deals array exists
      if (!normalizedVendor.deals.special) {
        normalizedVendor.deals.special = [];
      }
      
      // Make sure birthday deals object exists
      if (!normalizedVendor.deals.birthday) {
        normalizedVendor.deals.birthday = null;
      }
    }
    
    return normalizedVendor;
  }

  /**
   * Get the current user ID from Firebase Auth
   * @returns {string|null} - Current user ID or null if not authenticated
   */
  getCurrentUserId() {
    const currentUser = auth.currentUser;
    return currentUser ? currentUser.uid : null;
  }

  /**
   * Get recent vendors visited by the user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of vendors to return
   * @returns {Promise<Array>} - Array of recent vendors
   */
  async getRecentVendors(userId, limit = 5) {
    // This is a stub method - in a real implementation, you would query
    // the user's check-in history to get their recent vendors
    Logger.info(LogCategory.VENDORS, 'Getting recent vendors (stub)', { userId, limit });
    return [];
  }

  /**
   * Record a user check-in at a vendor
   * @param {string} vendorId - Vendor ID
   * @param {string} userId - User ID
   * @param {Object} options - Check-in options
   * @returns {Promise<Object>} - Check-in result
   */
  async checkIn(vendorId, userId, options = {}) {
    try {
      Logger.info(LogCategory.VENDORS, 'Checking in at vendor', { vendorId, userId, options });
      
      // Get the current timestamp
      const timestamp = new Date();
      
      // Create a check-in record in Firestore
      const checkInsCollection = collection(firestore, 'checkIns');
      const checkInData = {
        vendorId,
        userId,
        timestamp,
        checkInType: options.checkInType || 'manual',
        journeyId: options.journeyId || null,
        dealType: options.dealType || 'standard',
        pointsEarned: options.pointsOverride || 5
      };
      
      // Add the check-in document to Firestore
      await addDoc(checkInsCollection, checkInData);
      
      // Update user's recent visits
      const userVisitsRef = doc(firestore, 'userVisits', userId);
      const userVisitsDoc = await getDoc(userVisitsRef);
      
      if (userVisitsDoc.exists()) {
        // Update existing document
        const visits = userVisitsDoc.data().visits || [];
        const existingVisitIndex = visits.findIndex(v => v.vendorId === vendorId);
        
        if (existingVisitIndex >= 0) {
          // Update existing visit
          visits[existingVisitIndex].lastVisit = timestamp;
          visits[existingVisitIndex].visitCount = (visits[existingVisitIndex].visitCount || 0) + 1;
          // Add or update deal redemption info
          if (!visits[existingVisitIndex].redemptions) {
            visits[existingVisitIndex].redemptions = [];
          }
          visits[existingVisitIndex].redemptions.push({
            dealType: options.dealType || 'standard',
            timestamp,
            checkInType: options.checkInType || 'manual'
          });
        } else {
          // Add new visit
          visits.push({
            vendorId,
            lastVisit: timestamp,
            visitCount: 1,
            redemptions: [{
              dealType: options.dealType || 'standard',
              timestamp,
              checkInType: options.checkInType || 'manual'
            }]
          });
        }
        
        // Sort by most recent
        visits.sort((a, b) => new Date(b.lastVisit) - new Date(a.lastVisit));
        
        // Keep only the most recent visits (limit to 20)
        const recentVisits = visits.slice(0, 20);
        
        // Update the document
        await updateDoc(userVisitsRef, { visits: recentVisits });
      } else {
        // Create new document
        await setDoc(userVisitsRef, {
          visits: [{
            vendorId,
            lastVisit: timestamp,
            visitCount: 1,
            redemptions: [{
              dealType: options.dealType || 'standard',
              timestamp,
              checkInType: options.checkInType || 'manual'
            }]
          }]
        });
      }
      
      // Calculate points earned (customize based on your business logic)
      const pointsEarned = options.pointsOverride || 5; // Default to 5 points per check-in
      
      // Return success with points earned
      return { 
        success: true, 
        pointsEarned,
        timestamp
      };
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error checking in at vendor', { vendorId, userId, error });
      throw error;
    }
  }

  /**
   * Add a vendor to the user's favorites
   * @param {string} vendorId - Vendor ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async addToFavorites(vendorId, userId) {
    // This is a stub method - in a real implementation, you would add
    // the vendor to the user's favorites in Firestore
    Logger.info(LogCategory.VENDORS, 'Adding vendor to favorites (stub)', { vendorId, userId });
    return true;
  }

  /**
   * Remove a vendor from the user's favorites
   * @param {string} vendorId - Vendor ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async removeFromFavorites(vendorId, userId) {
    // This is a stub method - in a real implementation, you would remove
    // the vendor from the user's favorites in Firestore
    Logger.info(LogCategory.VENDORS, 'Removing vendor from favorites (stub)', { vendorId, userId });
    return true;
  }

  /**
   * Get the user's favorite vendors
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of favorite vendors
   */
  async getFavorites(userId) {
    // This is a stub method - in a real implementation, you would query
    // the user's favorites from Firestore
    Logger.info(LogCategory.VENDORS, 'Getting favorite vendors (stub)', { userId });
    return [];
  }
}

// Export as default
export default new SimpleVendorRepository();