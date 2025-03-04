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
  limit, 
  startAfter,
  getDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  GeoPoint,
  runTransaction
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
   * Get all vendors with optional filtering
   * @param {Object} options - Filter options
   * @param {number} options.maxDistance - Maximum distance in miles
   * @param {string} options.dealType - Type of deal (birthday, daily, special)
   * @param {string} options.day - Day of week for daily deals
   * @param {boolean} options.isPartner - Filter by partner status
   * @param {number} options.limit - Maximum number of results
   * @param {number} options.offset - Offset for pagination
   * @param {string} options.sortBy - Field to sort by
   * @param {string} options.sortDirection - Sort direction (asc or desc)
   * @param {Object} options.userLocation - User's location coordinates
   * @returns {Promise<Array>} - Array of vendors
   */
  async getAll(options = {}) {
    try {
      Logger.info(LogCategory.VENDORS, 'Getting all vendors', { options });
      
      // Build base query
      let q = this.collectionRef;
      
      // Apply isPartner filter if specified
      if (options.isPartner !== undefined) {
        q = query(q, where('isPartner', '==', options.isPartner));
      }
      
      // Apply deal type filters
      if (options.dealType) {
        switch (options.dealType) {
          case 'birthday':
            q = query(q, where('deals.birthday', '!=', null));
            break;
          case 'daily':
            if (options.day) {
              q = query(q, where(`deals.daily.${options.day}`, '!=', null));
            } else {
              q = query(q, where('deals.daily', '!=', null));
            }
            break;
          case 'special':
            q = query(q, where('deals.special', '!=', null));
            break;
        }
      }
      
      // Apply sorting
      if (options.sortBy) {
        const direction = options.sortDirection === 'desc' ? 'desc' : 'asc';
        q = query(q, orderBy(options.sortBy, direction));
      } else {
        // Default sorting: partners first, then by name
        q = query(q, orderBy('isPartner', 'desc'), orderBy('name', 'asc'));
      }
      
      // Apply pagination
      if (options.limit && options.limit > 0) {
        q = query(q, limit(options.limit));
      }
      
      if (options.offset && options.offset > 0 && options.lastVisible) {
        q = query(q, startAfter(options.lastVisible));
      }
      
      // Execute query
      const querySnapshot = await getDocs(q);
      const vendors = [];
      
      // Process results
      querySnapshot.forEach(doc => {
        const vendor = { id: doc.id, ...doc.data() };
        
        // Normalize data (convert Firestore timestamps to ISO strings)
        const normalized = this.normalizeTimestamps(vendor);
        
        // Calculate distance if user location provided
        if (options.userLocation && normalized.location && normalized.location.coordinates) {
          normalized.distance = this.calculateDistance(
            options.userLocation.latitude,
            options.userLocation.longitude,
            normalized.location.coordinates.latitude,
            normalized.location.coordinates.longitude
          );
        }
        
        // Filter by max distance if provided
        if (options.maxDistance && normalized.distance && normalized.distance > options.maxDistance) {
          return; // Skip this vendor if too far
        }
        
        // Validate vendor structure
        if (isValidVendor(normalized)) {
          vendors.push(normalized);
        } else {
          Logger.warn(LogCategory.VENDORS, `Invalid vendor data structure found for ${doc.id}`);
        }
      });
      
      // Post-query sorting by distance if available
      if (options.userLocation) {
        vendors.sort((a, b) => {
          // Partners first
          if (a.isPartner && !b.isPartner) return -1;
          if (!a.isPartner && b.isPartner) return 1;
          
          // Then by distance
          return (a.distance || Infinity) - (b.distance || Infinity);
        });
      }
      
      Logger.info(LogCategory.VENDORS, `Found ${vendors.length} vendors`);
      return vendors;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error getting vendors', { error });
      throw error;
    }
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

export default new VendorRepository();