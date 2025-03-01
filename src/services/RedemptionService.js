// First, create a new service for tracking redemptions
// src/services/RedemptionService.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from './LoggingService';

class RedemptionService {
  constructor() {
    this.storageKey = 'deal_redemptions';
  }
  
  /**
   * Get all redemptions for the current user
   * @returns {Promise<Array>} - List of redemptions
   */
  async getAllRedemptions() {
    try {
      const redemptionsJson = await AsyncStorage.getItem(this.storageKey);
      return redemptionsJson ? JSON.parse(redemptionsJson) : [];
    } catch (error) {
      Logger.error(LogCategory.STORAGE, 'Error getting redemptions', { error });
      return [];
    }
  }
  
  /**
   * Record a new deal redemption
   * @param {string} vendorId - Vendor ID
   * @param {string} dealType - Type of deal (birthday, daily, special)
   * @param {string} dealId - ID of the deal
   * @returns {Promise<boolean>} - Success status
   */
  async recordRedemption(vendorId, dealType, dealId) {
    try {
      const redemptions = await this.getAllRedemptions();
      
      const newRedemption = {
        vendorId,
        dealType,
        dealId,
        timestamp: new Date().toISOString(),
        // Add a unique ID for the redemption
        id: `${vendorId}-${dealType}-${dealId}-${Date.now()}`
      };
      
      redemptions.push(newRedemption);
      
      // Save updated redemptions
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(redemptions));
      
      Logger.info(LogCategory.DEALS, 'Recorded deal redemption', { 
        vendorId, dealType, dealId 
      });
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.STORAGE, 'Error recording redemption', { error });
      return false;
    }
  }
  
  /**
   * Check if a user has already redeemed a deal today
   * @param {string} vendorId - Vendor ID
   * @param {string} dealType - Type of deal
   * @param {string} dealId - ID of the deal (optional)
   * @returns {Promise<boolean>} - True if already redeemed today
   */
  async hasRedeemedToday(vendorId, dealType, dealId = null) {
    try {
      const redemptions = await this.getAllRedemptions();
      const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD
      
      const hasRedeemedToday = redemptions.some(redemption => {
        // Check if redemption was today
        const redemptionDate = new Date(redemption.timestamp).toISOString().split('T')[0];
        
        // If dealId is provided, check exact deal, otherwise check vendor+type
        if (dealId) {
          return redemption.vendorId === vendorId && 
                 redemption.dealType === dealType &&
                 redemption.dealId === dealId &&
                 redemptionDate === today;
        } else {
          return redemption.vendorId === vendorId && 
                 redemption.dealType === dealType &&
                 redemptionDate === today;
        }
      });
      
      // For debugging, log what was found
      Logger.debug(LogCategory.DEALS, `Checking redemption for ${vendorId} (${dealType})`, { 
        hasRedeemedToday,
        vendorId,
        dealType,
        dealId,
        redemptionsCount: redemptions.length
      });
      
      return hasRedeemedToday;
    } catch (error) {
      Logger.error(LogCategory.STORAGE, 'Error checking redemptions', { error });
      return false; // Default to false in case of error
    }
  }
  
  /**
   * Get redemption statistics
   * @returns {Promise<Object>} - Stats object
   */
  async getRedemptionStats() {
    try {
      const redemptions = await this.getAllRedemptions();
      
      // Get dates for filtering
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      // Filter by periods
      const todayRedemptions = redemptions.filter(r => r.timestamp >= todayStart);
      const weekRedemptions = redemptions.filter(r => r.timestamp >= weekStart.toISOString());
      const monthRedemptions = redemptions.filter(r => r.timestamp >= monthStart);
      
      // Count unique vendors
      const uniqueVendorsToday = new Set(todayRedemptions.map(r => r.vendorId)).size;
      const uniqueVendorsWeek = new Set(weekRedemptions.map(r => r.vendorId)).size;
      const uniqueVendorsMonth = new Set(monthRedemptions.map(r => r.vendorId)).size;
      const uniqueVendorsTotal = new Set(redemptions.map(r => r.vendorId)).size;
      
      return {
        today: {
          count: todayRedemptions.length,
          uniqueVendors: uniqueVendorsToday
        },
        week: {
          count: weekRedemptions.length,
          uniqueVendors: uniqueVendorsWeek
        },
        month: {
          count: monthRedemptions.length,
          uniqueVendors: uniqueVendorsMonth
        },
        total: {
          count: redemptions.length,
          uniqueVendors: uniqueVendorsTotal
        }
      };
    } catch (error) {
      Logger.error(LogCategory.STORAGE, 'Error getting redemption stats', { error });
      return {
        today: { count: 0, uniqueVendors: 0 },
        week: { count: 0, uniqueVendors: 0 },
        month: { count: 0, uniqueVendors: 0 },
        total: { count: 0, uniqueVendors: 0 }
      };
    }
  }
}

// Create and export a singleton instance
const redemptionService = new RedemptionService();
export default redemptionService;