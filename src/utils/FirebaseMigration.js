// src/utils/FirebaseMigration.js
import { firestore, auth, serverTimestamp } from '../config/firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, limit, deleteDoc } from 'firebase/firestore';
import { Logger, LogCategory } from '../services/LoggingService';
import * as MockDataService from '../services/MockDataService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handleError, tryCatch } from './ErrorHandler';

/**
 * Utility for migrating mock data to Firebase
 */
class FirebaseMigration {
  constructor() {
    this.migrationStats = {
      vendors: { total: 0, success: 0, errors: 0 },
      featuredDeals: { total: 0, success: 0, errors: 0 },
      user: { success: false, error: null, message: '' },
      favorites: { success: false, error: null, message: '' },
      visits: { success: false, error: null, message: '' },
      mockData: { total: 0, success: 0, errors: 0 }
    };
  }

  /**
   * Check if Firebase collections already have data
   * @returns {Promise<boolean>} - Whether data exists or not
   */
  async hasExistingData() {
    try {
      Logger.info(LogCategory.DATABASE, 'Checking for existing Firebase data');
      
      // Check if vendors collection has any documents
      const vendorsRef = collection(firestore, 'vendors');
      const q = query(vendorsRef, limit(1));
      const snapshot = await getDocs(q);
      
      const hasData = !snapshot.empty;
      Logger.info(LogCategory.DATABASE, `Firebase data check result: ${hasData ? 'Data exists' : 'No data found'}`);
      
      return hasData;
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error checking existing Firebase data', { error });
      throw error;
    }
  }

  /**
   * Migrate vendors from mock data to Firebase
   * @returns {Promise<Object>} - Migration result statistics
   */
  async migrateVendors() {
    try {
      Logger.info(LogCategory.DATABASE, 'Beginning vendor migration');
      
      // Get all vendors from mock data
      const vendors = await MockDataService.getAllVendors();
      this.migrationStats.vendors.total = vendors.length;
      
      // Log detailed info about what we got from MockDataService
      Logger.debug(LogCategory.DATABASE, `Retrieved ${vendors.length} vendors from MockDataService`, { 
        firstVendor: vendors.length > 0 ? { 
          id: vendors[0].id, 
          name: vendors[0].name,
          hasDeals: !!vendors[0].deals,
          dealTypes: vendors[0].deals ? Object.keys(vendors[0].deals) : []
        } : null 
      });
      
      const vendorsRef = collection(firestore, 'vendors');
      
      // Import each vendor
      for (const vendor of vendors) {
        try {
          const vendorDocRef = doc(vendorsRef, vendor.id);
          
          // Normalize the vendor data to ensure it's Firestore-compatible
          const vendorData = this.normalizeVendorForFirestore(vendor);
          
          await setDoc(vendorDocRef, vendorData);
          Logger.debug(LogCategory.DATABASE, `Migrated vendor: ${vendor.name}`, { id: vendor.id });
          this.migrationStats.vendors.success++;
        } catch (error) {
          Logger.error(LogCategory.DATABASE, `Error migrating vendor: ${vendor.name}`, { error, id: vendor.id });
          this.migrationStats.vendors.errors++;
        }
      }
      
      Logger.info(LogCategory.DATABASE, 'Vendor migration complete', { 
        total: vendors.length, 
        success: this.migrationStats.vendors.success, 
        errors: this.migrationStats.vendors.errors 
      });
      
      return this.migrationStats.vendors;
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error in vendor migration', { error });
      this.migrationStats.vendors.error = error;
      throw error;
    }
  }

  /**
   * Normalize vendor data for Firestore
   * @private
   * @param {Object} vendor - Raw vendor data
   * @returns {Object} - Normalized vendor data
   */
  normalizeVendorForFirestore(vendor) {
    // Create a deep copy to avoid mutating the original
    const normalizedVendor = JSON.parse(JSON.stringify(vendor));
    
    // Ensure lastUpdated is a valid ISO string
    if (normalizedVendor.lastUpdated) {
      try {
        normalizedVendor.lastUpdated = new Date(normalizedVendor.lastUpdated).toISOString();
      } catch (e) {
        normalizedVendor.lastUpdated = new Date().toISOString();
      }
    } else {
      normalizedVendor.lastUpdated = new Date().toISOString();
    }
    
    // Add timestamps
    normalizedVendor.createdAt = serverTimestamp();
    normalizedVendor.updatedAt = serverTimestamp();
    
    // Ensure deals structure is correct
    if (normalizedVendor.deals) {
      // Process special deals if they exist
      if (normalizedVendor.deals.special && Array.isArray(normalizedVendor.deals.special)) {
        normalizedVendor.deals.special = normalizedVendor.deals.special.map(deal => {
          // Ensure dates are ISO strings
          if (deal.startDate) {
            try {
              deal.startDate = new Date(deal.startDate).toISOString();
            } catch (e) {
              deal.startDate = new Date().toISOString();
            }
          }
          
          if (deal.endDate) {
            try {
              deal.endDate = new Date(deal.endDate).toISOString();
            } catch (e) {
              // Set end date to one month from now
              const oneMonthLater = new Date();
              oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
              deal.endDate = oneMonthLater.toISOString();
            }
          }
          
          return deal;
        });
      }
      
      // Ensure daily deals have proper structure
      const dailyDeals = normalizedVendor.deals.daily || {};
      
      // Make sure each day has an array of deals
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      days.forEach(day => {
        if (dailyDeals[day] && !Array.isArray(dailyDeals[day])) {
          // Convert single object to array
          dailyDeals[day] = [dailyDeals[day]];
        } else if (!dailyDeals[day]) {
          // Initialize empty array if no deals for this day
          dailyDeals[day] = [];
        }
      });
      
      // Ensure everyday deals are properly structured
      if (normalizedVendor.deals.everyday && !Array.isArray(normalizedVendor.deals.everyday)) {
        // Convert single object to array
        normalizedVendor.deals.everyday = [normalizedVendor.deals.everyday];
      } else if (!normalizedVendor.deals.everyday) {
        // Initialize empty array if no everyday deals
        normalizedVendor.deals.everyday = [];
      }
    }
    
    return normalizedVendor;
  }

  /**
   * Migrate featured deals to Firebase
   * @returns {Promise<Object>} - Migration result statistics
   */
  async migrateFeaturedDeals() {
    try {
      Logger.info(LogCategory.DATABASE, 'Beginning featured deals migration');
      
      // Get featured deals from mock data
      const featuredDeals = await MockDataService.getFeaturedDeals();
      this.migrationStats.featuredDeals.total = featuredDeals.length;
      
      Logger.debug(LogCategory.DATABASE, `Retrieved ${featuredDeals.length} featured deals from MockDataService`, {
        firstDeal: featuredDeals.length > 0 ? {
          id: featuredDeals[0].id,
          title: featuredDeals[0].title,
          vendorId: featuredDeals[0].vendorId
        } : null
      });
      
      const featuredDealsRef = collection(firestore, 'featured_deals');
      
      // Import each featured deal
      for (const deal of featuredDeals) {
        try {
          const dealDocRef = doc(featuredDealsRef, deal.id);
          
          // Create vendor reference
          const vendorRef = doc(firestore, 'vendors', deal.vendorId);
          
          // Normalize expiration date
          let expiresAt;
          try {
            expiresAt = new Date(deal.expiresAt);
            // If date is invalid, set to one month from now
            if (isNaN(expiresAt.getTime())) {
              const oneMonthLater = new Date();
              oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
              expiresAt = oneMonthLater;
            }
          } catch (e) {
            // Default to one month from now
            const oneMonthLater = new Date();
            oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
            expiresAt = oneMonthLater;
          }
          
          // Extract the day from the title if it's a daily deal but missing the day field
          let day = deal.day;
          if (deal.dealType === 'daily' && !day) {
            // Try to extract day from title
            const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const titleLower = deal.title.toLowerCase();
            
            for (const dayName of dayNames) {
              if (titleLower.includes(dayName)) {
                day = dayName;
                break;
              }
            }
          }
          
          // Prepare deal data with proper timestamps and references
          const dealData = {
            title: deal.title || '',
            description: deal.description || '',
            discount: deal.discount || '',
            dealType: deal.dealType || 'special',
            vendorRef: vendorRef,
            vendorId: deal.vendorId,
            vendorName: deal.vendorName || '',
            imageUrl: deal.imageUrl || null,
            expiresAt: expiresAt,
            priority: Math.floor(Math.random() * 10), // Random priority 0-9
            day: day || null, // This ensures day is never undefined
            category: deal.category || 'all',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          
          await setDoc(dealDocRef, dealData);
          Logger.debug(LogCategory.DATABASE, `Migrated featured deal: ${deal.title}`, { id: deal.id });
          this.migrationStats.featuredDeals.success++;
        } catch (error) {
          Logger.error(LogCategory.DATABASE, `Error migrating featured deal: ${deal.title || 'Unnamed deal'}`, { error, id: deal.id });
          this.migrationStats.featuredDeals.errors++;
        }
      }
      
      Logger.info(LogCategory.DATABASE, 'Featured deals migration complete', { 
        total: featuredDeals.length, 
        success: this.migrationStats.featuredDeals.success, 
        errors: this.migrationStats.featuredDeals.errors 
      });
      
      return this.migrationStats.featuredDeals;
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error in featured deals migration', { error });
      this.migrationStats.featuredDeals.error = error;
      throw error;
    }
  }

  /**
   * Migrate user data from AsyncStorage to Firebase
   * @returns {Promise<Object>} - Migration result
   */
  async migrateUserData() {
    try {
      Logger.info(LogCategory.DATABASE, 'Beginning user data migration');
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        const message = 'No authenticated user found for user data migration';
        Logger.warn(LogCategory.DATABASE, message);
        this.migrationStats.user = { 
          success: false, 
          error: new Error('No authenticated user'), 
          message 
        };
        return this.migrationStats.user;
      }
      
      // Try to load user data from AsyncStorage
      const [
        username,
        points,
        ageVerified,
        tosAccepted
      ] = await Promise.all([
        AsyncStorage.getItem('username'),
        AsyncStorage.getItem('points'),
        AsyncStorage.getItem('isAgeVerified'),
        AsyncStorage.getItem('tosAccepted')
      ]);
      
      if (!username) {
        const message = 'No username found in AsyncStorage for migration';
        Logger.warn(LogCategory.DATABASE, message);
        this.migrationStats.user = { 
          success: false, 
          error: new Error('No username found'), 
          message 
        };
        return this.migrationStats.user;
      }
      
      // Create user document in Firestore
      const userRef = doc(firestore, 'users', currentUser.uid);
      const userData = {
        id: currentUser.uid,
        username: username,
        email: currentUser.email || null,
        points: points ? parseInt(points) : 0,
        favorites: [],
        tosAccepted: tosAccepted === 'true',
        ageVerified: ageVerified === 'true',
        ageVerificationDate: ageVerified === 'true' ? new Date().toISOString() : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(userRef, userData);
      
      Logger.info(LogCategory.DATABASE, 'User data migration complete', { userId: currentUser.uid });
      
      this.migrationStats.user = { 
        success: true, 
        error: null, 
        message: 'User data migrated successfully' 
      };
      
      return this.migrationStats.user;
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error in user data migration', { error });
      this.migrationStats.user = { 
        success: false, 
        error, 
        message: `Error migrating user data: ${error.message}` 
      };
      return this.migrationStats.user;
    }
  }

  /**
   * Migrate user favorites from AsyncStorage to Firebase
   * @returns {Promise<Object>} - Migration result
   */
  async migrateFavorites() {
    try {
      Logger.info(LogCategory.DATABASE, 'Beginning favorites migration');
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        const message = 'No authenticated user found for favorites migration';
        Logger.warn(LogCategory.DATABASE, message);
        this.migrationStats.favorites = { 
          success: false, 
          error: new Error('No authenticated user'), 
          message 
        };
        return this.migrationStats.favorites;
      }
      
      // Load favorites from AsyncStorage
      const favoritesJson = await AsyncStorage.getItem('favorites');
      
      if (!favoritesJson) {
        Logger.info(LogCategory.DATABASE, 'No favorites found to migrate');
        this.migrationStats.favorites = { 
          success: true, 
          error: null, 
          message: 'No favorites to migrate' 
        };
        return this.migrationStats.favorites;
      }
      
      // Parse favorites, ensuring it's an array
      let favorites;
      try {
        favorites = JSON.parse(favoritesJson);
        if (!Array.isArray(favorites)) {
          favorites = [];
        }
      } catch (e) {
        Logger.warn(LogCategory.DATABASE, 'Error parsing favorites from AsyncStorage', { error: e });
        favorites = [];
      }
      
      // Create user favorites document in Firestore
      const userFavoritesRef = doc(firestore, 'user_favorites', currentUser.uid);
      await setDoc(userFavoritesRef, {
        userId: currentUser.uid,
        vendorIds: favorites,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      Logger.info(LogCategory.DATABASE, 'Favorites migration complete', { count: favorites.length });
      
      this.migrationStats.favorites = { 
        success: true, 
        error: null, 
        message: `${favorites.length} favorites migrated successfully` 
      };
      
      return this.migrationStats.favorites;
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error in favorites migration', { error });
      this.migrationStats.favorites = { 
        success: false, 
        error, 
        message: `Error migrating favorites: ${error.message}` 
      };
      return this.migrationStats.favorites;
    }
  }

  /**
   * Migrate user visits from AsyncStorage to Firebase
   * @returns {Promise<Object>} - Migration result
   */
  async migrateVisits() {
    try {
      Logger.info(LogCategory.DATABASE, 'Beginning visits migration');
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        const message = 'No authenticated user found for visits migration';
        Logger.warn(LogCategory.DATABASE, message);
        this.migrationStats.visits = { 
          success: false, 
          error: new Error('No authenticated user'), 
          message 
        };
        return this.migrationStats.visits;
      }
      
      // Load recent visits from AsyncStorage
      const visitsJson = await AsyncStorage.getItem('recentVisits');
      
      if (!visitsJson) {
        Logger.info(LogCategory.DATABASE, 'No visits found to migrate');
        this.migrationStats.visits = { 
          success: true, 
          error: null, 
          message: 'No visits to migrate' 
        };
        return this.migrationStats.visits;
      }
      
      // Parse visits, ensuring it's an array
      let visits;
      try {
        visits = JSON.parse(visitsJson);
        if (!Array.isArray(visits)) {
          visits = [];
        }
      } catch (e) {
        Logger.warn(LogCategory.DATABASE, 'Error parsing visits from AsyncStorage', { error: e });
        visits = [];
      }
      
      // Create user visits document in Firestore
      const userVisitsRef = doc(firestore, 'user_visits', currentUser.uid);
      await setDoc(userVisitsRef, {
        userId: currentUser.uid,
        vendors: visits.map(visit => {
          const normalizedVisit = { ...visit };
          
          // Ensure lastVisit is a valid date
          if (normalizedVisit.lastVisit) {
            try {
              normalizedVisit.lastVisit = new Date(normalizedVisit.lastVisit).toISOString();
            } catch (e) {
              normalizedVisit.lastVisit = new Date().toISOString();
            }
          } else {
            normalizedVisit.lastVisit = new Date().toISOString();
          }
          
          return normalizedVisit;
        }),
        updatedAt: serverTimestamp()
      });
      
      Logger.info(LogCategory.DATABASE, 'Visits migration complete', { count: visits.length });
      
      this.migrationStats.visits = { 
        success: true, 
        error: null, 
        message: `${visits.length} visits migrated successfully` 
      };
      
      return this.migrationStats.visits;
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error in visits migration', { error });
      this.migrationStats.visits = { 
        success: false, 
        error, 
        message: `Error migrating visits: ${error.message}` 
      };
      return this.migrationStats.visits;
    }
  }

  /**
   * Initialize other collections with sample data
   * @returns {Promise<Object>} - Migration result
   */
  async initializeOtherCollections() {
    try {
      Logger.info(LogCategory.DATABASE, 'Initializing other collections');
      
      const currentUser = auth.currentUser;
      const userId = currentUser ? currentUser.uid : 'sample-user-1';
      
      const collections = [
        {
          name: 'journey_stats',
          samples: [
            {
              id: userId,
              userId: userId,
              completedJourneys: 0,
              totalVendorsVisited: 0,
              lastCompletedAt: null,
              updatedAt: serverTimestamp()
            }
          ]
        },
        {
          name: 'user_preferences',
          samples: [
            {
              id: userId,
              theme: 'light',
              notifications: true,
              maxDistance: 25,
              showPartnerOnly: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }
          ]
        },
        {
          name: 'points_history',
          samples: [
            {
              id: `${userId}-initial`,
              userId: userId,
              points: 100,
              newTotal: 100,
              source: 'signup-bonus',
              metadata: { note: 'Welcome bonus' },
              timestamp: serverTimestamp()
            }
          ]
        }
      ];
      
      let successCount = 0;
      let errorCount = 0;
      let totalCount = 0;
      
      for (const collectionData of collections) {
        try {
          const collRef = collection(firestore, collectionData.name);
          
          for (const sample of collectionData.samples) {
            totalCount++;
            try {
              // Check if document already exists
              const docRef = doc(collRef, sample.id);
              const docSnap = await getDoc(docRef);
              
              if (!docSnap.exists()) {
                await setDoc(docRef, sample);
                successCount++;
                Logger.debug(LogCategory.DATABASE, 
                  `Created sample document in ${collectionData.name}`, 
                  { id: sample.id }
                );
              } else {
                // Document exists, log but don't count as error
                Logger.info(LogCategory.DATABASE, 
                  `Document already exists in ${collectionData.name}`, 
                  { id: sample.id }
                );
                successCount++; // Still count as success since it exists
              }
            } catch (error) {
              Logger.error(LogCategory.DATABASE, 
                `Error creating sample in ${collectionData.name}`, 
                { error, sampleId: sample.id }
              );
              errorCount++;
            }
          }
        } catch (error) {
          Logger.error(LogCategory.DATABASE, 
            `Error initializing collection: ${collectionData.name}`, 
            { error }
          );
          errorCount++;
        }
      }
      
      this.migrationStats.mockData = {
        total: totalCount,
        success: successCount,
        errors: errorCount
      };
      
      Logger.info(LogCategory.DATABASE, 'Other collections initialized', this.migrationStats.mockData);
      
      return this.migrationStats.mockData;
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error initializing other collections', { error });
      this.migrationStats.mockData.error = error;
      return this.migrationStats.mockData;
    }
  }

  /**
   * Clear all Firebase data (use with caution, only in development)
   * @returns {Promise<boolean>} - Success status
   */
  async clearAllData() {
    if (!__DEV__) {
      Logger.error(LogCategory.DATABASE, 'Cannot clear Firebase data in production');
      return false;
    }
    
    try {
      Logger.warn(LogCategory.DATABASE, 'Clearing all Firebase data');
      
      const collections = [
        'vendors',
        'featured_deals',
        'users',
        'user_favorites',
        'user_visits',
        'journey_stats',
        'user_preferences',
        'check_ins',
        'journeys',
        'points_history'
      ];
      
      let clearCount = 0;
      
      for (const collName of collections) {
        try {
          const collRef = collection(firestore, collName);
          const snapshot = await getDocs(collRef);
          
          for (const docSnap of snapshot.docs) {
            await deleteDoc(doc(firestore, collName, docSnap.id));
            clearCount++;
          }
          
          Logger.info(LogCategory.DATABASE, `Cleared collection: ${collName}`, { count: snapshot.size });
        } catch (error) {
          Logger.error(LogCategory.DATABASE, `Error clearing collection: ${collName}`, { error });
        }
      }
      
      // Reset migration completion flag
      await AsyncStorage.removeItem('firebase_migration_completed');
      
      Logger.info(LogCategory.DATABASE, 'Firebase data clearing complete', { totalDocumentsRemoved: clearCount });
      return true;
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error clearing Firebase data', { error });
      return false;
    }
  }

  /**
   * Run full migration of all data to Firebase
   * @param {Object} options - Migration options
   * @param {boolean} options.force - Override existing data
   * @returns {Promise<Object>} - Migration results
   */
  async migrateAllData(options = { force: false }) {
    try {
      Logger.info(LogCategory.DATABASE, 'Starting complete data migration', { options });
      
      // Reset migration stats
      this.migrationStats = {
        vendors: { total: 0, success: 0, errors: 0 },
        featuredDeals: { total: 0, success: 0, errors: 0 },
        user: { success: false, error: null, message: '' },
        favorites: { success: false, error: null, message: '' },
        visits: { success: false, error: null, message: '' },
        mockData: { total: 0, success: 0, errors: 0 }
      };
      
      // Check if data already exists
      const hasData = await this.hasExistingData();
      
      if (hasData && !options.force) {
        Logger.info(LogCategory.DATABASE, 'Data already exists, skipping migration');
        return { 
          success: false, 
          skipped: true, 
          message: 'Data already exists. Use force:true to override.' 
        };
      }
      
      // If force is true and data exists, clear data first
      if (hasData && options.force) {
        Logger.warn(LogCategory.DATABASE, 'Force mode enabled, clearing existing data');
        await this.clearAllData();
      }
      
      // Run each migration step with try/catch to prevent one failure from stopping the whole process
      let vendorsMigrated = false;
      let featuredDealsMigrated = false;
      
      // Migrate vendors
      await tryCatch(async () => {
        const vendorResult = await this.migrateVendors();
        vendorsMigrated = vendorResult.success > 0;
      }, LogCategory.DATABASE, 'migrating vendors', false);
      
      // Migrate featured deals
      await tryCatch(async () => {
        const dealsResult = await this.migrateFeaturedDeals();
        featuredDealsMigrated = dealsResult.success > 0;
      }, LogCategory.DATABASE, 'migrating featured deals', false);
      
      // Migrate user data
      await tryCatch(async () => {
        await this.migrateUserData();
      }, LogCategory.DATABASE, 'migrating user data', false);
      
      // Migrate favorites
      await tryCatch(async () => {
        await this.migrateFavorites();
      }, LogCategory.DATABASE, 'migrating favorites', false);
      
      // Migrate visits
      await tryCatch(async () => {
        await this.migrateVisits();
      }, LogCategory.DATABASE, 'migrating visits', false);
      
      // Initialize other collections
      await tryCatch(async () => {
        await this.initializeOtherCollections();
      }, LogCategory.DATABASE, 'initializing other collections', false);
      
      // Determine overall success - at minimum, we need vendors migrated
      const success = vendorsMigrated;
      
      // Mark migration as completed if successful
      if (success) {
        await AsyncStorage.setItem('firebase_migration_completed', 'true');
        Logger.info(LogCategory.DATABASE, 'Migration marked as completed');
      }
      
      Logger.info(LogCategory.DATABASE, 'Complete data migration finished', { 
        success,
        stats: this.migrationStats 
      });
      
      return {
        success,
        timestamp: new Date().toISOString(),
        ...this.migrationStats
      };
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error in complete data migration', { error });
      return {
        success: false,
        error: error.message,
        stats: this.migrationStats
      };
    }
  }
}

export default new FirebaseMigration();