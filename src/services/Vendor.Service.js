// src/services/Vendor.Service.js
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
      return Promise.resolve(mockVendors);
    },
    
    getVendorById: (id) => {
      const vendor = mockVendors.find(v => v.id === id);
      return Promise.resolve(vendor || null);
    },
    
    searchVendors: ({ dealType, maxDistance, maxResults, currentLocation }) => {
      // Filter vendors by dealType and maxDistance
      let filtered = mockVendors;
      
      // Filter by distance (simple version for mock)
      if (maxDistance) {
        filtered = filtered.filter(v => v.distance <= maxDistance);
      }
      
      // Limit results
      if (maxResults) {
        filtered = filtered.slice(0, maxResults);
      }
      
      return Promise.resolve(filtered);
    }
  };
  
  // For easy access in components that need it
  export default vendorService;