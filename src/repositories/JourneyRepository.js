// src/repositories/JourneyRepository.js
import { BaseRepository } from './index';
import { firestore, serverTimestamp, increment } from '../config/firebase';
import { Logger, LogCategory } from '../services/LoggingService';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  runTransaction
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VendorRepository from './VendorRepository';
import UserRepository from './UserRepository';

/**
 * Repository for journey-related Firestore operations
 */
class JourneyRepository extends BaseRepository {
  constructor() {
    super('journeys');
    this.vendorRepository = VendorRepository;
    this.userRepository = UserRepository;
    this.journeyStatsCollection = collection(firestore, 'journey_stats');
  }

  /**
   * Create a new journey
   * @param {Object} journeyData - Journey data
   * @param {string} journeyData.dealType - Type of deals being pursued (birthday, daily, special)
   * @param {Array} journeyData.vendors - Array of vendors in the journey
   * @param {number} journeyData.maxDistance - Maximum distance for the journey in miles
   * @param {Object} journeyData.startLocation - Starting location coordinates
   * @returns {Promise<Object>} - Created journey data
   */
  async createJourney(journeyData) {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be authenticated to create a journey');
      }
      
      Logger.info(LogCategory.JOURNEY, 'Creating new journey', { userId, journeyData });
      
      // Create consistent vendor structure with check-in status
      const vendors = journeyData.vendors.map(vendor => ({
        id: vendor.id,
        name: vendor.name,
        location: vendor.location,
        distance: vendor.distance,
        checkedIn: false,
        checkInTimestamp: null,
        checkInType: null
      }));
      
      // Create journey object
      const journey = {
        userId,
        dealType: journeyData.dealType,
        vendors,
        currentVendorIndex: 0,
        maxDistance: journeyData.maxDistance,
        totalVendors: vendors.length,
        startLocation: journeyData.startLocation || null,
        isActive: true,
        isCompleted: false,
        completedAt: null,
        totalDistance: journeyData.totalDistance || 0,
        estimatedTime: journeyData.estimatedTime || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Create the journey document in Firestore
      const journeyId = await this.create(journey);
      
      // Store active journey ID in AsyncStorage for quick access
      await AsyncStorage.setItem('active_journey_id', journeyId);
      
      // Get the created journey with ID
      const createdJourney = await this.getById(journeyId);
      
      return createdJourney;
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error creating journey', { error, journeyData });
      throw error;
    }
  }

  /**
   * Update journey progress
   * @param {string} journeyId - Journey ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} - Updated journey data
   */
  async updateJourney(journeyId, updateData) {
    try {
      Logger.info(LogCategory.JOURNEY, 'Updating journey', { journeyId, updateData });
      
      // Add updated timestamp
      const dataWithTimestamp = {
        ...updateData,
        updatedAt: serverTimestamp()
      };
      
      await this.update(journeyId, dataWithTimestamp);
      
      // Get updated journey
      return await this.getById(journeyId);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error updating journey', { error, journeyId, updateData });
      throw error;
    }
  }

  /**
   * Get the current active journey for the user
   * @returns {Promise<Object|null>} - Active journey or null if none exists
   */
  async getActiveJourney() {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) {
        return null;
      }
      
      // Try to get from AsyncStorage first for faster access
      const activeJourneyId = await AsyncStorage.getItem('active_journey_id');
      
      if (activeJourneyId) {
        const journey = await this.getById(activeJourneyId);
        
        // Verify it's still active and belongs to this user
        if (journey && journey.isActive && journey.userId === userId) {
          return journey;
        }
        
        // Clear invalid journey ID from storage
        await AsyncStorage.removeItem('active_journey_id');
      }
      
      // Query Firestore for active journeys
      const q = query(
        this.collectionRef,
        where('userId', '==', userId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const journey = {
        id: querySnapshot.docs[0].id,
        ...querySnapshot.docs[0].data()
      };
      
      // Save ID to AsyncStorage for future quick access
      await AsyncStorage.setItem('active_journey_id', journey.id);
      
      return this.normalizeTimestamps(journey);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error getting active journey', { error });
      throw error;
    }
  }

  /**
   * Check in at a vendor during a journey
   * @param {string} journeyId - Journey ID
   * @param {number} vendorIndex - Index of vendor in journey
   * @param {string} checkInType - Type of check-in (qr, location, manual)
   * @returns {Promise<Object>} - Updated journey with check-in info
   */
  async checkInAtVendor(journeyId, vendorIndex, checkInType = 'qr') {
    try {
      Logger.info(LogCategory.JOURNEY, 'Checking in at vendor during journey', {
        journeyId,
        vendorIndex,
        checkInType
      });
      
      const journeyRef = doc(this.collectionRef, journeyId);
      
      // Use a transaction to ensure atomic updates
      const result = await runTransaction(firestore, async (transaction) => {
        // Get current journey
        const journeyDoc = await transaction.get(journeyRef);
        
        if (!journeyDoc.exists()) {
          throw new Error(`Journey with ID ${journeyId} not found`);
        }
        
        const journey = journeyDoc.data();
        
        // Validate vendor index
        if (vendorIndex < 0 || vendorIndex >= journey.vendors.length) {
          throw new Error('Invalid vendor index');
        }
        
        // Check if already checked in
        if (journey.vendors[vendorIndex].checkedIn) {
          return {
            ...journey,
            id: journeyId,
            alreadyCheckedIn: true
          };
        }
        
        // Get vendor ID
        const vendorId = journey.vendors[vendorIndex].id;
        
        // Calculate points to award based on check-in type and journey progress
        const basePoints = 10;
        const journeyMultiplier = journey.totalVendors > 1 ? 1.5 : 1;
        const pointsEarned = Math.round(basePoints * journeyMultiplier);
        
        // Update vendor check-in status in journey
        const updatedVendors = [...journey.vendors];
        updatedVendors[vendorIndex] = {
          ...updatedVendors[vendorIndex],
          checkedIn: true,
          checkInTimestamp: serverTimestamp(),
          checkInType
        };
        
        // Update journey document
        transaction.update(journeyRef, {
          vendors: updatedVendors,
          updatedAt: serverTimestamp()
        });
        
        // If this is the last vendor, mark journey as completed
        const allCheckedIn = updatedVendors.every(vendor => vendor.checkedIn);
        
        if (allCheckedIn) {
          const completionBonus = updatedVendors.length * 5; // 5 points per vendor as completion bonus
          
          transaction.update(journeyRef, {
            isCompleted: true,
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          // Increment journey stats
          const journeyStatsRef = doc(this.journeyStatsCollection, journey.userId);
          transaction.set(journeyStatsRef, {
            userId: journey.userId,
            completedJourneys: increment(1),
            totalVendorsVisited: increment(updatedVendors.length),
            lastCompletedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        
        // Call vendor check-in via the transaction
        const checkInRef = doc(collection(firestore, 'check_ins'));
        transaction.set(checkInRef, {
          userId: journey.userId,
          vendorId,
          journeyId,
          vendorIndex,
          timestamp: serverTimestamp(),
          type: checkInType,
          isJourneyCheckIn: true,
          pointsEarned
        });
        
        // Return updated journey
        return {
          ...journey,
          id: journeyId,
          vendors: updatedVendors.map(vendor => ({
            ...vendor,
            checkInTimestamp: vendor.checkInTimestamp 
              ? (vendor.checkInTimestamp.toDate?.() 
                ? vendor.checkInTimestamp.toDate().toISOString() 
                : vendor.checkInTimestamp) 
              : null
          })),
          pointsEarned,
          allCheckedIn
        };
      });
      
      // After transaction completes, update user points asynchronously
      // (not part of the transaction to avoid cross-collection issues)
      if (!result.alreadyCheckedIn) {
        // Award points for the check-in
        await this.userRepository.updatePoints(
          result.pointsEarned,
          'journey-check-in',
          {
            journeyId,
            vendorIndex,
            vendorId: result.vendors[vendorIndex].id,
            vendorName: result.vendors[vendorIndex].name
          }
        );
        
        // If journey completed, award completion bonus
        if (result.allCheckedIn) {
          const completionBonus = result.vendors.length * 5;
          await this.userRepository.updatePoints(
            completionBonus,
            'journey-completion',
            {
              journeyId,
              vendorCount: result.vendors.length
            }
          );
        }
      }
      
      return result;
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error checking in at vendor during journey', {
        error,
        journeyId,
        vendorIndex
      });
      throw error;
    }
  }

  /**
   * Complete a journey (end early or mark as done)
   * @param {string} journeyId - Journey ID
   * @returns {Promise<boolean>} - Success status
   */
  async completeJourney(journeyId) {
    try {
      Logger.info(LogCategory.JOURNEY, 'Completing journey', { journeyId });
      
      const journey = await this.getById(journeyId);
      
      if (!journey) {
        throw new Error(`Journey with ID ${journeyId} not found`);
      }
      
      // Count checked-in vendors
      const checkedInCount = journey.vendors.filter(v => v.checkedIn).length;
      
      // Mark journey as completed
      await this.update(journeyId, {
        isActive: false,
        isCompleted: true,
        completedAt: serverTimestamp()
      });
      
      // Clear active journey from AsyncStorage
      await AsyncStorage.removeItem('active_journey_id');
      
      // Update journey stats
      const journeyStatsRef = doc(this.journeyStatsCollection, journey.userId);
      await setDoc(journeyStatsRef, {
        userId: journey.userId,
        completedJourneys: increment(1),
        totalVendorsVisited: increment(checkedInCount),
        lastCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Award completion bonus if not already checked in to all vendors
      if (checkedInCount > 0 && checkedInCount < journey.vendors.length) {
        const completionBonus = checkedInCount * 3; // 3 points per vendor visited
        
        await this.userRepository.updatePoints(
          completionBonus,
          'journey-partial-completion',
          {
            journeyId,
            vendorsVisited: checkedInCount,
            totalVendors: journey.vendors.length
          }
        );
      }
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error completing journey', { error, journeyId });
      throw error;
    }
  }

  /**
   * Cancel a journey
   * @param {string} journeyId - Journey ID
   * @returns {Promise<boolean>} - Success status
   */
  async cancelJourney(journeyId) {
    try {
      Logger.info(LogCategory.JOURNEY, 'Cancelling journey', { journeyId });
      
      const journey = await this.getById(journeyId);
      
      if (!journey) {
        throw new Error(`Journey with ID ${journeyId} not found`);
      }
      
      // Update journey status
      await this.update(journeyId, {
        isActive: false,
        isCancelled: true,
        cancelledAt: serverTimestamp()
      });
      
      // Clear active journey from AsyncStorage
      await AsyncStorage.removeItem('active_journey_id');
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error cancelling journey', { error, journeyId });
      throw error;
    }
  }

  /**
   * Advance to the next vendor in the journey
   * @param {string} journeyId - Journey ID
   * @returns {Promise<Object>} - Updated journey
   */
  async nextVendor(journeyId) {
    try {
      Logger.info(LogCategory.JOURNEY, 'Advancing to next vendor', { journeyId });
      
      const journey = await this.getById(journeyId);
      
      if (!journey) {
        throw new Error(`Journey with ID ${journeyId} not found`);
      }
      
      // Check if already at the last vendor
      if (journey.currentVendorIndex >= journey.vendors.length - 1) {
        return journey; // Already at the last vendor
      }
      
      // Update current vendor index
      await this.update(journeyId, {
        currentVendorIndex: journey.currentVendorIndex + 1
      });
      
      // Get updated journey
      return await this.getById(journeyId);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error advancing to next vendor', { error, journeyId });
      throw error;
    }
  }

  /**
   * Skip a vendor in the journey
   * @param {string} journeyId - Journey ID
   * @param {number} vendorIndex - Index of vendor to skip (defaults to current)
   * @returns {Promise<Object>} - Updated journey
   */
  async skipVendor(journeyId, vendorIndex = null) {
    try {
      const journey = await this.getById(journeyId);
      
      if (!journey) {
        throw new Error(`Journey with ID ${journeyId} not found`);
      }
      
      // Use provided index or current index
      const indexToSkip = vendorIndex !== null ? vendorIndex : journey.currentVendorIndex;
      
      Logger.info(LogCategory.JOURNEY, 'Skipping vendor in journey', {
        journeyId,
        vendorIndex: indexToSkip
      });
      
      // Validate vendor index
      if (indexToSkip < 0 || indexToSkip >= journey.vendors.length) {
        throw new Error('Invalid vendor index');
      }
      
      // Remove vendor from the journey
      const updatedVendors = journey.vendors.filter((_, index) => index !== indexToSkip);
      
      // Adjust currentVendorIndex if necessary
      let newCurrentIndex = journey.currentVendorIndex;
      if (indexToSkip < journey.currentVendorIndex) {
        // If skipping a vendor before the current one, decrement the index
        newCurrentIndex--;
      } else if (indexToSkip === journey.currentVendorIndex && newCurrentIndex >= updatedVendors.length) {
        // If skipping the current vendor and it was the last one, adjust to the new last index
        newCurrentIndex = Math.max(0, updatedVendors.length - 1);
      }
      
      // Update journey
      await this.update(journeyId, {
        vendors: updatedVendors,
        totalVendors: updatedVendors.length,
        currentVendorIndex: newCurrentIndex
      });
      
      // Get updated journey
      return await this.getById(journeyId);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error skipping vendor', { error, journeyId, vendorIndex });
      throw error;
    }
  }

  /**
   * Get recent journeys for the current user
   * @param {number} limit - Maximum number of journeys to return
   * @returns {Promise<Array>} - Array of recent journeys
   */
  async getRecentJourneys(limit = 5) {
    try {
      const userId = this.getCurrentUserId();
      
      if (!userId) {
        return [];
      }
      
      Logger.info(LogCategory.JOURNEY, 'Getting recent journeys', { userId, limit });
      
      // Query for recent journeys, completed first then active
      const q = query(
        this.collectionRef,
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(limit)
      );
      
      const querySnapshot = await getDocs(q);
      const journeys = [];
      
      querySnapshot.forEach(doc => {
        journeys.push(this.normalizeTimestamps({
          id: doc.id,
          ...doc.data()
        }));
      });
      
      return journeys;
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error getting recent journeys', { error });
      throw error;
    }
  }

  /**
   * Get journey statistics for the current user
   * @returns {Promise<Object>} - Journey statistics
   */
  async getJourneyStats() {
    try {
      const userId = this.getCurrentUserId();
      
      if (!userId) {
        return {
          completedJourneys: 0,
          totalVendorsVisited: 0,
          lastCompletedAt: null
        };
      }
      
      // Get journey stats
      const journeyStatsRef = doc(this.journeyStatsCollection, userId);
      const journeyStatsSnap = await getDoc(journeyStatsRef);
      
      if (!journeyStatsSnap.exists()) {
        return {
          completedJourneys: 0,
          totalVendorsVisited: 0,
          lastCompletedAt: null
        };
      }
      
      return this.normalizeTimestamps(journeyStatsSnap.data());
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error getting journey stats', { error });
      throw error;
    }
  }
}

// Export as default
export default new JourneyRepository();