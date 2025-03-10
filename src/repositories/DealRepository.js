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
import { isValidDeal, isValidSpecialDeal, DealType, DayOfWeek } from '../types/Schema';
import VendorRepository from './VendorRepository';
import { vendorCacheService } from '../services/VendorCacheService';

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
          break;
        case 'daily':
          deals = await this.getDailyDeals(options.day || this.getCurrentDayOfWeek(), options);
          break;
        case 'special':
          deals = await this.getSpecialDeals(options);
          break;
        default:
          // If no specific type, get deals from all categories
          const birthdayDeals = await this.getBirthdayDeals(options);
          const dailyDeals = await this.getDailyDeals(options.day || this.getCurrentDayOfWeek(), options);
          const specialDeals = await this.getSpecialDeals(options);
          
          deals = [...birthdayDeals, ...dailyDeals, ...specialDeals];
      }
      
      // Apply common post-processing
      const processedDeals = await this.processDeals(deals, options);
      
      Logger.info(LogCategory.DEALS, `Retrieved ${processedDeals.length} deals`);
      return processedDeals;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error getting deals', { error });
      throw error;
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
   * Get daily deals for a specific day
   * @param {string} day - Day of week (lowercase)
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of daily deals
   */
  async getDailyDeals(day, options = {}) {
    try {
      Logger.info(LogCategory.DEALS, 'Getting daily deals', { day, options });
      
      // Validate day parameter
      if (!Object.values(DayOfWeek).includes(day)) {
        throw new Error(`Invalid day: ${day}. Must be one of: ${Object.values(DayOfWeek).join(', ')}`);
      }
      
      // Get vendors from cache
      const vendors = vendorCacheService.getAllVendors({
        userLocation: options.userLocation
      });
      
      // Extract daily deals from vendors
      const dailyDeals = [];
      
      vendors.forEach(vendor => {
        // Skip inactive vendors
        if (vendor.status !== 'Active-Operating') {
          return;
        }

        // Check if vendor has daily deals for this day
        if (vendor.deals?.daily?.[day] && Array.isArray(vendor.deals.daily[day])) {
          vendor.deals.daily[day].forEach((deal, index) => {
            // Skip invalid deals
            if (!deal.description || !deal.discount) {
              return;
            }
            
            dailyDeals.push({
              id: `${vendor.id}-${day}-${index}`,
              title: deal.title || deal.description,
              description: deal.description,
              discount: deal.discount,
              restrictions: deal.restrictions || [],
              redemptionFrequency: deal.redemptionFrequency || 'once_per_day',
              vendorId: vendor.id,
              vendorName: vendor.name,
              vendorAddress: vendor.location?.address || 'Address unavailable',
              vendorCoordinates: vendor.location?.coordinates,
              dealType: 'daily',
              day,
              vendorDistance: vendor.distance || null,
              vendorIsPartner: vendor.isPartner || false,
              isActive: deal.isActive !== false
            });
          });
        }
      });

      // Process deals with common filters
      return this.processDeals(dailyDeals, options);
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error getting daily deals', { error, day });
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
      Logger.info(LogCategory.DEALS, 'Getting birthday deals', { options });
      
      // Get vendors from cache
      const vendors = vendorCacheService.getAllVendors({
        userLocation: options.userLocation
      });
      
      // Extract birthday deals from vendors
      const birthdayDeals = vendors
        .filter(vendor => 
          vendor.status === 'Active-Operating' && 
          vendor.deals && 
          vendor.deals.birthday)
        .map(vendor => ({
          id: `${vendor.id}-birthday`,
          title: vendor.deals.birthday.title || vendor.deals.birthday.description || 'Birthday Special',
          description: vendor.deals.birthday.description,
          discount: vendor.deals.birthday.discount,
          restrictions: vendor.deals.birthday.restrictions || [],
          redemptionFrequency: vendor.deals.birthday.redemptionFrequency || 'once_per_year',
          vendorId: vendor.id,
          vendorName: vendor.name,
          vendorAddress: vendor.location?.address || 'Address unavailable',
          vendorCoordinates: vendor.location?.coordinates,
          dealType: 'birthday',
          vendorDistance: vendor.distance || null,
          vendorIsPartner: vendor.isPartner || false,
          isActive: vendor.deals.birthday.isActive !== false
        }));

      // Process deals with common filters
      return this.processDeals(birthdayDeals, options);
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error getting birthday deals', { error });
      throw error;
    }
  }

  /**
   * Get special deals
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Array of special deals
   */
  async getSpecialDeals(options = {}) {
    try {
      Logger.info(LogCategory.DEALS, 'Getting special deals', { options });
      
      // Get vendors from cache
      const vendors = vendorCacheService.getAllVendors({
        userLocation: options.userLocation
      });
      
      // Extract special deals from vendors
      const now = new Date().toISOString();
      const specialDeals = [];
      
      vendors.forEach(vendor => {
        // Skip inactive vendors
        if (vendor.status !== 'Active-Operating') {
          return;
        }
        
        if (vendor.deals?.special && Array.isArray(vendor.deals.special)) {
          vendor.deals.special.forEach((deal, index) => {
            // Skip invalid deals
            if (!deal.title || !deal.description || !deal.discount) {
              return;
            }
            
            // Skip if not active (if activeOnly is true)
            if (options.activeOnly && 
                ((deal.startDate && deal.startDate > now) || 
                 (deal.endDate && deal.endDate < now))) {
              return;
            }
            
            specialDeals.push({
              id: `${vendor.id}-special-${index}`,
              title: deal.title,
              description: deal.description,
              discount: deal.discount,
              restrictions: deal.restrictions || [],
              startDate: deal.startDate,
              endDate: deal.endDate,
              redemptionFrequency: deal.redemptionFrequency || 'unlimited',
              vendorId: vendor.id,
              vendorName: vendor.name,
              dealType: 'special',
              vendorDistance: vendor.distance || null,
              vendorIsPartner: vendor.isPartner || false,
              isActive: deal.isActive !== false
            });
          });
        }
      });

      // Process deals with common filters
      return this.processDeals(specialDeals, options);
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error getting special deals', { error });
      throw error;
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
      
      // Apply category filter if provided
      if (options.category) {
        processedDeals = processedDeals.filter(deal => 
          deal.category === options.category
        );
      }
      
      // Apply max distance filter
      if (options.maxDistance && typeof options.maxDistance === 'number') {
        processedDeals = processedDeals.filter(deal => 
          !deal.vendorDistance || deal.vendorDistance <= options.maxDistance
        );
      }
      
      // Apply active filter - default to including only active deals
      if (options.activeOnly !== false) {
        processedDeals = processedDeals.filter(deal => 
          deal.isActive !== false
        );
      }
      
      // Sort by partner status, then by closest
      processedDeals.sort((a, b) => {
        // Partners first
        if (a.vendorIsPartner && !b.vendorIsPartner) return -1;
        if (!a.vendorIsPartner && b.vendorIsPartner) return 1;
        
        // Then by distance if available
        if (a.vendorDistance && b.vendorDistance) {
          return a.vendorDistance - b.vendorDistance;
        }
        
        return 0;
      });
      
      // Limit results
      if (options.limit && options.limit > 0) {
        processedDeals = processedDeals.slice(0, options.limit);
      }
      
      return processedDeals;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error processing deals', { error });
      throw error;
    }
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
}

// Export as default
export default new DealRepository();