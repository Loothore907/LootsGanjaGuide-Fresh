// src/repositories/DealRepository.js
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
  Timestamp
} from 'firebase/firestore';
import { isValidDeal, isValidSpecialDeal, isValidMultiDayDeal, DealType, DayOfWeek } from '../types/Schema';
import VendorRepository from './VendorRepository';

/**
 * Repository for deal-related Firestore operations
 */
class DealRepository extends BaseRepository {
  constructor() {
    super('deals');
    this.vendorRepository = VendorRepository;
  }

  /**
   * Get all deals with optional filtering
   * @param {Object} options - Filter options
   * @param {string} options.type - Deal type (birthday, daily, special)
   * @param {string} options.day - Day of week for daily deals
   * @param {string} options.category - Deal category
   * @param {number} options.maxDistance - Maximum distance in miles
   * @param {boolean} options.activeOnly - Show only active deals
   * @param {number} options.limit - Maximum number of results
   * @param {number} options.offset - Offset for pagination
   * @param {Object} options.userLocation - User's current location
   * @returns {Promise<Array>} - Array of deals
   */
  async getAll(options = {}) {
    try {
      Logger.info(LogCategory.DEALS, 'Getting all deals', { options });
      
      // Validate deal type if provided
      if (options.type && !Object.values(DealType).includes(options.type)) {
        throw new Error(`Invalid deal type: ${options.type}`);
      }
      
      // Validate day if provided
      if (options.day && !Object.values(DayOfWeek).includes(options.day)) {
        throw new Error(`Invalid day: ${options.day}`);
      }
      
      // Determine query based on deal type
      let deals = [];
      
      switch (options.type) {
        case 'birthday':
          deals = await this.getBirthdayDeals(options);
          Logger.info(LogCategory.DEALS, `Got ${deals.length} birthday deals`);
          break;
        case 'daily':
          deals = await this.getDailyDeals(options.day || this.getCurrentDayOfWeek(), options);
          Logger.info(LogCategory.DEALS, `Got ${deals.length} daily deals for ${options.day || this.getCurrentDayOfWeek()}`);
          break;
        case 'multi_day':
          deals = await this.getMultiDayDeals(options.day || this.getCurrentDayOfWeek(), options);
          Logger.info(LogCategory.DEALS, `Got ${deals.length} multi-day deals for ${options.day || this.getCurrentDayOfWeek()}`);
          break;
        case 'special':
          deals = await this.getSpecialDeals(options);
          Logger.info(LogCategory.DEALS, `Got ${deals.length} special deals`);
          break;
        case 'everyday':
          deals = await this.getEverydayDeals(options);
          Logger.info(LogCategory.DEALS, `Got ${deals.length} everyday deals`);
          break;
        default:
          // If no specific type, get deals from all categories
          const birthdayDeals = await this.getBirthdayDeals(options);
          const dailyDeals = await this.getDailyDeals(options.day || this.getCurrentDayOfWeek(), options);
          const multiDayDeals = await this.getMultiDayDeals(options.day || this.getCurrentDayOfWeek(), options);
          const specialDeals = await this.getSpecialDeals(options);
          const everydayDeals = await this.getEverydayDeals(options);
          
          deals = [...birthdayDeals, ...dailyDeals, ...multiDayDeals, ...specialDeals, ...everydayDeals];
          
          Logger.info(LogCategory.DEALS, 'Got deals from all categories', {
            birthdayDeals: birthdayDeals.length,
            dailyDeals: dailyDeals.length,
            multiDayDeals: multiDayDeals.length,
            specialDeals: specialDeals.length,
            everydayDeals: everydayDeals.length,
            totalDeals: deals.length
          });
      }
      
      // Apply common post-processing
      const processedDeals = await this.processDeals(deals, options);
      
      return processedDeals;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error getting all deals', { error });
      return [];
    }
  }

  /**
   * Get featured deals
   * @param {number} limit - Maximum number of deals to return
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - Array of featured deals
   */
  async getFeatured(limit = 5, options = {}) {
    try {
      Logger.info(LogCategory.DEALS, 'Getting featured deals', { limit, options });

      // If in development mode, return placeholder deals
      if (__DEV__) {
        return [
          {
            id: 'placeholder-1',
            title: 'Featured Deal Placeholder',
            description: 'Add your featured deals here',
            discount: '20% OFF',
            vendorName: 'Sample Vendor',
            dealType: 'special',
            isPlaceholder: true,
            featured: true,
            featuredPriority: 1,
            imageUrl: null
          }
        ];
      }
      
      // Query the featured_deals collection
      const featuredRef = collection(firestore, 'featured_deals');
      
      // Start with a basic query
      let q = query(featuredRef);
      
      // Add order by priority and creation date
      q = query(q, orderBy('priority', 'desc'), orderBy('createdAt', 'desc'));
      
      // Apply limit
      const limitValue = options.limit || limit;
      if (limitValue && typeof limitValue === 'number') {
        q = query(q, firestoreLimit(limitValue));
      }
      
      const querySnapshot = await getDocs(q);
      let featuredDeals = [];
      
      // Process each featured deal
      for (const docSnapshot of querySnapshot.docs) {
        const featuredData = docSnapshot.data() || {};
        
        try {
          // Get the actual deal info based on reference
          let dealData = null;
          
          if (featuredData.dealType === 'special' && featuredData.dealRef) {
            // Check if dealRef is a valid reference before trying to use it
            if (typeof featuredData.dealRef.get === 'function') {
              const specialDealSnap = await getDoc(featuredData.dealRef);
              
              if (specialDealSnap.exists()) {
                dealData = { id: specialDealSnap.id, ...specialDealSnap.data() };
              }
            }
          } else if (featuredData.vendorRef) {
            // For other deal types, we need to get the vendor and extract the deal
            if (typeof featuredData.vendorRef.get === 'function') {
              const vendorSnap = await getDoc(featuredData.vendorRef);
              
              if (vendorSnap.exists()) {
                const vendor = vendorSnap.data();
                
                if (featuredData.dealType === 'birthday' && 
                    vendor.deals && 
                    vendor.deals.birthday) {
                  dealData = {
                    id: `${vendorSnap.id}-birthday`,
                    title: vendor.deals.birthday.description,
                    description: vendor.deals.birthday.description,
                    discount: vendor.deals.birthday.discount,
                    restrictions: vendor.deals.birthday.restrictions || [],
                    vendorId: vendorSnap.id,
                    vendorName: vendor.name,
                    dealType: 'birthday'
                  };
                } else if (featuredData.dealType === 'daily' && 
                           featuredData.day && 
                           vendor.deals && 
                           vendor.deals.daily && 
                           vendor.deals.daily[featuredData.day]) {
                  const dailyDeal = vendor.deals.daily[featuredData.day][0];
                  
                  if (dailyDeal) {
                    dealData = {
                      id: `${vendorSnap.id}-${featuredData.day}`,
                      title: dailyDeal.description,
                      description: dailyDeal.description,
                      discount: dailyDeal.discount,
                      restrictions: dailyDeal.restrictions || [],
                      vendorId: vendorSnap.id,
                      vendorName: vendor.name,
                      dealType: 'daily',
                      day: featuredData.day
                    };
                  }
                } else if (featuredData.dealType === 'everyday' && 
                           featuredData.dealId) {
                  // For everyday deals, we need to get the deal directly from the deals collection
                  const dealSnap = await getDoc(doc(this.collectionRef, featuredData.dealId));
                  
                  if (dealSnap.exists()) {
                    dealData = { 
                      id: dealSnap.id, 
                      ...dealSnap.data(),
                      vendorName: vendor.name
                    };
                  }
                }
              }
            }
          }
          
          if (dealData) {
            // Add featured metadata
            featuredDeals.push({
              ...this.normalizeTimestamps(dealData),
              featured: true,
              featuredId: docSnapshot.id,
              featuredPriority: featuredData.priority || 0,
              featuredExpiresAt: featuredData.expiresAt ? 
                (featuredData.expiresAt.toDate ? featuredData.expiresAt.toDate().toISOString() : featuredData.expiresAt) : 
                null,
              imageUrl: featuredData.imageUrl || null
            });
          }
        } catch (innerError) {
          Logger.error(LogCategory.DEALS, 'Error processing featured deal', { 
            error: innerError,
            featuredId: docSnapshot.id
          });
        }
      }

      // If no featured deals found, return placeholder in development mode
      if (featuredDeals.length === 0 && __DEV__) {
        return [
          {
            id: 'placeholder-1',
            title: 'Featured Deal Placeholder',
            description: 'Add your featured deals here',
            discount: '20% OFF',
            vendorName: 'Sample Vendor',
            dealType: 'special',
            isPlaceholder: true,
            featured: true,
            featuredPriority: 1,
            imageUrl: null
          }
        ];
      }
      
      return featuredDeals;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error getting featured deals', { error });
      
      // Return placeholder in development mode on error
      if (__DEV__) {
        return [
          {
            id: 'placeholder-1',
            title: 'Featured Deal Placeholder',
            description: 'Add your featured deals here',
            discount: '20% OFF',
            vendorName: 'Sample Vendor',
            dealType: 'special',
            isPlaceholder: true,
            featured: true,
            featuredPriority: 1,
            imageUrl: null
          }
        ];
      }
      
      throw error;
    }
  }

  /**
   * Get birthday deals
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of birthday deals
   */
  async getBirthdayDeals(options = {}) {
    try {
      // Create query for birthday deals
      const birthdayQuery = query(
        this.collectionRef,
        where('dealType', '==', 'birthday'),
        where('isActive', '==', true)
      );
      
      // Execute query
      const querySnapshot = await getDocs(birthdayQuery);
      
      // Process results
      const deals = [];
      querySnapshot.forEach(doc => {
        deals.push({ id: doc.id, ...doc.data() });
      });
      
      Logger.info(LogCategory.DEALS, `Found ${deals.length} birthday deals in Firestore`);
      
      // Process deals with vendor information
      return await this.processBirthdayDeals(deals, options);
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error getting birthday deals', { error });
      return [];
    }
  }
  
  /**
   * Get daily deals for a specific day
   * @param {string} day - Day of week
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of daily deals
   */
  async getDailyDeals(day, options = {}) {
    try {
      // Validate day
      if (!Object.values(DayOfWeek).includes(day)) {
        throw new Error(`Invalid day: ${day}`);
      }
      
      // Create query for daily deals
      const dailyQuery = query(
        this.collectionRef,
        where('dealType', '==', 'daily'),
        where('day', '==', day),
        where('isActive', '==', true)
      );
      
      // Execute query
      const querySnapshot = await getDocs(dailyQuery);
      
      // Process results
      const deals = [];
      querySnapshot.forEach(doc => {
        deals.push({ id: doc.id, ...doc.data() });
      });
      
      Logger.info(LogCategory.DEALS, `Found ${deals.length} daily deals for ${day} in Firestore`);
      
      // Process deals with vendor information
      return await this.processDailyDeals(deals, options);
    } catch (error) {
      Logger.error(LogCategory.DEALS, `Error getting daily deals for ${day}`, { error });
      return [];
    }
  }
  
  /**
   * Get special deals
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of special deals
   */
  async getSpecialDeals(options = {}) {
    try {
      // Create query for special deals
      const specialQuery = query(
        this.collectionRef,
        where('dealType', '==', 'special'),
        where('isActive', '==', true)
      );
      
      // Execute query
      const querySnapshot = await getDocs(specialQuery);
      
      // Process results
      const deals = [];
      querySnapshot.forEach(doc => {
        deals.push({ id: doc.id, ...doc.data() });
      });
      
      Logger.info(LogCategory.DEALS, `Found ${deals.length} special deals in Firestore`);
      
      // Process deals with vendor information
      return await this.processSpecialDeals(deals, options);
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error getting special deals', { error });
      return [];
    }
  }
  
  /**
   * Get everyday deals
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of everyday deals
   */
  async getEverydayDeals(options = {}) {
    try {
      // Create query for everyday deals
      const everydayQuery = query(
        this.collectionRef,
        where('dealType', '==', 'everyday'),
        where('isActive', '==', true)
      );
      
      // Execute query
      const querySnapshot = await getDocs(everydayQuery);
      
      // Process results
      const deals = [];
      querySnapshot.forEach(doc => {
        deals.push({ id: doc.id, ...doc.data() });
      });
      
      Logger.info(LogCategory.DEALS, `Found ${deals.length} everyday deals in Firestore`);
      
      // Process deals with vendor information
      return await this.processDailyDeals(deals, options);
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error getting everyday deals', { error });
      return [];
    }
  }

  /**
   * Get multi-day deals for a specific day
   * @param {string} day - Day of week to filter by
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of multi-day deals
   */
  async getMultiDayDeals(day, options = {}) {
    try {
      // Validate day
      if (!Object.values(DayOfWeek).includes(day)) {
        throw new Error(`Invalid day: ${day}`);
      }
      
      // Create query for multi-day deals
      const multiDayQuery = query(
        this.collectionRef,
        where('dealType', '==', 'multi_day'),
        where('isActive', '==', true)
      );
      
      // Execute query
      const querySnapshot = await getDocs(multiDayQuery);
      
      // Process results
      const deals = [];
      querySnapshot.forEach(doc => {
        const dealData = doc.data();
        
        // Only add valid deals for the current day
        if (isValidMultiDayDeal(dealData) && 
            dealData.activeDays && 
            Array.isArray(dealData.activeDays) && 
            dealData.activeDays.includes(day)) {
          deals.push({ id: doc.id, ...dealData });
        } else if (!isValidMultiDayDeal(dealData)) {
          Logger.warn(LogCategory.DEALS, `Skipping invalid multi-day deal`, { dealId: doc.id });
        }
      });
      
      Logger.info(LogCategory.DEALS, `Found ${deals.length} multi-day deals for ${day} in Firestore`);
      
      // Process deals with vendor information
      return await this.processDailyDeals(deals, options);
    } catch (error) {
      Logger.error(LogCategory.DEALS, `Error getting multi-day deals for ${day}`, { error });
      return [];
    }
  }

  /**
   * Create an optimized route from a list of deals
   * @param {Array<string>} dealIds - Array of deal IDs
   * @param {Object} options - Route options
   * @returns {Promise<Object>} - Route object with vendors and navigation info
   */
  async createRoute(dealIds, options = {}) {
    try {
      Logger.info(LogCategory.NAVIGATION, 'Creating route from deals', { dealIds, options });
      
      // Parse deal IDs to extract vendor IDs
      const vendorIds = new Set();
      
      dealIds.forEach(dealId => {
        // Deal IDs have format: vendorId-dealType-index
        // Extract vendor ID (everything before first hyphen)
        const parts = dealId.split('-');
        if (parts.length >= 1) {
          vendorIds.add(parts[0]);
        }
      });
      
      if (vendorIds.size === 0) {
        throw new Error('No valid vendor IDs could be extracted from deal IDs');
      }
      
      // Get vendor details for each ID
      const vendors = [];
      for (const vendorId of vendorIds) {
        const vendor = await this.vendorRepository.getById(vendorId);
        if (vendor) {
          vendors.push(vendor);
        }
      }
      
      // If no vendors found with requested deal type, go to fallback path for development
      if (vendors.length === 0 && __DEV__ && options.dealType) {
        Logger.warn(LogCategory.NAVIGATION, 'No vendors found with requested deal type, using ANY active vendors');
        
        // Get a few active vendors as fallback
        const fallbackVendors = await this.vendorRepository.getAll({
          activeRegionsOnly: false,
          limit: options.maxVendors || 3,
          ignoreDistance: true
        });
        
        // Create synthetic deals for these vendors
        if (fallbackVendors.length > 0) {
          Logger.info(LogCategory.NAVIGATION, `Created synthetic ${options.dealType} deals for ${fallbackVendors.length} vendors`);
          
          // Use these vendors instead
          const processedVendors = fallbackVendors.map(vendor => {
            // Log vendor location info for debugging
            Logger.info(LogCategory.NAVIGATION, `Vendor ${vendor.id} location`, {
              name: vendor.name,
              coords: vendor.location?.coordinates,
              distance: vendor.distance || this.vendorRepository.calculateDistance(
                options.userLocation?.latitude || 61.2181,
                options.userLocation?.longitude || -149.9003,
                vendor.location?.coordinates?.latitude,
                vendor.location?.coordinates?.longitude
              )
            });
            
            return {
              ...vendor,
              distance: vendor.distance || this.vendorRepository.calculateDistance(
                options.userLocation?.latitude || 61.2181,
                options.userLocation?.longitude || -149.9003,
                vendor.location?.coordinates?.latitude,
                vendor.location?.coordinates?.longitude
              ),
              checkedIn: false
            };
          });
          
          return this.createRouteFromVendors(processedVendors, options);
        }
      }
      
      // Calculate distances and optimize route
      if (options.userLocation) {
        // Calculate distance for each vendor
        const vendorsWithDistance = vendors.map(vendor => {
          const distance = this.vendorRepository.calculateDistance(
            options.userLocation.latitude,
            options.userLocation.longitude,
            vendor.location.coordinates.latitude,
            vendor.location.coordinates.longitude
          );
          
          return {
            ...vendor,
            distance,
            checkedIn: false
          };
        });
        
        return this.createRouteFromVendors(vendorsWithDistance, options);
      } else {
        // If no user location provided, just return the vendors in the original order
        return this.createRouteFromVendors(vendors.map(v => ({...v, checkedIn: false})), options);
      }
    } catch (error) {
      Logger.error(LogCategory.NAVIGATION, 'Error creating route from deals', { error, dealIds });
      throw error;
    }
  }

  /**
   * Helper method to create a route from an array of vendors
   * @param {Array} vendors - Array of vendors with distance information
   * @param {Object} options - Route options
   * @returns {Promise<Object>} - Route object
   */
  async createRouteFromVendors(vendors, options = {}) {
    // Sort vendors by distance
    const sortedVendors = [...vendors].sort((a, b) => 
      (a.distance || Infinity) - (b.distance || Infinity)
    );
    
    // Calculate total distance
    let totalDistance = 0;
    let prevLat = options.userLocation?.latitude || 61.2181; // Default to Anchorage
    let prevLng = options.userLocation?.longitude || -149.9003;
    
    for (const vendor of sortedVendors) {
      const distance = this.vendorRepository.calculateDistance(
        prevLat,
        prevLng,
        vendor.location.coordinates.latitude,
        vendor.location.coordinates.longitude
      );
      
      totalDistance += distance;
      prevLat = vendor.location.coordinates.latitude;
      prevLng = vendor.location.coordinates.longitude;
    }
    
    // Calculate estimated time (rough estimate: 3 minutes per mile plus 15 minutes per stop)
    const estimatedTime = Math.ceil(totalDistance * 3) + (sortedVendors.length * 15);
    
    // Create route object
    const route = {
      success: true,
      vendors: sortedVendors,
      totalDistance: parseFloat(totalDistance.toFixed(2)),
      estimatedTime,
      dealType: options.dealType || 'mixed',
      createdAt: new Date().toISOString()
    };
    
    if (options.userLocation) {
      route.startLocation = options.userLocation;
    }
    
    Logger.info(LogCategory.NAVIGATION, 'Route created successfully', {
      totalDistance: route.totalDistance,
      vendorCount: route.vendors.length
    });
    
    return route;
  }

  /**
   * Process deals with common filtering and sorting
   * @param {Array} deals - Array of deals to process
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} - Processed deals
   */
  async processDeals(deals, options = {}) {
    try {
      let processedDeals = [...deals];
      
      Logger.info(LogCategory.DEALS, `Processing ${processedDeals.length} deals with options`, { 
        options,
        dealTypes: this.countDealsByType(processedDeals)
      });
      
      // Apply category filter if provided
      if (options.category) {
        const beforeCount = processedDeals.length;
        processedDeals = processedDeals.filter(deal => 
          deal.category === options.category
        );
        Logger.info(LogCategory.DEALS, `Category filter removed ${beforeCount - processedDeals.length} deals`);
      }
      
      // Apply max distance filter
      if (options.maxDistance && typeof options.maxDistance === 'number') {
        const beforeCount = processedDeals.length;
        processedDeals = processedDeals.filter(deal => 
          !deal.vendorDistance || deal.vendorDistance <= options.maxDistance
        );
        Logger.info(LogCategory.DEALS, `Distance filter removed ${beforeCount - processedDeals.length} deals`);
      }
      
      // Apply active filter - default to including only active deals
      if (options.activeOnly !== false) {
        const beforeCount = processedDeals.length;
        processedDeals = processedDeals.filter(deal => 
          deal.isActive !== false
        );
        Logger.info(LogCategory.DEALS, `Active filter removed ${beforeCount - processedDeals.length} deals`);
      }
      
      // Sort by partner status, then by closest
      processedDeals.sort((a, b) => {
        // Partners first
        if (a.vendorIsPartner && !b.vendorIsPartner) return -1;
        if (!a.vendorIsPartner && b.vendorIsPartner) return 1;
        
        // Then by distance (if available)
        if (a.vendorDistance && b.vendorDistance) {
          return a.vendorDistance - b.vendorDistance;
        }
        
        return 0;
      });
      
      // Apply limit if provided
      if (options.limit && typeof options.limit === 'number') {
        const beforeCount = processedDeals.length;
        processedDeals = processedDeals.slice(0, options.limit);
        Logger.info(LogCategory.DEALS, `Limit filter reduced from ${beforeCount} to ${processedDeals.length} deals`);
      }
      
      Logger.info(LogCategory.DEALS, `Returning ${processedDeals.length} processed deals`, {
        dealTypes: this.countDealsByType(processedDeals)
      });
      
      return processedDeals;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error processing deals', { error });
      return deals;
    }
  }
  
  /**
   * Count deals by type
   * @param {Array} deals - Array of deals
   * @returns {Object} - Counts by deal type
   */
  countDealsByType(deals) {
    const counts = {
      birthday: 0,
      daily: 0,
      everyday: 0,
      special: 0,
      unknown: 0
    };
    
    deals.forEach(deal => {
      if (deal.dealType && counts[deal.dealType] !== undefined) {
        counts[deal.dealType]++;
      } else {
        counts.unknown++;
      }
    });
    
    return counts;
  }

  /**
   * Get the current day of week (lowercase)
   * @returns {string} - Current day of week
   */
  getCurrentDayOfWeek() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayIndex = new Date().getDay();
    return days[dayIndex];
  }

  /**
   * Enhance deal with vendor information
   * @param {Object} deal - Deal object
   * @returns {Promise<Object>} - Enhanced deal object
   */
  async enhanceDealWithVendorInfo(deal) {
    try {
      // Skip if no vendor ID
      if (!deal.vendorId) {
        return deal;
      }
      
      // Check if this is a mock vendor ID (from the sample data script)
      const mockVendorIds = ["10001", "10002", "10003", "10004", "10005", 
                            "10006", "10007", "10008", "10009", "10010"];
      
      if (mockVendorIds.includes(deal.vendorId.toString())) {
        // For mock vendor IDs, create a placeholder vendor name based on the ID
        return {
          ...deal,
          vendorName: `Sample Vendor ${deal.vendorId}`,
          vendorDistance: 1.0, // Default distance
          vendorLocation: {
            address: "123 Sample St, Anchorage, AK",
            coordinates: {
              latitude: 61.2181,
              longitude: -149.9003
            }
          }
        };
      }
      
      // Get vendor information for real vendor IDs
      const vendor = await this.vendorRepository.getById(deal.vendorId);
      
      // If vendor not found, just return the deal without vendor info
      if (!vendor) {
        // Use debug level instead of info to reduce console noise
        Logger.debug(LogCategory.DEALS, `No vendor found for deal`, { 
          dealId: deal.id, 
          vendorId: deal.vendorId,
          dealType: deal.dealType
        });
        return {
          ...deal,
          vendorName: 'Unknown Vendor',
          vendorDistance: null,
          vendorLocation: null
        };
      }
      
      // Add vendor information to deal
      return {
        ...deal,
        vendorName: vendor.name,
        vendorDistance: vendor.distance || null,
        vendorLocation: vendor.location || null
      };
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error enhancing deal with vendor info', { 
        error, 
        dealId: deal.id,
        vendorId: deal.vendorId
      });
      return deal;
    }
  }

  /**
   * Process birthday deals
   * @param {Array} deals - Raw birthday deals
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} - Processed birthday deals
   */
  async processBirthdayDeals(deals, options = {}) {
    try {
      const processedDeals = [];
      
      for (const deal of deals) {
        try {
          // Skip invalid deals
          if (!isValidDeal(deal)) {
            Logger.warn(LogCategory.DEALS, `Skipping invalid birthday deal`, { dealId: deal.id });
            continue;
          }
          
          // Get vendor information
          const enhancedDeal = await this.enhanceDealWithVendorInfo(deal);
          
          // Add to processed deals
          processedDeals.push(enhancedDeal);
        } catch (dealError) {
          Logger.warn(LogCategory.DEALS, `Error processing birthday deal`, { 
            error: dealError, 
            dealId: deal.id 
          });
        }
      }
      
      return processedDeals;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error processing birthday deals', { error });
      return [];
    }
  }

  /**
   * Process daily deals
   * @param {Array} deals - Raw daily deals
   * @param {Object} options - Processing options
   * @param {string[]} [options.categories] - Array of categories to filter by
   * @returns {Promise<Array>} - Processed daily deals
   */
  async processDailyDeals(deals, options = {}) {
    try {
      const processedDeals = [];
      
      // Log the filtering options
      Logger.info(LogCategory.DEALS, 'Processing daily deals with options', { 
        dealCount: deals.length,
        categories: options.categories,
        maxDistance: options.maxDistance
      });
      
      for (const deal of deals) {
        try {
          // Skip invalid deals
          if (!isValidDeal(deal)) {
            Logger.warn(LogCategory.DEALS, `Skipping invalid daily deal`, { dealId: deal.id });
            continue;
          }
          
          // Get vendor information
          const enhancedDeal = await this.enhanceDealWithVendorInfo(deal);
          
          // Filter by categories if specified
          if (options.categories && options.categories.length > 0) {
            // If deal has no category, assign to 'misc'
            const dealCategory = enhancedDeal.category || 'misc';
            
            // Check if the deal's category is in the selected categories
            // Also include deals marked as 'everyday' if that category is selected
            const categoryMatch = options.categories.includes(dealCategory) || 
                                 (options.categories.includes('everyday') && enhancedDeal.isEveryday);
            
            if (!categoryMatch) {
              // Skip this deal as it doesn't match the category filter
              continue;
            }
          }
          
          // Add to processed deals
          processedDeals.push(enhancedDeal);
        } catch (dealError) {
          Logger.warn(LogCategory.DEALS, `Error processing daily deal`, { 
            error: dealError, 
            dealId: deal.id 
          });
        }
      }
      
      Logger.info(LogCategory.DEALS, `Processed ${processedDeals.length} daily deals after filtering`);
      return processedDeals;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error processing daily deals', { error });
      return [];
    }
  }

  /**
   * Process special deals
   * @param {Array} deals - Raw special deals
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} - Processed special deals
   */
  async processSpecialDeals(deals, options = {}) {
    try {
      const processedDeals = [];
      
      for (const deal of deals) {
        try {
          // Skip invalid deals
          if (!isValidSpecialDeal(deal)) {
            Logger.warn(LogCategory.DEALS, `Skipping invalid special deal`, { dealId: deal.id });
            continue;
          }
          
          // Get vendor information
          const enhancedDeal = await this.enhanceDealWithVendorInfo(deal);
          
          // Add to processed deals
          processedDeals.push(enhancedDeal);
        } catch (dealError) {
          Logger.warn(LogCategory.DEALS, `Error processing special deal`, { 
            error: dealError, 
            dealId: deal.id 
          });
        }
      }
      
      return processedDeals;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error processing special deals', { error });
      return [];
    }
  }
}

// Export as default
export default new DealRepository();