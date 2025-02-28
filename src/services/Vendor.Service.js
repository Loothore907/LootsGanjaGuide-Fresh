// src/services/Vendor.Service.js
import { Logger, LogCategory } from '../services/LoggingService';

const mockVendors = [
    {
      id: 'v1',
      name: 'Green Leaf Dispensary',
      location: {
        address: '123 Main St, Anchorage, AK 99501',
        coordinates: {
          latitude: 61.218056,
          longitude: -149.900278
        }
      },
      distance: 1.2,
      deals: {
        daily: {
          monday: [
            {
              description: 'Monday BOGO',
              discount: 'Buy one get one free on all pre-rolls',
              restrictions: ['Limit 1 per customer', 'Must be 21+']
            }
          ],
          tuesday: [
            {
              description: 'Tincture Tuesday',
              discount: '20% off all tinctures',
              restrictions: ['In-store only']
            }
          ],
          wednesday: [
            {
              description: 'Wax Wednesday',
              discount: '15% off all concentrates',
              restrictions: []
            }
          ],
          thursday: [
            {
              description: 'Thirsty Thursday',
              discount: '25% off all beverages',
              restrictions: ['Limit 5 items']
            }
          ],
          friday: [
            {
              description: 'Friday Flower',
              discount: '10% off all flower products',
              restrictions: []
            }
          ],
          saturday: [
            {
              description: 'Saturday Edibles',
              discount: '10% off all edibles',
              restrictions: []
            }
          ],
          sunday: [
            {
              description: 'Sunday Funday',
              discount: '$5 off any purchase over $50',
              restrictions: ['Cannot combine with other offers']
            }
          ]
        },
        birthday: {
          description: 'Birthday Special',
          discount: 'Free pre-roll with any purchase',
          restrictions: ['Must show ID with birthday', 'Valid during birthday month']
        },
        special: []
      }
    },
    {
      id: 'v2',
      name: 'Arctic Buds',
      location: {
        address: '456 Pine Ave, Anchorage, AK 99503',
        coordinates: {
          latitude: 61.226944,
          longitude: -149.883333
        }
      },
      distance: 0.8,
      deals: {
        daily: {
          monday: [
            {
              description: 'Munchie Monday',
              discount: '20% off all edibles',
              restrictions: []
            }
          ],
          tuesday: [
            {
              description: 'Top Shelf Tuesday',
              discount: '10% off premium flower',
              restrictions: []
            }
          ],
          wednesday: [
            {
              description: 'Wellness Wednesday',
              discount: '15% off all CBD products',
              restrictions: []
            }
          ],
          thursday: [
            {
              description: 'Throwback Thursday',
              discount: 'Classic strains at classic prices',
              restrictions: ['Select strains only']
            }
          ],
          friday: [
            {
              description: 'TGIF Deal',
              discount: 'Buy 2 get 1 free on cartridges',
              restrictions: ['Equal or lesser value']
            }
          ],
          saturday: [
            {
              description: 'Saturday Special',
              discount: 'Free gift with purchases over $100',
              restrictions: ['While supplies last']
            }
          ],
          sunday: [
            {
              description: 'Sunday Savings',
              discount: '15% off storewide',
              restrictions: ['Excludes already discounted items']
            }
          ]
        },
        birthday: {
          description: 'Birthday Blowout',
          discount: '25% off one item of your choice',
          restrictions: ['Valid on birthday only with ID']
        },
        special: []
      }
    },
    {
      id: 'v3',
      name: 'Northern Lights Cannabis',
      location: {
        address: '789 Aurora St, Anchorage, AK 99504',
        coordinates: {
          latitude: 61.215833,
          longitude: -149.866667
        }
      },
      distance: 1.5,
      deals: {
        daily: {
          monday: [
            {
              description: 'Monday Madness',
              discount: '10% off entire purchase',
              restrictions: ['In-store only']
            }
          ],
          tuesday: [
            {
              description: 'Toke Tuesday',
              discount: 'Free lighter with any purchase over $50',
              restrictions: ['While supplies last']
            }
          ],
          wednesday: [
            {
              description: 'Wild Wednesday',
              discount: 'Random discounts (10-30% off) revealed at checkout',
              restrictions: []
            }
          ],
          thursday: [
            {
              description: 'Therapeutic Thursday',
              discount: '15% off all topicals and tinctures',
              restrictions: []
            }
          ],
          friday: [
            {
              description: 'Fatty Friday',
              discount: 'Buy 2 get 1 free on all pre-rolls',
              restrictions: ['Equal or lesser value']
            }
          ],
          saturday: [
            {
              description: 'Shatterday',
              discount: '20% off all concentrates',
              restrictions: []
            }
          ],
          sunday: [
            {
              description: 'Sunday Session',
              discount: '15% off all flower',
              restrictions: ['Limit of 1 oz per customer']
            }
          ]
        },
        birthday: {
          description: 'Birthday Bonus',
          discount: 'Free edible (up to $20 value) with any purchase',
          restrictions: ['Valid during birthday week', 'Must show ID']
        },
        special: []
      }
    }
  ];
  
  export const vendorService = {
    getAllVendors: () => {
      try {
        Logger.info(LogCategory.VENDORS, 'Getting all vendors');
        return Promise.resolve(mockVendors);
      } catch (error) {
        Logger.error(LogCategory.VENDORS, 'Error getting all vendors', { error });
        return Promise.resolve([]);
      }
    },
    
    getVendorById: (id) => {
      try {
        Logger.info(LogCategory.VENDORS, 'Getting vendor by ID', { vendorId: id });
        const vendor = mockVendors.find(v => v.id === id);
        if (!vendor) {
          Logger.warn(LogCategory.VENDORS, `Vendor with ID ${id} not found`);
        }
        return Promise.resolve(vendor || null);
      } catch (error) {
        Logger.error(LogCategory.VENDORS, `Error getting vendor with ID ${id}`, { error });
        return Promise.resolve(null);
      }
    },
    
    searchVendors: ({ dealType, maxDistance, maxResults, currentLocation }) => {
      try {
        Logger.info(LogCategory.VENDORS, 'Searching vendors', {
          dealType,
          maxDistance,
          maxResults
        });
        
        // Filter vendors by dealType and maxDistance
        let filtered = [...mockVendors];
        
        // Filter by deal type if specified
        if (dealType) {
          filtered = filtered.filter(vendor => {
            // For birthday deals
            if (dealType === 'birthday' && vendor.deals.birthday) {
              return true;
            }
            // For daily deals
            if (dealType === 'daily' && vendor.deals.daily) {
              return true;
            }
            // For special deals
            if (dealType === 'special' && vendor.deals.special) {
              return true;
            }
            return false;
          });
        }
        
        // Filter by distance if specified
        if (maxDistance) {
          filtered = filtered.filter(v => v.distance <= maxDistance);
        }
        
        // Sort by distance
        filtered.sort((a, b) => a.distance - b.distance);
        
        // Limit results if specified
        if (maxResults && maxResults > 0) {
          filtered = filtered.slice(0, maxResults);
        }
        
        return Promise.resolve(filtered);
      } catch (error) {
        Logger.error(LogCategory.VENDORS, 'Error searching vendors', { error });
        return Promise.resolve([]);
      }
    },
    
    // Add additional methods that might be used in the app
    getFavoriteVendors: () => {
      // Mock implementation
      return Promise.resolve(mockVendors.slice(0, 2));
    },
    
    getRecentVendors: () => {
      // Mock implementation
      return Promise.resolve(mockVendors.slice(0, 3));
    },
    
    toggleFavorite: (vendorId) => {
      // Mock implementation
      Logger.info(LogCategory.VENDORS, 'Toggling favorite status', { vendorId });
      return Promise.resolve({ success: true });
    }
  };
  
  // For easy access in components that need it
  export default vendorService;