// src/repositories/VendorRepository.js
import { BaseRepository } from './index';
import { firestore, serverTimestamp } from '../config/firebase';
import { Logger, LogCategory } from '../services/LoggingService';
import { 
  query, 
  collection, 
  where, 
  getDocs, 
  orderBy, 
  limit as firestoreLimit, 
  startAfter,
  getDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  GeoPoint,
  runTransaction,
  setDoc,
  addDoc
} from 'firebase/firestore';
import { isValidVendor } from '../types/Schema';

/**
 * Repository for vendor-related Firestore operations
 */
class VendorRepository extends BaseRepository {
  constructor() {
    super('vendors');
    this.analyticsCollection = collection(firestore, 'vendor_analytics');
  }

  /**
   * Get all vendors with adaptive schema handling
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of vendors
   */
  async getAll(options = {}) {
    try {
      Logger.info(LogCategory.VENDORS, 'Getting all vendors', { options });
      
      // STEP 1: Build initial query - limit fields where possible for performance
      let q = this.collectionRef;
      
      // Add preliminary filters where we know the schema
      if (options.isPartner !== undefined) {
        q = query(q, where('isPartner', '==', options.isPartner));
      }
      
      // Checking status field (based on screenshot showing "Active-Operating")
      if (options.activeRegionsOnly !== false) {
        q = query(q, where('status', '==', 'Active-Operating'));
      }
      
      // STEP 2: Execute query
      const querySnapshot = await getDocs(q);
      let allVendors = [];
      
      // STEP 3: Process each vendor and normalize schema
      querySnapshot.forEach(doc => {
        try {
          const rawVendor = { id: doc.id, ...doc.data() };
          
          // Log the first vendor structure for debugging
          if (allVendors.length === 0) {
            Logger.debug(LogCategory.VENDORS, 'First vendor structure:', {
              id: rawVendor.id,
              hasStatus: !!rawVendor.status,
              status: rawVendor.status,
              hasCoordinates: !!(rawVendor.location && rawVendor.location.coordinates),
              coordinatesStructure: rawVendor.location && rawVendor.location.coordinates ? 
                                  'nested' : 
                                  (rawVendor.location && typeof rawVendor.location.latitude === 'number' ? 
                                  'flat' : 'unknown')
            });
          }
          
          // Normalize vendor to match expected schema
          const normalizedVendor = this.normalizeVendorSchema(rawVendor);
          
          // Add to results
          allVendors.push(normalizedVendor);
        } catch (vendorError) {
          Logger.warn(LogCategory.VENDORS, `Error normalizing vendor ${doc.id}`, { error: vendorError });
        }
      });
      
      // STEP 4: Apply additional filters based on normalized data
      let filteredVendors = [...allVendors];
      
      // Apply region filtering based on address/zip code
      if (options.activeRegionsOnly !== false) {
        // Our screenshot shows no "region" field, but we can use zip code filtering from region.js
        filteredVendors = allVendors.filter(vendor => {
          // Consider active if status is "Active-Operating"
          if (vendor.status === 'Active-Operating') {
            return true;
          }
          
          // Extract zip code from address and check if it's in Anchorage
          if (vendor.location && vendor.location.address) {
            const zipCode = this.extractZipCodeFromAddress(vendor.location.address);
            if (zipCode) {
              // Anchorage zip codes range from 99501 to 99524
              const numericZip = parseInt(zipCode);
              if (numericZip >= 99501 && numericZip <= 99524) {
                return true;
              }
            }
            
            // Check if address contains "Anchorage"
            if (vendor.location.address.includes('Anchorage')) {
              return true;
            }
          }
          
          // Default to include in dev mode
          return __DEV__;
        });
      }
      
      // Apply deal type filters
      if (options.dealType) {
        filteredVendors = filteredVendors.filter(vendor => {
          const deals = vendor.deals || {};
          
          switch (options.dealType) {
            case 'birthday':
              return !!deals.birthday;
            case 'daily':
              if (options.day) {
                return deals.daily && deals.daily[options.day] && 
                       Array.isArray(deals.daily[options.day]) && 
                       deals.daily[options.day].length > 0;
              } else {
                return !!deals.daily && Object.keys(deals.daily).length > 0;
              }
            case 'special':
              return Array.isArray(deals.special) && deals.special.length > 0;
            default:
              return false;
          }
        });
      }
      
      // Add distance calculations
      if (options.userLocation) {
        filteredVendors = filteredVendors.map(vendor => {
          const coords = vendor.location && vendor.location.coordinates;
          if (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
            vendor.distance = this.calculateDistance(
              options.userLocation.latitude,
              options.userLocation.longitude,
              coords.latitude,
              coords.longitude
            );
          }
          return vendor;
        });
        
        // Filter by maximum distance
        if (options.maxDistance) {
          filteredVendors = filteredVendors.filter(vendor => 
            !vendor.distance || vendor.distance <= options.maxDistance
          );
        }
        
        // Sort by distance with partners first
        filteredVendors.sort((a, b) => {
          if (a.isPartner && !b.isPartner) return -1;
          if (!a.isPartner && b.isPartner) return 1;
          return (a.distance || Infinity) - (b.distance || Infinity);
        });
      }
      
      // Apply limit if specified
      if (options.limit && options.limit > 0) {
        filteredVendors = filteredVendors.slice(0, options.limit);
      }
      
      Logger.info(LogCategory.VENDORS, `Found ${filteredVendors.length} vendors out of ${allVendors.length} total`);
      return filteredVendors;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error getting vendors', { error });
      throw error;
    }
  }

  /**
   * Extract zip code from address string (copied from your region.js)
   * @param {string} address - Address string
   * @returns {string|null} - Zip code or null
   */
  extractZipCodeFromAddress(address) {
    if (!address) return null;
    
    // Look for 5-digit zip code with possible 4-digit extension
    const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
    return zipMatch ? zipMatch[1] : null;
  }

  /**
   * Normalize vendor schema to match expected structure
   * @param {Object} rawVendor - Vendor object from Firestore
   * @returns {Object} - Normalized vendor object
   */
  normalizeVendorSchema(rawVendor) {
    // Create a deep copy to avoid mutating the original
    const vendor = JSON.parse(JSON.stringify(rawVendor));
    
    // Normalize timestamps
    const normalized = this.normalizeTimestamps(vendor);
    
    // Fix location structure - note we're handling coordinates properly here
    // According to screenshot, coordinates appear to be nested
    if (normalized.location) {
      // Ensure coordinates are properly structured
      if (!normalized.location.coordinates) {
        // If we don't have a coordinates object but have lat/lng on location directly
        if (typeof normalized.location.latitude === 'number' && 
            typeof normalized.location.longitude === 'number') {
            
          normalized.location.coordinates = {
            latitude: normalized.location.latitude,
            longitude: normalized.location.longitude
          };
          
          // Clean up original properties
          delete normalized.location.latitude;
          delete normalized.location.longitude;
        }
      }
      
      // Ensure address exists
      if (!normalized.location.address && normalized.location.formattedAddress) {
        normalized.location.address = normalized.location.formattedAddress;
      }
    } else {
      // Create empty location if missing
      normalized.location = {
        address: 'Address not available',
        coordinates: {
          latitude: 61.2181,  // Default to Anchorage
          longitude: -149.9003
        }
      };
    }
    
    // Ensure contact structure - contact model matches screenshot
    if (!normalized.contact) {
      normalized.contact = {
        phone: '',
        email: '',
        social: {
          instagram: '',
          facebook: ''
        }
      };
    } else if (!normalized.contact.social) {
      normalized.contact.social = {
        instagram: '',
        facebook: ''
      };
    }
    
    // Ensure hours structure
    if (!normalized.hours) {
      normalized.hours = {};
    }
    
    // Ensure deals structure
    if (!normalized.deals) {
      normalized.deals = {
        daily: {},
        special: []
      };
    } else {
      // Make sure daily deals object exists
      if (!normalized.deals.daily) {
        normalized.deals.daily = {};
      }
      
      // Make sure special deals array exists
      if (!normalized.deals.special) {
        normalized.deals.special = [];
      }
    }
    
    return normalized;
  }

  /**
   * Checks in a user at a vendor location
   * @param {string} vendorId - The vendor ID
   * @param {string} userId - The user ID
   * @param {Object} options - Check-in options
   * @returns {Promise<Object>} - Check-in result
   */
  async checkIn(vendorId, userId, options = {}) {
    try {
      Logger.info(LogCategory.CHECKIN, 'Checking in at vendor', { vendorId, userId, options });
      
      // Reference to the vendor
      const vendorRef = doc(this.collectionRef, vendorId);
      const vendorSnap = await getDoc(vendorRef);
      
      if (!vendorSnap.exists()) {
        throw new Error(`Vendor with ID ${vendorId} not found`);
      }
      
      const vendor = { id: vendorSnap.id, ...vendorSnap.data() };
      
      // Reference to vendor analytics
      const analyticsRef = doc(this.analyticsCollection, vendorId);
      
      // Perform transaction to update multiple collections atomically
      const result = await runTransaction(firestore, async (transaction) => {
        // Get current analytics or create default
        const analyticsSnap = await transaction.get(analyticsRef);
        let analytics = {
          vendorId,
          interactions: {
            checkIns: 0,
            socialPosts: 0,
            routeVisits: 0
          },
          userStats: {
            uniqueVisitors: 0,
            repeatVisitors: 0
          },
          lastUpdated: serverTimestamp()
        };
        
        if (analyticsSnap.exists()) {
          analytics = analyticsSnap.data();
        }
        
        // Determine check-in type
        const checkInType = options.checkInType || 'qr';
        const isRouteVisit = !!options.isJourneyCheckIn;
        
        // Update analytics
        analytics.interactions.checkIns += 1;
        if (isRouteVisit) {
          analytics.interactions.routeVisits += 1;
        }
        
        // Create check-in entry
        const checkIn = {
          userId,
          vendorId,
          timestamp: serverTimestamp(),
          type: checkInType,
          isRouteVisit,
          pointsEarned: options.pointsEarned || 10
        };
        
        // Add to check-ins collection
        const checkInsRef = collection(firestore, 'check_ins');
        const newCheckInRef = doc(checkInsRef);
        transaction.set(newCheckInRef, checkIn);
        
        // Update user's visit history
        if (userId) {
          const userVisitsRef = doc(collection(firestore, 'user_visits'), userId);
          const userVisitsSnap = await transaction.get(userVisitsRef);
          
          if (userVisitsSnap.exists()) {
            // Check if user has visited this vendor before
            const visits = userVisitsSnap.data();
            const vendorVisits = visits.vendors?.find(v => v.vendorId === vendorId);
            
            if (vendorVisits) {
              // Update existing vendor visit count
              transaction.update(userVisitsRef, {
                vendors: visits.vendors.map(v => 
                  v.vendorId === vendorId 
                    ? { 
                        ...v, 
                        visitCount: (v.visitCount || 0) + 1, 
                        lastVisit: serverTimestamp() 
                      } 
                    : v
                )
              });
              
              // This is a repeat visitor
              analytics.userStats.repeatVisitors += 1;
            } else {
              // Add new vendor to visit history
              transaction.update(userVisitsRef, {
                vendors: arrayUnion({
                  vendorId,
                  vendorName: vendor.name,
                  visitCount: 1,
                  lastVisit: serverTimestamp()
                })
              });
              
              // This is a unique visitor
              analytics.userStats.uniqueVisitors += 1;
            }
          } else {
            // Create new user visit record
            transaction.set(userVisitsRef, {
              userId,
              vendors: [{
                vendorId,
                vendorName: vendor.name,
                visitCount: 1,
                lastVisit: serverTimestamp()
              }],
              updatedAt: serverTimestamp()
            });
            
            // This is a unique visitor
            analytics.userStats.uniqueVisitors += 1;
          }
        }
        
        // Update analytics
        analytics.lastUpdated = serverTimestamp();
        transaction.set(analyticsRef, analytics, { merge: true });
        
        // Return result data
        return {
          checkInId: newCheckInRef.id,
          timestamp: new Date().toISOString(),
          vendor: this.normalizeTimestamps(vendor),
          pointsEarned: checkIn.pointsEarned,
          message: 'Check-in successful!'
        };
      });
      
      return result;
    } catch (error) {
      Logger.error(LogCategory.CHECKIN, 'Error checking in at vendor', { error, vendorId, userId });
      throw error;
    }
  }

  /**
   * Get recent vendors the user has visited
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of vendors to return
   * @returns {Promise<Array>} - Array of recently visited vendors
   */
  async getRecentVendors(userId, limit = 5) {
    try {
      if (!userId) {
        Logger.warn(LogCategory.VENDORS, 'getRecentVendors called without userId');
        return [];
      }
      
      Logger.info(LogCategory.VENDORS, 'Getting recent vendors', { userId, limit });
      
      // Get user visit history
      const userVisitsRef = doc(collection(firestore, 'user_visits'), userId);
      const userVisitsSnap = await getDoc(userVisitsRef);
      
      if (!userVisitsSnap.exists()) {
        return [];
      }
      
      const visitHistory = userVisitsSnap.data();
      
      // Sort by last visit date (newest first) and limit
      const recentVendorIds = visitHistory.vendors
        .sort((a, b) => {
          const dateA = a.lastVisit?.toDate?.() || new Date(0);
          const dateB = b.lastVisit?.toDate?.() || new Date(0);
          return dateB - dateA;
        })
        .slice(0, limit)
        .map(v => v.vendorId);
      
      // Get full vendor details for each ID
      const recentVendors = [];
      
      for (const vendorId of recentVendorIds) {
        const vendor = await this.getById(vendorId);
        if (vendor) {
          // Add visit information
          const visitInfo = visitHistory.vendors.find(v => v.vendorId === vendorId);
          recentVendors.push({
            ...vendor,
            lastVisit: visitInfo?.lastVisit.toDate?.().toISOString() || null,
            visitCount: visitInfo?.visitCount || 0
          });
        }
      }
      
      return recentVendors;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error getting recent vendors', { error, userId });
      throw error;
    }
  }

  /**
   * Add a vendor to user's favorites
   * @param {string} vendorId - Vendor ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async addToFavorites(vendorId, userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required to add a vendor to favorites');
      }
      
      // Add to favorites collection
      const userFavoritesRef = doc(collection(firestore, 'user_favorites'), userId);
      
      await updateDoc(userFavoritesRef, {
        vendorIds: arrayUnion(vendorId),
        updatedAt: serverTimestamp()
      }).catch(async (error) => {
        // If document doesn't exist, create it
        if (error.code === 'not-found') {
          await setDoc(userFavoritesRef, {
            userId,
            vendorIds: [vendorId],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          throw error;
        }
      });
      
      Logger.info(LogCategory.VENDORS, 'Added vendor to favorites', { vendorId, userId });
      return true;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error adding vendor to favorites', { error, vendorId, userId });
      throw error;
    }
  }

  /**
   * Remove a vendor from user's favorites
   * @param {string} vendorId - Vendor ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async removeFromFavorites(vendorId, userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required to remove a vendor from favorites');
      }
      
      // Remove from favorites collection
      const userFavoritesRef = doc(collection(firestore, 'user_favorites'), userId);
      
      await updateDoc(userFavoritesRef, {
        vendorIds: arrayRemove(vendorId),
        updatedAt: serverTimestamp()
      });
      
      Logger.info(LogCategory.VENDORS, 'Removed vendor from favorites', { vendorId, userId });
      return true;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error removing vendor from favorites', { error, vendorId, userId });
      throw error;
    }
  }

  /**
   * Get the user's favorite vendors
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of favorite vendors
   */
  async getFavorites(userId) {
    try {
      if (!userId) {
        Logger.warn(LogCategory.VENDORS, 'getFavorites called without userId');
        return [];
      }
      
      // Get favorites list
      const userFavoritesRef = doc(collection(firestore, 'user_favorites'), userId);
      const favoritesSnap = await getDoc(userFavoritesRef);
      
      if (!favoritesSnap.exists()) {
        return [];
      }
      
      const favorites = favoritesSnap.data();
      const vendorIds = favorites.vendorIds || [];
      
      // Get full vendor details for each ID
      const vendorDetails = [];
      
      for (const vendorId of vendorIds) {
        const vendor = await this.getById(vendorId);
        if (vendor) {
          vendorDetails.push(vendor);
        }
      }
      
      Logger.info(LogCategory.VENDORS, 'Retrieved favorite vendors', { userId, count: vendorDetails.length });
      return vendorDetails;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error getting favorite vendors', { error, userId });
      throw error;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param {number} lat1 - Latitude of point 1
   * @param {number} lng1 - Longitude of point 1
   * @param {number} lat2 - Latitude of point 2
   * @param {number} lng2 - Longitude of point 2
   * @returns {number} - Distance in miles
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
      
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c; // Distance in km
    
    return distanceKm * 0.621371; // Convert to miles
  }

  /**
   * Convert degrees to radians
   * @param {number} deg - Degrees
   * @returns {number} - Radians
   */
  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }
}

// Export as default
export default new VendorRepository();