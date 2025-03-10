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
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { isValidVendor } from '../types/Schema';
import vendorCacheService from '../services/VendorCacheService';

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
   * Using cached vendors for improved performance
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of vendors
   */
  async getAll(options = {}) {
    try {
      Logger.info(LogCategory.VENDORS, 'Getting all vendors', { options });
      
      // Use cache for vendor loading if enabled
      if (!options.skipCache && vendorCacheService.isCacheLoaded()) {
        // Apply filters in memory using our cache service
        return vendorCacheService.getAllVendors(options);
      }
      
      // If cache is not available, get all collections to query
      const collectionsToQuery = [this.collectionRef]; // Always include main vendors collection
      
      // Include priority vendors if explicitly requested or if we need to search in all collections
      if (options.includePriorityRegions || options.includeAllRegions) {
        collectionsToQuery.push(this.priorityVendorsCollection);
      }
      
      // Include other vendors if explicitly requested or if we need to search in all collections
      if (options.includeUnknownRegions || options.includeAllRegions) {
        collectionsToQuery.push(this.otherVendorsCollection);
      }
      
      // Store all vendors here
      let allVendors = [];
      
      // Query each collection and merge results
      for (const collectionRef of collectionsToQuery) {
        try {
          const querySnapshot = await getDocs(collectionRef);
          
          // Process each vendor and normalize schema
          querySnapshot.forEach(doc => {
            try {
              const rawVendor = { id: doc.id, ...doc.data() };
              
              // Normalize vendor to match expected schema
              const normalizedVendor = this.normalizeVendorSchema(rawVendor);
              
              // Add to results
              allVendors.push(normalizedVendor);
            } catch (vendorError) {
              Logger.warn(LogCategory.VENDORS, `Error normalizing vendor ${doc.id}`, { error: vendorError });
            }
          });
        } catch (queryError) {
          Logger.error(LogCategory.VENDORS, 'Error querying collection', { error: queryError });
          // Continue with other collections
        }
      }
      
      // Apply filters based on normalized data
      let filteredVendors = [...allVendors];
      
      // Apply region filters if specified
      if (options.regionId) {
        filteredVendors = filteredVendors.filter(vendor => 
          vendor.regionInfo && vendor.regionInfo.regionId === options.regionId
        );
      }
      
      // Filter by region status
      if (options.onlyActiveRegions === true) {
        filteredVendors = filteredVendors.filter(vendor => 
          vendor.regionInfo && vendor.regionInfo.inActiveRegion
        );
      }
      
      if (options.onlyPriorityRegions === true) {
        filteredVendors = filteredVendors.filter(vendor => 
          vendor.regionInfo && vendor.regionInfo.inPriorityRegion
        );
      }
      
      // Add distance calculations
      if (options.userLocation && !options.ignoreDistance) {
        filteredVendors = filteredVendors.map(vendor => {
          const coords = vendor.location && vendor.location.coordinates;
          if (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
            vendor.distance = this.calculateDistance(
              options.userLocation.latitude,
              options.userLocation.longitude,
              coords.latitude,
              coords.longitude
            );
          } else {
            vendor.distance = Infinity;
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
      
      // Apply limit to final results if specified
      if (options.limit && options.limit > 0 && !options.skipFinalLimit) {
        filteredVendors = filteredVendors.slice(0, options.limit);
      }
      
      // Return empty array if no vendors found
      if (!filteredVendors || filteredVendors.length === 0) {
        Logger.warn(LogCategory.VENDORS, 'No vendors found matching criteria');
        return [];
      }
      
      Logger.info(LogCategory.VENDORS, `Found ${filteredVendors.length} vendors out of ${allVendors.length} total`);
      return filteredVendors;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error getting vendors', { error });
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Get a vendor by ID with support for multiple collections
   * Using cached vendors for improved performance
   * @param {string} id - Vendor ID
   * @returns {Promise<Object|null>} - Vendor document or null if not found
   */
  async getById(id) {
    try {
      if (!id) {
        Logger.warn(LogCategory.VENDORS, 'getById called with no ID');
        return null;
      }
      
      // First try to get from cache for improved performance
      if (vendorCacheService.isCacheLoaded()) {
        const cachedVendor = vendorCacheService.getVendorById(id);
        if (cachedVendor) {
          return cachedVendor;
        }
        // If not in cache but cache is loaded, it likely doesn't exist
        Logger.warn(LogCategory.VENDORS, `Vendor with ID ${id} not found in cache, trying database`);
      }

      // If not found in cache or cache is not loaded, try the database
      let vendorId = id;
      if (typeof id === 'string' && /^\d+$/.test(id)) {
        vendorId = parseInt(id, 10);
      }
      
      // First try the main vendors collection
      const docRef = doc(this.collectionRef, vendorId.toString());
      let docSnap = await getDoc(docRef);
      
      // If not found, try priority vendors collection
      if (!docSnap.exists()) {
        const priorityDocRef = doc(this.priorityVendorsCollection, vendorId.toString());
        docSnap = await getDoc(priorityDocRef);
      }
      
      // If still not found, try other vendors collection
      if (!docSnap.exists()) {
        const otherDocRef = doc(this.otherVendorsCollection, vendorId.toString());
        docSnap = await getDoc(otherDocRef);
      }
      
      if (docSnap.exists()) {
        const vendor = { id: vendorId.toString(), ...docSnap.data() };
        return this.normalizeVendorSchema(this.normalizeTimestamps(vendor));
      }
      
      Logger.info(LogCategory.VENDORS, `No vendor found with ID: ${vendorId} in any collection`);
      return null;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, `Error getting vendor with ID: ${id}`, { error });
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
      
      // Ensure zipCode is preserved if it exists
      if (!normalized.location.zipCode && normalized.location.address) {
        // Try to extract from address if not present
        normalized.location.zipCode = this.extractZipCodeFromAddress(normalized.location.address);
      }
    } else {
      // Create empty location if missing
      normalized.location = {
        address: 'Address not available',
        zipCode: null,
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
    
    // Ensure regionInfo structure
    if (!normalized.regionInfo) {
      normalized.regionInfo = {
        inActiveRegion: false,
        inPriorityRegion: false,
        regionId: null,
        zipCode: this.extractZipCodeFromAddress(normalized?.location?.address)
      };
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

  /**
   * Get active regions from the regions collection
   * @returns {Promise<Array>} - Array of active region objects
   */
  async getActiveRegions() {
    try {
      Logger.info(LogCategory.REGIONS, 'Getting active regions');
      
      const q = query(this.regionsCollection, where('isActive', '==', true));
      const querySnapshot = await getDocs(q);
      
      const activeRegions = [];
      querySnapshot.forEach(doc => {
        activeRegions.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      Logger.info(LogCategory.REGIONS, `Found ${activeRegions.length} active regions`);
      return activeRegions;
    } catch (error) {
      Logger.error(LogCategory.REGIONS, 'Error getting active regions', { error });
      throw error;
    }
  }

  /**
   * Get priority regions from the regions collection
   * @returns {Promise<Array>} - Array of priority region objects
   */
  async getPriorityRegions() {
    try {
      Logger.info(LogCategory.REGIONS, 'Getting priority regions');
      
      const q = query(this.regionsCollection, where('isPriority', '==', true));
      const querySnapshot = await getDocs(q);
      
      const priorityRegions = [];
      querySnapshot.forEach(doc => {
        priorityRegions.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      Logger.info(LogCategory.REGIONS, `Found ${priorityRegions.length} priority regions`);
      return priorityRegions;
    } catch (error) {
      Logger.error(LogCategory.REGIONS, 'Error getting priority regions', { error });
      throw error;
    }
  }

  /**
   * Determine which collection a vendor belongs to based on its region
   * @param {Object} vendor - Vendor object with location data
   * @param {Array} activeRegions - List of active regions
   * @param {Array} priorityRegions - List of priority regions
   * @returns {string} - Collection name: 'vendors', 'priority_vendors', or 'other_vendors'
   */
  determineVendorCollection(vendor, activeRegions, priorityRegions) {
    // Extract zipcode from vendor address
    const zipCode = this.extractZipCodeFromAddress(vendor?.location?.address);
    if (!zipCode) {
      Logger.debug(LogCategory.VENDORS, `No zip code found for vendor ${vendor.id}, routing to other_vendors`);
      return 'other_vendors';
    }
    
    // Check if vendor is in an active region
    const inActiveRegion = activeRegions.some(region => 
      region.zipCodes && region.zipCodes.includes(zipCode)
    );
    
    if (inActiveRegion) {
      return 'vendors';
    }
    
    // Check if vendor is in a priority region (but not active)
    const inPriorityRegion = priorityRegions.some(region => 
      region.zipCodes && region.zipCodes.includes(zipCode)
    );
    
    if (inPriorityRegion) {
      return 'priority_vendors';
    }
    
    // Default to other_vendors
    return 'other_vendors';
  }

  /**
   * Enhance vendor with region information
   * @param {Object} vendor - Vendor object
   * @param {Array} activeRegions - List of active regions
   * @param {Array} priorityRegions - List of priority regions
   * @returns {Object} - Vendor with regionInfo added
   */
  addRegionInfoToVendor(vendor, activeRegions, priorityRegions) {
    // Create a copy to avoid mutation
    const enhancedVendor = { ...vendor };
    
    // Extract zipcode from vendor address
    const zipCode = this.extractZipCodeFromAddress(vendor?.location?.address);
    
    // Initialize regionInfo
    enhancedVendor.regionInfo = {
      inActiveRegion: false,
      inPriorityRegion: false,
      regionId: null,
      zipCode
    };
    
    if (!zipCode) {
      return enhancedVendor;
    }
    
    // Check if vendor is in an active region
    const activeRegion = activeRegions.find(region => 
      region.zipCodes && region.zipCodes.includes(zipCode)
    );
    
    if (activeRegion) {
      enhancedVendor.regionInfo.inActiveRegion = true;
      enhancedVendor.regionInfo.inPriorityRegion = true; // Active regions are also priority
      enhancedVendor.regionInfo.regionId = activeRegion.id;
      enhancedVendor.regionInfo.regionName = activeRegion.name;
      return enhancedVendor;
    }
    
    // Check if vendor is in a priority region
    const priorityRegion = priorityRegions.find(region => 
      region.zipCodes && region.zipCodes.includes(zipCode)
    );
    
    if (priorityRegion) {
      enhancedVendor.regionInfo.inPriorityRegion = true;
      enhancedVendor.regionInfo.regionId = priorityRegion.id;
      enhancedVendor.regionInfo.regionName = priorityRegion.name;
    }
    
    return enhancedVendor;
  }

  /**
   * Distribute a vendor to the appropriate collection based on region
   * @param {Object} vendor - Vendor object with complete data
   * @returns {Promise<Object>} - Result of the operation with updated vendor
   */
  async distributeVendorToCollection(vendor) {
    try {
      // Get active and priority regions
      const [activeRegions, priorityRegions] = await Promise.all([
        this.getActiveRegions(),
        this.getPriorityRegions()
      ]);
      
      // Add region info to vendor
      const enhancedVendor = this.addRegionInfoToVendor(vendor, activeRegions, priorityRegions);
      
      // Determine which collection this vendor belongs to
      const collectionName = this.determineVendorCollection(vendor, activeRegions, priorityRegions);
      
      // Choose the appropriate collection reference
      let collectionRef;
      switch (collectionName) {
        case 'vendors':
          collectionRef = this.collectionRef;
          break;
        case 'priority_vendors':
          collectionRef = this.priorityVendorsCollection;
          break;
        default:
          collectionRef = this.otherVendorsCollection;
      }
      
      // Store the vendor in the appropriate collection
      const docRef = doc(collectionRef, enhancedVendor.id.toString());
      await setDoc(docRef, enhancedVendor, { merge: true });
      
      Logger.info(LogCategory.VENDORS, `Distributed vendor ${enhancedVendor.id} to ${collectionName}`, { 
        regionInfo: enhancedVendor.regionInfo 
      });
      
      return {
        success: true,
        vendor: enhancedVendor,
        collectionName
      };
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error distributing vendor to collection', { 
        error, 
        vendorId: vendor.id 
      });
      throw error;
    }
  }

  /**
   * Move a vendor between collections based on region status changes
   * @param {string} vendorId - ID of the vendor to move
   * @returns {Promise<Object>} - Result of the operation
   */
  async relocateVendorBasedOnRegion(vendorId) {
    try {
      // Get the vendor from all possible collections
      const vendor = await this.getById(vendorId);
      
      if (!vendor) {
        throw new Error(`Vendor with ID ${vendorId} not found in any collection`);
      }
      
      // First remove from all collections to avoid duplication
      await Promise.all([
        deleteDoc(doc(this.collectionRef, vendorId.toString())).catch(() => {}),
        deleteDoc(doc(this.priorityVendorsCollection, vendorId.toString())).catch(() => {}),
        deleteDoc(doc(this.otherVendorsCollection, vendorId.toString())).catch(() => {})
      ]);
      
      // Redistribute to the appropriate collection
      const result = await this.distributeVendorToCollection(vendor);
      
      return result;
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error relocating vendor', { error, vendorId });
      throw error;
    }
  }

  /**
   * Scan all vendors and redistribute them to appropriate collections
   * Use this when region definitions change
   * @returns {Promise<Object>} - Summary of redistribution
   */
  async redistributeAllVendors() {
    try {
      Logger.info(LogCategory.VENDORS, 'Starting vendor redistribution');
      
      // Get active and priority regions
      const [activeRegions, priorityRegions] = await Promise.all([
        this.getActiveRegions(),
        this.getPriorityRegions()
      ]);
      
      // Log region information
      Logger.info(LogCategory.REGIONS, 'Region distribution', {
        activeRegionsCount: activeRegions.length,
        priorityRegionsCount: priorityRegions.length
      });
      
      // Query all collections to get all vendors
      const collections = [
        this.collectionRef,
        this.priorityVendorsCollection,
        this.otherVendorsCollection
      ];
      
      const stats = {
        total: 0,
        movedToActive: 0,
        movedToPriority: 0,
        movedToOther: 0,
        errors: 0
      };
      
      // Process each collection
      for (const collectionRef of collections) {
        const snapshot = await getDocs(collectionRef);
        
        // Process vendors in batches to avoid overwhelming Firestore
        const batchSize = 100;
        const batches = [];
        let currentBatch = [];
        
        snapshot.forEach(doc => {
          const vendor = { id: doc.id, ...doc.data() };
          currentBatch.push(vendor);
          
          if (currentBatch.length >= batchSize) {
            batches.push([...currentBatch]);
            currentBatch = [];
          }
        });
        
        // Add the remaining vendors
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }
        
        // Process each batch
        for (const batch of batches) {
          const batchPromises = batch.map(async (vendor) => {
            try {
              stats.total++;
              
              // Add region info to vendor
              const enhancedVendor = this.addRegionInfoToVendor(vendor, activeRegions, priorityRegions);
              
              // Determine which collection this vendor belongs to
              const collectionName = this.determineVendorCollection(enhancedVendor, activeRegions, priorityRegions);
              
              // Choose the appropriate collection reference
              let targetCollectionRef;
              switch (collectionName) {
                case 'vendors':
                  targetCollectionRef = this.collectionRef;
                  stats.movedToActive++;
                  break;
                case 'priority_vendors':
                  targetCollectionRef = this.priorityVendorsCollection;
                  stats.movedToPriority++;
                  break;
                default:
                  targetCollectionRef = this.otherVendorsCollection;
                  stats.movedToOther++;
              }
              
              // Remove from current collection if it's not the target collection
              if (collectionRef !== targetCollectionRef) {
                await deleteDoc(doc(collectionRef, vendor.id.toString())).catch(() => {});
              }
              
              // Store the vendor in the appropriate collection
              const docRef = doc(targetCollectionRef, enhancedVendor.id.toString());
              await setDoc(docRef, enhancedVendor, { merge: true });
            } catch (error) {
              stats.errors++;
              Logger.error(LogCategory.VENDORS, 'Error redistributing vendor', { 
                error, 
                vendorId: vendor.id 
              });
            }
          });
          
          // Wait for all vendors in this batch to be processed
          await Promise.all(batchPromises);
        }
      }
      
      Logger.info(LogCategory.VENDORS, 'Vendor redistribution complete', { stats });
      
      return {
        success: true,
        stats
      };
    } catch (error) {
      Logger.error(LogCategory.VENDORS, 'Error redistributing vendors', { error });
      throw error;
    }
  }
}

// Export as default
export default new VendorRepository();