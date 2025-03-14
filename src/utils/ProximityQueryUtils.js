import { firestore } from '../config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  limit,
  startAfter
} from 'firebase/firestore';
import { Logger, LogCategory } from '../services/LoggingService';
import dealCacheService from '../services/DealCacheService';
import vendorCacheService from '../services/VendorCacheService';

/**
 * Find vendors with active deals of a specific type, sorted by proximity to user location
 * @param {Object} userLocation - User's coordinates {latitude, longitude}
 * @param {string} dealType - Type of deal to search for (birthday, daily, special, everyday)
 * @param {number} maxDistance - Maximum distance in miles
 * @param {number} maxResults - Maximum number of results to return
 * @param {Object} lastDoc - Last document from previous pagination (optional)
 * @returns {Promise<Object>} - Object containing sorted vendors with distance information and pagination details
 */
export async function findNearbyVendorsWithDeals(
  userLocation, 
  dealType, 
  maxDistance = 50, 
  maxResults = 20,
  lastDoc = null
) {
  try {
    Logger.info(LogCategory.NAVIGATION, 'Finding nearby vendors with deals', {
      dealType,
      maxDistance,
      maxResults,
      userLocation
    });
    
    // Use DealCacheService and VendorCacheService directly
    
    // Log cache state for debugging
    Logger.debug(LogCategory.NAVIGATION, 'Deal cache state:', {
      isCacheLoaded: dealCacheService.isCacheLoaded(),
      dealCount: dealCacheService._allDeals?.length,
      dealTypeCount: dealCacheService._dealsByType?.[dealType]?.length
    });
    
    // Get deals from cache based on the specified deal type
    const deals = dealCacheService.getAllDeals({ type: dealType });
    
    Logger.debug(LogCategory.NAVIGATION, `Found ${deals.length} ${dealType} deals in cache`, {
      deals: deals.map(d => ({ id: d.id, vendorId: d.vendorId, title: d.title }))
    });
    
    if (deals.length === 0) {
      Logger.warn(LogCategory.NAVIGATION, `No ${dealType} deals found in cache`);
      return { 
        vendors: [],
        lastDoc: null,
        hasMore: false
      };
    }
    
    // Extract unique vendor IDs from deals
    const vendorIds = [...new Set(deals.map(deal => deal.vendorId))];
    
    Logger.debug(LogCategory.NAVIGATION, `Found ${vendorIds.length} unique vendors with ${dealType} deals`, {
      vendorIds,
      vendorIdTypes: vendorIds.map(id => typeof id)
    });
    
    // Debug vendorCacheService methods
    Logger.debug(LogCategory.NAVIGATION, 'Available methods on vendorCacheService:', {
      methods: Object.keys(vendorCacheService).filter(key => typeof vendorCacheService[key] === 'function'),
      isCacheLoaded: vendorCacheService._isCacheLoaded,
      vendorCount: vendorCacheService._allVendors?.length
    });
    
    // Log some vendor IDs from the cache to compare
    if (vendorCacheService._vendorById && vendorCacheService._vendorById.size > 0) {
      const cacheKeys = Array.from(vendorCacheService._vendorById.keys()).slice(0, 5);
      Logger.debug(LogCategory.NAVIGATION, 'Sample vendor IDs in cache:', {
        sampleIds: cacheKeys,
        sampleIdTypes: cacheKeys.map(id => typeof id)
      });
    }
    
    if (vendorIds.length === 0) {
      return { 
        vendors: [],
        lastDoc: null,
        hasMore: false
      };
    }
    
    // Get vendors from cache
    const allVendors = [];
    for (const vendorId of vendorIds) {
      // Try different get methods
      let vendor = null;
      
      // Try with both string and number formats
      const vendorIdAsString = String(vendorId);
      const vendorIdAsNumber = Number(vendorId);
      
      // Method 1: getVendorById
      if (typeof vendorCacheService.getVendorById === 'function') {
        // Try original format first
        vendor = vendorCacheService.getVendorById(vendorId);
        if (!vendor) {
          // Try string format
          vendor = vendorCacheService.getVendorById(vendorIdAsString);
        }
        if (!vendor) {
          // Try number format
          vendor = vendorCacheService.getVendorById(vendorIdAsNumber);
        }
        
        if (vendor) {
          Logger.debug(LogCategory.NAVIGATION, `Found vendor using getVendorById: ${vendorId} (${typeof vendorId})`);
        }
      }
      
      // Method 2: try direct _vendorById access
      if (!vendor && vendorCacheService._vendorById) {
        // Try original format
        vendor = vendorCacheService._vendorById.get(vendorId);
        if (!vendor) {
          // Try string format
          vendor = vendorCacheService._vendorById.get(vendorIdAsString);
        }
        if (!vendor) {
          // Try number format
          vendor = vendorCacheService._vendorById.get(vendorIdAsNumber);
        }
        
        if (vendor) {
          Logger.debug(LogCategory.NAVIGATION, `Found vendor using _vendorById Map: ${vendorId} (${typeof vendorId})`);
        }
      }
      
      // Method 3: search in _allVendors
      if (!vendor && vendorCacheService._allVendors) {
        // Try both formats for comparison
        vendor = vendorCacheService._allVendors.find(v => 
          v.id === vendorId || 
          v.id === vendorIdAsString || 
          v.id === vendorIdAsNumber
        );
        
        if (vendor) {
          Logger.debug(LogCategory.NAVIGATION, `Found vendor by searching _allVendors: ${vendorId} (${typeof vendorId}) matching ${vendor.id} (${typeof vendor.id})`);
        }
      }
      
      if (vendor) {
        allVendors.push(vendor);
      } else {
        Logger.debug(LogCategory.NAVIGATION, `Vendor ${vendorId} not found in cache using any method`);
      }
    }
    
    Logger.debug(LogCategory.NAVIGATION, `Retrieved ${allVendors.length} vendors from cache`);
    
    // Process vendors and calculate distances
    const vendorsWithDistance = [];
    
    allVendors.forEach(vendor => {
      if (!vendor.location?.coordinates) {
        Logger.debug(LogCategory.NAVIGATION, `Vendor ${vendor.id} is missing coordinates`);
        return; // Skip vendors without coordinates
      }
      
      // Calculate distance between user and vendor
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        vendor.location.coordinates.latitude, 
        vendor.location.coordinates.longitude
      );
      
      // Add the deal type to the vendor for redemption service
      vendor.dealType = dealType;
      
      // Only include vendors within maxDistance
      if (distance <= maxDistance) {
        vendorsWithDistance.push({
          ...vendor,
          distance: distance // in miles
        });
      } else {
        Logger.debug(LogCategory.NAVIGATION, `Vendor ${vendor.id} (${vendor.name}) excluded - distance ${distance.toFixed(1)} miles exceeds max ${maxDistance} miles`);
      }
    });
    
    // Sort by distance (closest first)
    vendorsWithDistance.sort((a, b) => a.distance - b.distance);
    
    // Limit to maxResults
    const limitedVendors = vendorsWithDistance.slice(0, maxResults);
    
    Logger.info(LogCategory.NAVIGATION, `Found ${limitedVendors.length} vendors with ${dealType} deals within ${maxDistance} miles`, {
      totalVendors: vendorsWithDistance.length,
      returnedVendors: limitedVendors.length
    });
    
    // Log the actual vendor distances for debugging
    if (limitedVendors.length > 0) {
      Logger.debug(LogCategory.NAVIGATION, 'Vendor distances:', 
        limitedVendors.map(v => ({ 
          id: v.id, 
          name: v.name, 
          distance: v.distance.toFixed(1) + ' miles',
          hasCoordinates: !!v.location?.coordinates
        }))
      );
    }
    
    return {
      vendors: limitedVendors,
      lastDoc: null, // No pagination when using cache
      hasMore: false
    };
    
  } catch (error) {
    Logger.error(LogCategory.NAVIGATION, `Error finding nearby vendors with ${dealType} deals:`, { error });
    throw error;
  }
}

/**
 * Calculate distance between two points using the Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} - Distance in miles
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  // Convert to miles instead of kilometers
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in miles
  
  return distance;
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} - Angle in radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
} 