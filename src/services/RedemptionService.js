// First, create a new service for tracking redemptions
// src/services/RedemptionService.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from './LoggingService';

/**
 * Service to handle tracking and verification of deal redemptions
 */
class RedemptionService {
  constructor() {
    this.REDEMPTION_STORAGE_KEY = 'deal_redemptions';
    this.REDEMPTION_RULES = {
      'birthday': { periodHours: 24 * 365 }, // Once per year
      'daily': { periodHours: 24 }, // Once per day
      'special': { periodHours: 24 }, // Default to once per day unless override
      'standard': { periodHours: 24 } // Default for non-specific deals
    };
  }

  /**
   * Records a deal redemption
   * @param {string} vendorId - ID of the vendor
   * @param {string} dealType - Type of deal (birthday, daily, special)
   * @param {string} redemptionId - Unique ID for this redemption
   * @returns {Promise<boolean>} - Whether redemption was recorded
   */
  async recordRedemption(vendorId, dealType, redemptionId) {
    try {
      // Get existing redemptions
      const redemptions = await this.getRedemptions();
      
      // Add new redemption with timestamp
      redemptions.push({
        id: redemptionId,
        vendorId,
        dealType,
        timestamp: new Date().toISOString()
      });
      
      // Save back to storage
      await AsyncStorage.setItem(this.REDEMPTION_STORAGE_KEY, JSON.stringify(redemptions));
      
      Logger.info(LogCategory.REDEMPTION, 'Deal redemption recorded', {
        vendorId,
        dealType,
        redemptionId
      });
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.REDEMPTION, 'Failed to record redemption', { error });
      return false;
    }
  }

  /**
   * Get all recorded redemptions
   * @returns {Promise<Array>} - List of all redemptions
   */
  async getRedemptions() {
    try {
      const redemptionsJSON = await AsyncStorage.getItem(this.REDEMPTION_STORAGE_KEY);
      return redemptionsJSON ? JSON.parse(redemptionsJSON) : [];
    } catch (error) {
      Logger.error(LogCategory.REDEMPTION, 'Failed to get redemptions', { error });
      return [];
    }
  }

  /**
   * Check if a deal has been redeemed within its allowable period
   * @param {string} vendorId - ID of the vendor
   * @param {string} dealType - Type of deal
   * @returns {Promise<boolean>} - Whether deal is redeemable
   */
  async canRedeemDeal(vendorId, dealType) {
    try {
      // Get all redemptions
      const redemptions = await this.getRedemptions();
      
      // Get applicable rule for this deal type
      const rule = this.REDEMPTION_RULES[dealType] || this.REDEMPTION_RULES.standard;
      const periodMilliseconds = rule.periodHours * 60 * 60 * 1000;
      
      // Current time
      const now = new Date();
      
      // Find the most recent redemption for this vendor/deal combo
      const matchingRedemptions = redemptions.filter(r => 
        r.vendorId === vendorId && r.dealType === dealType
      );
      
      if (matchingRedemptions.length === 0) {
        return true; // No redemptions found, deal can be redeemed
      }
      
      // Get most recent redemption
      const mostRecent = matchingRedemptions.reduce((latest, current) => {
        const currentDate = new Date(current.timestamp);
        const latestDate = new Date(latest.timestamp);
        return currentDate > latestDate ? current : latest;
      }, matchingRedemptions[0]);
      
      // Calculate time difference
      const lastRedemptionDate = new Date(mostRecent.timestamp);
      const timeDiff = now - lastRedemptionDate;
      
      // Check if enough time has passed since last redemption
      const canRedeem = timeDiff > periodMilliseconds;

      if (!canRedeem) {
        const hoursLeft = Math.ceil((periodMilliseconds - timeDiff) / (60 * 60 * 1000));
        Logger.info(LogCategory.REDEMPTION, 'Deal redemption blocked due to recent use', {
          vendorId,
          dealType,
          lastRedemption: lastRedemptionDate,
          hoursRemaining: hoursLeft
        });
      }

      return canRedeem;
    } catch (error) {
      Logger.error(LogCategory.REDEMPTION, 'Error checking redemption eligibility', { error });
      return true; // On error, default to allowing redemption
    }
  }

  /**
   * Filter a list of vendors to only include those with redeemable deals
   * @param {Array} vendors - List of vendor objects
   * @param {string} dealType - Type of deal being searched for
   * @returns {Promise<Array>} - Filtered vendors list
   */
  async filterRedeemableVendors(vendors, dealType) {
    if (!vendors || vendors.length === 0) {
      return [];
    }
    
    const filteredVendors = [];
    
    for (const vendor of vendors) {
      // Skip if vendor doesn't have applicable deal
      if (!this.vendorHasDealType(vendor, dealType)) {
        continue;
      }

      // Check if deal is redeemable
      const canRedeem = await this.canRedeemDeal(vendor.id, dealType);
      
      if (canRedeem) {
        filteredVendors.push(vendor);
      } else {
        Logger.info(LogCategory.JOURNEY, 'Vendor filtered due to recent redemption', {
          vendorId: vendor.id,
          vendorName: vendor.name,
          dealType
        });
      }
    }
    
    return filteredVendors;
  }

  /**
   * Helper to check if vendor has a specific deal type available
   * @param {Object} vendor - Vendor object
   * @param {string} dealType - Type of deal
   * @returns {boolean} - Whether vendor has the deal
   */
  vendorHasDealType(vendor, dealType) {
    if (!vendor || !vendor.deals) return false;
    
    switch (dealType) {
      case 'birthday':
        return !!vendor.deals.birthday;
      case 'daily':
        // Current day of week
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = daysOfWeek[new Date().getDay()];
        return vendor.deals.daily && Array.isArray(vendor.deals.daily[currentDay]) && vendor.deals.daily[currentDay].length > 0;
      case 'special':
        // Check if there are any active special deals
        return vendor.deals.special && Array.isArray(vendor.deals.special) && vendor.deals.special.length > 0;
      default:
        return false;
    }
  }

  /**
   * Clear all redemption history (for testing/debugging)
   */
  async clearRedemptionHistory() {
    try {
      await AsyncStorage.removeItem(this.REDEMPTION_STORAGE_KEY);
      Logger.info(LogCategory.REDEMPTION, 'Redemption history cleared');
      return true;
    } catch (error) {
      Logger.error(LogCategory.REDEMPTION, 'Failed to clear redemption history', { error });
      return false;
    }
  }
}

// Create and export a singleton instance
const redemptionService = new RedemptionService();
export default redemptionService;