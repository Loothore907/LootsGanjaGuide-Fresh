// src/services/MockDataService.js
import { Logger, LogCategory } from './LoggingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Mock vendor data
 */
const MOCK_VENDORS = [
  {
    id: 'v1',
    name: 'Green Horizon',
    location: {
      address: '123 Pine St, Anchorage, AK 99501',
      coordinates: {
        latitude: 61.2175,
        longitude: -149.8584
      }
    },
    contact: {
      phone: '907-555-0101',
      email: 'info@greenhorizon.com',
      social: {
        instagram: 'greenhorizon_ak',
        facebook: 'greenhorizonak'
      }
    },
    hours: {
      monday: { open: '10:00', close: '22:00' },
      tuesday: { open: '10:00', close: '22:00' },
      wednesday: { open: '10:00', close: '22:00' },
      thursday: { open: '10:00', close: '22:00' },
      friday: { open: '10:00', close: '23:00' },
      saturday: { open: '10:00', close: '23:00' },
      sunday: { open: '12:00', close: '20:00' }
    },
    deals: {
      birthday: {
        description: '25% off entire purchase',
        discount: '25% OFF',
        restrictions: ['ID required', 'Must be within birthday month', 'Cannot combine with other offers']
      },
      daily: {
        monday: [{
          description: 'Munchie Monday - 20% off all edibles',
          discount: '20% OFF',
          restrictions: ['In-store only', 'While supplies last']
        }],
        tuesday: [{
          description: 'Tincture Tuesday - Buy one get one 50% off tinctures',
          discount: 'BOGO 50%',
          restrictions: ['Equal or lesser value', 'While supplies last']
        }],
        wednesday: [{
          description: 'Wax Wednesday - 15% off all concentrates',
          discount: '15% OFF',
          restrictions: ['Excludes cartridges', 'In-store only']
        }],
        thursday: [{
          description: 'Thrifty Thursday - $5 off purchases over $50',
          discount: '$5 OFF $50+',
          restrictions: ['Cannot combine with other offers']
        }],
        friday: [{
          description: 'Flower Friday - 10% off all flower',
          discount: '10% OFF',
          restrictions: ['Excludes pre-rolls', 'In-store only']
        }],
        saturday: [{
          description: 'Shatterday - 20% off all shatter',
          discount: '20% OFF',
          restrictions: ['While supplies last']
        }],
        sunday: [{
          description: 'Sunday Funday - 10% off entire purchase',
          discount: '10% OFF',
          restrictions: ['In-store only', 'Cannot combine with other offers']
        }],
        wednesday: [{
          description: 'Wax Wednesday - 20% off all concentrates',
          discount: '20% OFF',
          restrictions: ['Excludes cartridges', 'In-store only']
        }],
        thursday: [{
          description: 'Pre-roll Thursday - $2 off all pre-rolls',
          discount: '$2 OFF',
          restrictions: ['Limit 5 per customer']
        }],
        friday: [{
          description: 'Friday Funday - 10% off entire purchase',
          discount: '10% OFF',
          restrictions: ['Cannot combine with other offers']
        }],
        saturday: [{
          description: 'Shatterday - Buy 2g get 1g free on shatter',
          discount: 'BUY 2 GET 1',
          restrictions: ['While supplies last']
        }],
        sunday: [{
          description: 'Lazy Sunday - 15% off indica strains',
          discount: '15% OFF',
          restrictions: ['In-store only']
        }]
      },
      special: [
        {
          title: 'Fall Harvest Festival',
          description: 'Celebrating the harvest season with special deals',
          discount: 'Up to 25% OFF',
          startDate: '2023-09-15T00:00:00Z',
          endDate: '2023-09-30T23:59:59Z',
          restrictions: ['In-store only', 'While supplies last']
        }
      ]
    },
    isPartner: true,
    rating: 4.5,
    lastUpdated: '2023-01-22T10:30:00Z',
    logoUrl: 'https://example.com/logos/denali.png',
    bannerUrl: 'https://example.com/banners/denali.png',
    distance: 1.8
  },
  {
    id: 'v5',
    name: 'Arctic Buds',
    location: {
      address: '222 Frost St, Anchorage, AK 99518',
      coordinates: {
        latitude: 61.1878,
        longitude: -149.9123
      }
    },
    contact: {
      phone: '907-555-0505',
      email: 'info@arcticbuds.com',
      social: {
        instagram: 'arctic_buds',
        facebook: 'arcticbudsak'
      }
    },
    hours: {
      monday: { open: '10:00', close: '20:00' },
      tuesday: { open: '10:00', close: '20:00' },
      wednesday: { open: '10:00', close: '20:00' },
      thursday: { open: '10:00', close: '20:00' },
      friday: { open: '10:00', close: '22:00' },
      saturday: { open: '10:00', close: '22:00' },
      sunday: { open: '12:00', close: '18:00' }
    },
    deals: {
      birthday: {
        description: '20% off entire purchase',
        discount: '20% OFF',
        restrictions: ['ID required', 'Must be within birthday month', 'Cannot combine with other offers']
      },
      daily: {
        monday: [{
          description: 'Mellow Monday - 10% off entire purchase',
          discount: '10% OFF',
          restrictions: ['In-store only']
        }],
        tuesday: [{
          description: 'Terpene Tuesday - Featured strain of the day 15% off',
          discount: '15% OFF',
          restrictions: ['Featured strain only', 'While supplies last']
        }],
        wednesday: [{
          description: 'Waxy Wednesday - 20% off all extracts',
          discount: '20% OFF',
          restrictions: ['In-store only']
        }],
        thursday: [{
          description: 'Thrifty Thursday - $5 grams of select strains',
          discount: '$5 GRAMS',
          restrictions: ['Select strains only', 'Limit 3 per customer']
        }],
        friday: [{
          description: 'TGIF - 15% off purchases after 6pm',
          discount: '15% OFF',
          restrictions: ['After 6PM only', 'In-store only']
        }],
        saturday: [{
          description: 'Social Saturday - 10% off when you check in on social media',
          discount: '10% OFF',
          restrictions: ['Must show check-in to cashier']
        }],
        sunday: [{
          description: 'Sunday Special - Buy 2 edibles get 1 free',
          discount: 'BUY 2 GET 1',
          restrictions: ['Equal or lesser value', 'While supplies last']
        }]
      },
      special: [
        {
          title: 'Northern Lights Festival',
          description: 'Celebrating the aurora with special deals',
          discount: 'Up to 30% OFF',
          startDate: '2023-11-01T00:00:00Z',
          endDate: '2023-11-07T23:59:59Z',
          restrictions: ['In-store only', 'While supplies last']
        }
      ]
    },
    isPartner: false,
    rating: 4.3,
    lastUpdated: '2023-01-23T14:15:00Z',
    logoUrl: 'https://example.com/logos/arcticbuds.png',
    bannerUrl: 'https://example.com/banners/arcticbuds.png',
    distance: 4.1
  },
  {
    id: 'v2',
    name: 'Aurora Dispensary',
    location: {
      address: '456 Spruce Ave, Anchorage, AK 99503',
      coordinates: {
        latitude: 61.2108,
        longitude: -149.8767
      }
    },
    contact: {
      phone: '907-555-0202',
      email: 'hello@auroradispensary.com',
      social: {
        instagram: 'aurora_dispensary',
        facebook: 'auroradispensaryak'
      }
    },
    hours: {
      monday: { open: '09:00', close: '21:00' },
      tuesday: { open: '09:00', close: '21:00' },
      wednesday: { open: '09:00', close: '21:00' },
      thursday: { open: '09:00', close: '21:00' },
      friday: { open: '09:00', close: '22:00' },
      saturday: { open: '09:00', close: '22:00' },
      sunday: { open: '11:00', close: '19:00' }
    },
    deals: {
      birthday: {
        description: 'Free pre-roll with purchase',
        discount: 'FREE PRE-ROLL',
        restrictions: ['ID required', 'Must be within birthday month', 'One per customer']
      },
      daily: {
        monday: [{
          description: 'Monday Motivation - 15% off sativa strains',
          discount: '15% OFF',
          restrictions: ['In-store only']
        }],
        tuesday: [{
          description: 'Topical Tuesday - 20% off all topicals',
          discount: '20% OFF',
          restrictions: ['While supplies last']
        }],
        wednesday: [{
          description: 'Wild Card Wednesday - Random deal revealed in-store',
          discount: 'SURPRISE',
          restrictions: ['In-store only', 'Deal changes weekly']
        }],
        thursday: [{
          description: 'Thirsty Thursday - 15% off all drinks',
          discount: '15% OFF',
          restrictions: ['Cannot combine with other offers']
        }],
        friday: [{
          description: 'Cartridge Friday - $5 off all cartridges',
          discount: '$5 OFF',
          restrictions: ['While supplies last']
        }],
        saturday: [{
          description: 'Early Bird Saturday - 10% off before noon',
          discount: '10% OFF',
          restrictions: ['Before 12PM only']
        }],
        sunday: [{
          description: 'Sunday Savings - $10 eighth of select strains',
          discount: '$10 EIGHTH',
          restrictions: ['Select strains only', 'While supplies last']
        }]
      },
      special: [
        {
          title: 'Customer Appreciation Week',
          description: 'Special deals all week for our loyal customers',
          discount: 'VARIES',
          startDate: '2023-03-01T00:00:00Z',
          endDate: '2023-03-07T23:59:59Z',
          restrictions: ['Check daily for new deals']
        }
      ]
    },
    isPartner: false,
    rating: 4.2,
    lastUpdated: '2023-01-20T16:45:00Z',
    logoUrl: 'https://example.com/logos/aurora.png',
    bannerUrl: 'https://example.com/banners/aurora.png',
    distance: 2.3
  },
  {
    id: 'v3',
    name: 'Northern Lights Cannabis',
    location: {
      address: '789 Glacier Rd, Anchorage, AK 99508',
      coordinates: {
        latitude: 61.1994,
        longitude: -149.8421
      }
    },
    contact: {
      phone: '907-555-0303',
      email: 'info@northernlightscannabis.com',
      social: {
        instagram: 'northernlights_cannabis',
        facebook: 'northernlightscannabisak'
      }
    },
    hours: {
      monday: { open: '08:00', close: '22:00' },
      tuesday: { open: '08:00', close: '22:00' },
      wednesday: { open: '08:00', close: '22:00' },
      thursday: { open: '08:00', close: '22:00' },
      friday: { open: '08:00', close: '00:00' },
      saturday: { open: '08:00', close: '00:00' },
      sunday: { open: '10:00', close: '20:00' }
    },
    deals: {
      birthday: {
        description: '30% off one item of choice',
        discount: '30% OFF',
        restrictions: ['ID required', 'Must be within birthday week', 'Excludes already discounted items']
      },
      daily: {
        monday: [{
          description: 'Monday Blues - 15% off indica strains',
          discount: '15% OFF',
          restrictions: ['In-store only']
        }],
        tuesday: [{
          description: '2-for-Tuesday - Buy one get one free on select edibles',
          discount: 'BOGO FREE',
          restrictions: ['Select items only', 'While supplies last']
        }],
        wednesday: [{
          description: 'Wellness Wednesday - 20% off CBD products',
          discount: '20% OFF',
          restrictions: ['Cannot combine with other offers']
        }],
        thursday: [{
          description: 'Throwback Thursday - Retro pricing on select products',
          discount: 'RETRO PRICES',
          restrictions: ['Select items only', 'While supplies last']
        }],
        friday: [{
          description: 'Freebie Friday - Free gift with purchases over $100',
          discount: 'FREE GIFT',
          restrictions: ['While supplies last', 'One per customer']
        }],
        saturday: [{
          description: 'Sample Saturday - Free samples with any purchase',
          discount: 'FREE SAMPLES',
          restrictions: ['While supplies last', 'Must be 21+']
        }],
        sunday: [{
          description: 'Sunday Bundle - 20% off when you buy flower + concentrate',
          discount: '20% OFF',
          restrictions: ['Must purchase both categories']
        }]
      },
      special: [
        {
          title: 'Summer Solstice Sale',
          description: 'Celebrating the longest day of the year with our longest sale',
          discount: 'Up to 30% OFF',
          startDate: '2023-06-20T00:00:00Z',
          endDate: '2023-06-22T23:59:59Z',
          restrictions: ['In-store only', 'While supplies last']
        }
      ]
    },
    isPartner: true,
    rating: 4.9,
    lastUpdated: '2023-01-18T12:15:00Z',
    logoUrl: 'https://example.com/logos/northernlights.png',
    bannerUrl: 'https://example.com/banners/northernlights.png',
    distance: 3.5
  },
  {
    id: 'v4',
    name: 'Denali Dispensary',
    location: {
      address: '101 Mountain View Dr, Anchorage, AK 99504',
      coordinates: {
        latitude: 61.2224,
        longitude: -149.8330
      }
    },
    contact: {
      phone: '907-555-0404',
      email: 'hello@denalidispensary.com',
      social: {
        instagram: 'denali_dispensary',
        facebook: 'denalidispensaryak'
      }
    },
    hours: {
      monday: { open: '09:00', close: '21:00' },
      tuesday: { open: '09:00', close: '21:00' },
      wednesday: { open: '09:00', close: '21:00' },
      thursday: { open: '09:00', close: '21:00' },
      friday: { open: '09:00', close: '22:00' },
      saturday: { open: '09:00', close: '22:00' },
      sunday: { open: '10:00', close: '20:00' }
    },
    deals: {
      birthday: {
        description: 'Buy one get one free on any product',
        discount: 'BOGO FREE',
        restrictions: ['ID required', 'Must be on actual birthday', 'Equal or lesser value']
      },
      daily: {
        monday: [{
          description: 'Medical Monday - 10% off for medical cardholders',
          discount: '10% OFF',
          restrictions: ['Must show valid medical card']
        }],
        tuesday: [{
          description: 'Tasty Tuesday - 15% off all edibles',
          discount: '15% OFF',
          restrictions: ['In-store only', 'Cannot combine with other offers']
        }],
        wednesday: [{
          description: 'Wild Card Wednesday - Random deal revealed in-store',
          discount: 'SURPRISE',
          restrictions: ['In-store only', 'Deal changes weekly']
        }],
        thursday: [{
          description: 'Thirsty Thursday - 15% off all drinks',
          discount: '15% OFF',
          restrictions: ['Cannot combine with other offers']
        }],
        friday: [{
          description: 'Cartridge Friday - $5 off all cartridges',
          discount: '$5 OFF',
          restrictions: ['While supplies last']
        }],
        saturday: [{
          description: 'Early Bird Saturday - 10% off before noon',
          discount: '10% OFF',
          restrictions: ['Before 12PM only']
        }],
        sunday: [{
          description: 'Sunday Savings - $10 eighth of select strains',
          discount: '$10 EIGHTH',
          restrictions: ['Select strains only', 'While supplies last']
        }]
      },
      special: [
        {
          title: '4/20 Blowout',
          description: 'Special deals all day for 4/20',
          discount: 'Up to 42% OFF',
          startDate: '2023-04-20T00:00:00Z',
          endDate: '2023-04-20T23:59:59Z',
          restrictions: ['In-store only', 'While supplies last']
        }
      ]
    },
    isPartner: true,
    rating: 4.7,
    lastUpdated: '2023-01-15T14:30:00Z',
    logoUrl: 'https://example.com/logos/greenhorizon.png',
    bannerUrl: 'https://example.com/banners/greenhorizon.png',
    distance: 1.2
  }
];

/**
 * Mock featured deals
 */
const MOCK_FEATURED_DEALS = [
  {
    id: 'd1',
    title: 'Munchie Monday',
    description: '20% off all edibles today only',
    discount: '20% OFF',
    vendorId: 'v1',
    vendorName: 'Green Horizon',
    dealType: 'daily',
    category: 'edibles',
    imageUrl: 'https://example.com/deals/munchie-monday.jpg',
    expiresAt: '2023-01-30T23:59:59Z'
  },
  {
    id: 'd2',
    title: 'Customer Appreciation Week',
    description: 'Special deals all week for our loyal customers',
    discount: 'VARIES',
    vendorId: 'v2',
    vendorName: 'Aurora Dispensary',
    dealType: 'special',
    category: 'all',
    imageUrl: 'https://example.com/deals/customer-appreciation.jpg',
    expiresAt: '2023-03-07T23:59:59Z'
  },
  {
    id: 'd3',
    title: 'Birthday Month Special',
    description: '30% off one item of your choice during your birthday month',
    discount: '30% OFF',
    vendorId: 'v3',
    vendorName: 'Northern Lights Cannabis',
    dealType: 'birthday',
    category: 'all',
    imageUrl: 'https://example.com/deals/birthday-special.jpg',
    expiresAt: '2023-12-31T23:59:59Z'
  },
  {
    id: 'd4',
    title: 'Cartridge Friday',
    description: '$5 off all cartridges this Friday',
    discount: '$5 OFF',
    vendorId: 'v2',
    vendorName: 'Aurora Dispensary',
    dealType: 'daily',
    category: 'cartridges',
    imageUrl: 'https://example.com/deals/cartridge-friday.jpg',
    expiresAt: '2023-01-27T23:59:59Z'
  },
  {
    id: 'd5',
    title: '2-for-Tuesday',
    description: 'Buy one get one free on select edibles',
    discount: 'BOGO FREE',
    vendorId: 'v3',
    vendorName: 'Northern Lights Cannabis',
    dealType: 'daily',
    category: 'edibles',
    imageUrl: 'https://example.com/deals/2-for-tuesday.jpg',
    expiresAt: '2023-01-31T23:59:59Z'
  }
];

/**
 * Get all vendors
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} - Array of vendors
 */
export const getAllVendors = (options = {}) => {
  return new Promise((resolve, reject) => {
    // Simulate network delay
    setTimeout(() => {
      try {
        Logger.info(LogCategory.VENDORS, 'Getting all vendors', { options });
        
        let filteredVendors = [...MOCK_VENDORS];
        
        // Apply filters
        if (options.dealType) {
          filteredVendors = filteredVendors.filter(vendor => {
            if (options.dealType === 'birthday' && vendor.deals.birthday) {
              return true;
            }
            if (options.dealType === 'daily' && vendor.deals.daily) {
              // If day is specified, check if that day has deals
              if (options.day) {
                return vendor.deals.daily[options.day] && 
                       vendor.deals.daily[options.day].length > 0;
              }
              return true;
            }
            if (options.dealType === 'special' && vendor.deals.special && 
                vendor.deals.special.length > 0) {
              return true;
            }
            return false;
          });
        }
        
        // Filter by max distance
        if (options.maxDistance) {
          filteredVendors = filteredVendors.filter(vendor => 
            vendor.distance <= options.maxDistance
          );
        }
        
        // Sort by partner status and distance
        filteredVendors.sort((a, b) => {
          // Partners first
          if (a.isPartner && !b.isPartner) return -1;
          if (!a.isPartner && b.isPartner) return 1;
          
          // Then by distance
          return a.distance - b.distance;
        });
        
        // Limit results
        if (options.maxResults && options.maxResults > 0) {
          filteredVendors = filteredVendors.slice(0, options.maxResults);
        }
        
        resolve(filteredVendors);
      } catch (error) {
        Logger.error(LogCategory.VENDORS, 'Error getting vendors', { error });
        reject(error);
      }
    }, 300); // 300ms delay to simulate network
  });
};

/**
 * Get a vendor by ID
 * @param {string} vendorId - Vendor ID
 * @returns {Promise<Object>} - Vendor object
 */
export const getVendorById = (vendorId) => {
  return new Promise((resolve, reject) => {
    // Simulate network delay
    setTimeout(() => {
      try {
        Logger.info(LogCategory.VENDORS, 'Getting vendor by ID', { vendorId });
        
        const vendor = MOCK_VENDORS.find(v => v.id === vendorId);
        
        if (!vendor) {
          throw new Error(`Vendor with ID ${vendorId} not found`);
        }
        
        resolve(vendor);
      } catch (error) {
        Logger.error(LogCategory.VENDORS, 'Error getting vendor by ID', { error, vendorId });
        reject(error);
      }
    }, 200); // 200ms delay to simulate network
  });
};

/**
 * Get recently visited vendors
 * @param {number} limit - Maximum number of vendors to return
 * @returns {Promise<Array>} - Array of recently visited vendors
 */
export const getRecentVendors = async (limit = 5) => {
  try {
    Logger.info(LogCategory.VENDORS, 'Getting recent vendors', { limit });
    
    // In a real app, we would get this from AsyncStorage or API
    // For this mock, we'll return random vendors
    const randomVendors = [...MOCK_VENDORS]
      .sort(() => 0.5 - Math.random())
      .slice(0, limit);
    
    // Add last visit date
    const enhancedVendors = randomVendors.map(vendor => ({
      ...vendor,
      lastVisit: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
      visitCount: Math.floor(Math.random() * 5) + 1
    }));
    
    return enhancedVendors;
  } catch (error) {
    Logger.error(LogCategory.VENDORS, 'Error getting recent vendors', { error });
    throw error;
  }
};

/**
 * Get featured deals
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} - Array of featured deals
 */
export const getFeaturedDeals = (options = {}) => {
  return new Promise((resolve, reject) => {
    // Simulate network delay
    setTimeout(() => {
      try {
        Logger.info(LogCategory.DEALS, 'Getting featured deals', { options });
        
        let filteredDeals = [...MOCK_FEATURED_DEALS];
        
        // Apply filters
        if (options.dealType) {
          filteredDeals = filteredDeals.filter(deal => 
            deal.dealType === options.dealType
          );
        }
        
        if (options.category) {
          filteredDeals = filteredDeals.filter(deal => 
            deal.category === options.category || deal.category === 'all'
          );
        }
        
        if (options.vendorId) {
          filteredDeals = filteredDeals.filter(deal => 
            deal.vendorId === options.vendorId
          );
        }
        
        // Sort by partner status (when joining with vendor data) and expiration
        filteredDeals.sort((a, b) => {
          const vendorA = MOCK_VENDORS.find(v => v.id === a.vendorId);
          const vendorB = MOCK_VENDORS.find(v => v.id === b.vendorId);
          
          // Partners first
          if (vendorA && vendorB) {
            if (vendorA.isPartner && !vendorB.isPartner) return -1;
            if (!vendorA.isPartner && vendorB.isPartner) return 1;
          }
          
          // Then by expiration (newer expirations first)
          return new Date(b.expiresAt) - new Date(a.expiresAt);
        });
        
        // Limit results
        if (options.limit && options.limit > 0) {
          filteredDeals = filteredDeals.slice(0, options.limit);
        }
        
        resolve(filteredDeals);
      } catch (error) {
        Logger.error(LogCategory.DEALS, 'Error getting featured deals', { error });
        reject(error);
      }
    }, 300); // 300ms delay to simulate network
  });
};

/**
 * Get all deals for a specific day
 * @param {string} day - Day of week (lowercase)
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} - Array of daily deals
 */
export const getDailyDeals = (day, options = {}) => {
  return new Promise((resolve, reject) => {
    // Simulate network delay
    setTimeout(() => {
      try {
        Logger.info(LogCategory.DEALS, 'Getting daily deals', { day, options });
        
        // Validate day parameter
        const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        if (!validDays.includes(day)) {
          throw new Error(`Invalid day: ${day}. Must be one of: ${validDays.join(', ')}`);
        }
        
        // Get deals for all vendors for the specified day
        let dailyDeals = [];
        
        MOCK_VENDORS.forEach(vendor => {
          if (vendor.deals.daily && vendor.deals.daily[day]) {
            vendor.deals.daily[day].forEach(deal => {
              dailyDeals.push({
                id: `${vendor.id}-${day}-${dailyDeals.length}`,
                title: deal.description,
                description: deal.description,
                discount: deal.discount,
                restrictions: deal.restrictions,
                vendorId: vendor.id,
                vendorName: vendor.name,
                dealType: 'daily',
                day: day,
                vendorDistance: vendor.distance,
                vendorIsPartner: vendor.isPartner
              });
            });
          }
        });
        
        // Apply filters
        if (options.category) {
          // In a real app, deals would have categories
          // For this mock, we'll just filter randomly
          dailyDeals = dailyDeals.filter(() => Math.random() > 0.3);
        }
        
        if (options.maxDistance) {
          dailyDeals = dailyDeals.filter(deal => deal.vendorDistance <= options.maxDistance);
        }
        
        // Sort by partner status and distance
        dailyDeals.sort((a, b) => {
          // Partners first
          if (a.vendorIsPartner && !b.vendorIsPartner) return -1;
          if (!a.vendorIsPartner && b.vendorIsPartner) return 1;
          
          // Then by distance
          return a.vendorDistance - b.vendorDistance;
        });
        
        // Limit results
        if (options.limit && options.limit > 0) {
          dailyDeals = dailyDeals.slice(0, options.limit);
        }
        
        resolve(dailyDeals);
      } catch (error) {
        Logger.error(LogCategory.DEALS, 'Error getting daily deals', { error, day });
        reject(error);
      }
    }, 300); // 300ms delay to simulate network
  });
};

/**
 * Get birthday deals
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} - Array of birthday deals
 */
export const getBirthdayDeals = (options = {}) => {
  return new Promise((resolve, reject) => {
    // Simulate network delay
    setTimeout(() => {
      try {
        Logger.info(LogCategory.DEALS, 'Getting birthday deals', { options });
        
        // Get birthday deals for all vendors
        let birthdayDeals = [];
        
        MOCK_VENDORS.forEach(vendor => {
          if (vendor.deals.birthday) {
            birthdayDeals.push({
              id: `${vendor.id}-birthday`,
              title: vendor.deals.birthday.description,
              description: vendor.deals.birthday.description,
              discount: vendor.deals.birthday.discount,
              restrictions: vendor.deals.birthday.restrictions,
              vendorId: vendor.id,
              vendorName: vendor.name,
              dealType: 'birthday',
              vendorDistance: vendor.distance,
              vendorIsPartner: vendor.isPartner
            });
          }
        });
        
        // Apply filters
        if (options.maxDistance) {
          birthdayDeals = birthdayDeals.filter(deal => deal.vendorDistance <= options.maxDistance);
        }
        
        // Sort by partner status and distance
        birthdayDeals.sort((a, b) => {
          // Partners first
          if (a.vendorIsPartner && !b.vendorIsPartner) return -1;
          if (!a.vendorIsPartner && b.vendorIsPartner) return 1;
          
          // Then by distance
          return a.vendorDistance - b.vendorDistance;
        });
        
        // Limit results
        if (options.limit && options.limit > 0) {
          birthdayDeals = birthdayDeals.slice(0, options.limit);
        }
        
        resolve(birthdayDeals);
      } catch (error) {
        Logger.error(LogCategory.DEALS, 'Error getting birthday deals', { error });
        reject(error);
      }
    }, 300); // 300ms delay to simulate network
  });
};

/**
 * Get special deals
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} - Array of special deals
 */
export const getSpecialDeals = (options = {}) => {
  return new Promise((resolve, reject) => {
    // Simulate network delay
    setTimeout(() => {
      try {
        Logger.info(LogCategory.DEALS, 'Getting special deals', { options });
        
        // Get special deals for all vendors
        let specialDeals = [];
        
        MOCK_VENDORS.forEach(vendor => {
          if (vendor.deals.special && vendor.deals.special.length > 0) {
            vendor.deals.special.forEach(deal => {
              specialDeals.push({
                id: `${vendor.id}-special-${specialDeals.length}`,
                title: deal.title,
                description: deal.description,
                discount: deal.discount,
                restrictions: deal.restrictions,
                startDate: deal.startDate,
                endDate: deal.endDate,
                vendorId: vendor.id,
                vendorName: vendor.name,
                dealType: 'special',
                vendorDistance: vendor.distance,
                vendorIsPartner: vendor.isPartner
              });
            });
          }
        });
        
        // Apply filters
        if (options.maxDistance) {
          specialDeals = specialDeals.filter(deal => deal.vendorDistance <= options.maxDistance);
        }
        
        // Filter active deals only
        const now = new Date().toISOString();
        if (options.activeOnly) {
          specialDeals = specialDeals.filter(deal => 
            deal.startDate <= now && deal.endDate >= now
          );
        }
        
        // Sort by partner status, end date, and distance
        specialDeals.sort((a, b) => {
          // Partners first
          if (a.vendorIsPartner && !b.vendorIsPartner) return -1;
          if (!a.vendorIsPartner && b.vendorIsPartner) return 1;
          
          // Then by end date (soonest ending first)
          const endDateDiff = new Date(a.endDate) - new Date(b.endDate);
          if (endDateDiff !== 0) return endDateDiff;
          
          // Then by distance
          return a.vendorDistance - b.vendorDistance;
        });
        
        // Limit results
        if (options.limit && options.limit > 0) {
          specialDeals = specialDeals.slice(0, options.limit);
        }
        
        resolve(specialDeals);
      } catch (error) {
        Logger.error(LogCategory.DEALS, 'Error getting special deals', { error });
        reject(error);
      }
    }, 300); // 300ms delay to simulate network
  });
};

/**
 * Check in at a vendor
 * @param {string} vendorId - Vendor ID
 * @param {Object} options - Check-in options
 * @returns {Promise<Object>} - Check-in result
 */
export const checkInAtVendor = async (vendorId, options = {}) => {
  try {
    Logger.info(LogCategory.CHECKIN, 'Checking in at vendor', { vendorId, options });
    
    // Validate vendor exists
    const vendor = await getVendorById(vendorId);
    
    // Simulate check-in
    const checkInResult = {
      success: true,
      timestamp: new Date().toISOString(),
      vendor: vendor,
      pointsEarned: 10, // Default points
      message: 'Check-in successful!'
    };
    
    // Add to AsyncStorage for history
    try {
      const historyKey = 'checkin_history';
      let history = [];
      
      const existingHistory = await AsyncStorage.getItem(historyKey);
      if (existingHistory) {
        history = JSON.parse(existingHistory);
      }
      
      history.push({
        vendorId,
        vendorName: vendor.name,
        timestamp: checkInResult.timestamp,
        pointsEarned: checkInResult.pointsEarned
      });
      
      // Keep only last 20 check-ins
      if (history.length > 20) {
        history = history.slice(history.length - 20);
      }
      
      await AsyncStorage.setItem(historyKey, JSON.stringify(history));
    } catch (error) {
      // Log but don't fail the check-in
      Logger.error(LogCategory.STORAGE, 'Error saving check-in history', { error });
    }
    
    return checkInResult;
  } catch (error) {
    Logger.error(LogCategory.CHECKIN, 'Error checking in at vendor', { error, vendorId });
    throw error;
  }
};

/**
 * Create optimized route for a list of vendors
 * @param {Array} vendorIds - Array of vendor IDs
 * @param {Object} options - Route options
 * @returns {Promise<Object>} - Route object
 */
export const createOptimizedRoute = async (vendorIds, options = {}) => {
  try {
    Logger.info(LogCategory.NAVIGATION, 'Creating optimized route', { vendorIds, options });
    
    // Validate vendors exist
    const vendors = [];
    for (const id of vendorIds) {
      const vendor = await getVendorById(id);
      vendors.push(vendor);
    }
    
    // In a real app, we would use a route optimization service
    // For this mock, we'll just sort by distance from a starting point
    
    let startLat = 61.217381; // Default latitude (downtown Anchorage)
    let startLng = -149.863129; // Default longitude
    
    if (options.startLocation) {
      startLat = options.startLocation.latitude;
      startLng = options.startLocation.longitude;
    }
    
    // Calculate distance from starting point for each vendor
    const vendorsWithDistance = vendors.map(vendor => {
      const distance = calculateDistance(
        startLat,
        startLng,
        vendor.location.coordinates.latitude,
        vendor.location.coordinates.longitude
      );
      
      return {
        ...vendor,
        distanceFromStart: distance
      };
    });
    
    // Sort by distance from start
    vendorsWithDistance.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
    
    // Calculate total distance
    let totalDistance = 0;
    let prevLat = startLat;
    let prevLng = startLng;
    
    for (const vendor of vendorsWithDistance) {
      const distance = calculateDistance(
        prevLat,
        prevLng,
        vendor.location.coordinates.latitude,
        vendor.location.coordinates.longitude
      );
      
      totalDistance += distance;
      prevLat = vendor.location.coordinates.latitude;
      prevLng = vendor.location.coordinates.longitude;
    }
    
    // Calculate estimated time (rough estimate: 3 minutes per mile)
    const estimatedTime = Math.ceil(totalDistance * 3);
    
    // Create route object
    const route = {
      vendors: vendorsWithDistance,
      totalDistance: totalDistance,
      estimatedTime: estimatedTime,
      startLocation: {
        latitude: startLat,
        longitude: startLng
      }
    };
    
    return route;
  } catch (error) {
    Logger.error(LogCategory.NAVIGATION, 'Error creating optimized route', { error, vendorIds });
    throw error;
  }
};

/**
 * Calculate distance between two points
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} - Distance in miles
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance * 0.621371;
};

const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};