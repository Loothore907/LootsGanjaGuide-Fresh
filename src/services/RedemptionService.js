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
   * Record a deal redemption
   * @param {string} vendorId - ID of the vendor
   * @param {string} dealType - Type of deal redeemed
   * @param {string} redemptionId - Unique ID for this redemption
   * @returns {Promise<boolean>} - Success status
   */
  async recordRedemption(vendorId, dealType, redemptionId) {
    try {
      // Get existing redemptions
      const redemptions = await this.getRedemptions();
      
      // Create new redemption record
      const newRedemption = {
        id: redemptionId || `${dealType}-${vendorId}-${Date.now()}`,
        vendorId,
        dealType,
        timestamp: new Date().toISOString()
      };
      
      Logger.info(LogCategory.REDEMPTION, 'Recording new redemption', {
        vendorId,
        dealType,
        redemptionId: newRedemption.id,
        timestamp: newRedemption.timestamp
      });
      
      // Add to list
      redemptions.push(newRedemption);
      
      // Save updated list
      await AsyncStorage.setItem(this.REDEMPTION_STORAGE_KEY, JSON.stringify(redemptions));
      
      Logger.debug(LogCategory.REDEMPTION, 'Redemption recorded successfully', {
        totalRedemptions: redemptions.length
      });
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.REDEMPTION, 'Error recording redemption', { 
        error,
        vendorId,
        dealType
      });
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
   * Check if a deal can be redeemed for a specific vendor
   * @param {string} vendorId - ID of the vendor
   * @param {string} dealType - Type of deal
   * @returns {Promise<boolean>} - Whether deal can be redeemed
   */
  async canRedeemDeal(vendorId, dealType) {
    try {
      // Get all redemptions
      const redemptions = await this.getRedemptions();
      
      Logger.debug(LogCategory.REDEMPTION, 'Checking if deal can be redeemed', {
        vendorId,
        dealType,
        totalRedemptions: redemptions.length
      });
      
      // For birthday deals, check if it's been redeemed today
      if (dealType === 'birthday') {
        const hasRedeemedToday = await this.hasRedeemedToday(vendorId, dealType);
        
        Logger.debug(LogCategory.REDEMPTION, `Birthday deal ${hasRedeemedToday ? 'cannot' : 'can'} be redeemed`, {
          vendorId,
          reason: hasRedeemedToday ? 'already redeemed today' : 'not redeemed today'
        });
        
        return !hasRedeemedToday;
      }
      
      // Get applicable rule for this deal type
      const rule = this.REDEMPTION_RULES[dealType] || this.REDEMPTION_RULES.standard;
      const periodMilliseconds = rule.periodHours * 60 * 60 * 1000;
      
      // Find redemptions for this vendor and deal type
      const vendorRedemptions = redemptions.filter(r => 
        r.vendorId === vendorId && r.dealType === dealType
      );
      
      // If no redemptions found, deal can be redeemed
      if (vendorRedemptions.length === 0) {
        Logger.debug(LogCategory.REDEMPTION, 'Deal can be redeemed - no previous redemptions', {
          vendorId,
          dealType
        });
        return true;
      }
      
      // Get most recent redemption
      const mostRecent = vendorRedemptions.reduce((latest, current) => {
        const currentDate = new Date(current.timestamp);
        const latestDate = new Date(latest.timestamp);
        return currentDate > latestDate ? current : latest;
      }, vendorRedemptions[0]);
      
      // Calculate time difference
      const now = new Date();
      const lastRedemptionDate = new Date(mostRecent.timestamp);
      const timeDiff = now - lastRedemptionDate;
      
      // Check if enough time has passed since last redemption
      const canRedeem = timeDiff > periodMilliseconds;
      
      Logger.debug(LogCategory.REDEMPTION, `Deal ${canRedeem ? 'can' : 'cannot'} be redeemed`, {
        vendorId,
        dealType,
        lastRedemption: lastRedemptionDate.toISOString(),
        hoursSince: Math.round(timeDiff / (60 * 60 * 1000)),
        requiredHours: rule.periodHours,
        reason: canRedeem ? 'enough time passed' : 'not enough time passed'
      });
      
      return canRedeem;
    } catch (error) {
      Logger.error(LogCategory.REDEMPTION, 'Error checking if deal can be redeemed', { error });
      return false; // Default to not redeemable in case of error
    }
  }

  /**
   * Filter vendors based on redemption rules
   * @param {Array} vendors - List of vendors to filter
   * @param {string} dealType - Type of deal to filter for
   * @returns {Promise<Array>} - Filtered list of vendors
   */
  async filterRedeemableVendors(vendors, dealType) {
    try {
      if (!vendors || !Array.isArray(vendors) || vendors.length === 0) {
        return [];
      }
      
      // Get all redemptions at once to avoid multiple async calls
      const allRedemptions = await this.getRedemptions();
      
      Logger.debug(LogCategory.REDEMPTION, 'Filtering vendors for redemption', {
        totalVendors: vendors.length,
        dealType,
        totalRedemptions: allRedemptions.length
      });
      
      const filteredVendors = [];
      
      // Get applicable rule for this deal type
      const rule = this.REDEMPTION_RULES[dealType] || this.REDEMPTION_RULES.standard;
      const periodMilliseconds = rule.periodHours * 60 * 60 * 1000;
      
      // Current time
      const now = new Date();
      
      // Process each vendor
      for (const vendor of vendors) {
        // First check if vendor has the deal type
        if (!this.vendorHasDealType(vendor, dealType)) {
          Logger.debug(LogCategory.REDEMPTION, 'Vendor excluded - does not have deal type', {
            vendorId: vendor.id,
            vendorName: vendor.name,
            dealType
          });
          continue;
        }
        
        // For birthday deals, we need to check if it's been redeemed today
        if (dealType === 'birthday') {
          const hasRedeemedToday = await this.hasRedeemedToday(vendor.id, dealType);
          if (hasRedeemedToday) {
            Logger.debug(LogCategory.REDEMPTION, 'Vendor excluded - birthday deal already redeemed today', {
              vendorId: vendor.id,
              vendorName: vendor.name
            });
            continue;
          }
          
          // Birthday deal not redeemed today, include vendor
          Logger.debug(LogCategory.REDEMPTION, 'Vendor included - birthday deal not redeemed today', {
            vendorId: vendor.id,
            vendorName: vendor.name
          });
          filteredVendors.push(vendor);
          continue;
        }
        
        // For other deal types, check redemption history
        // Find the most recent redemption for this vendor/deal combo
        const matchingRedemptions = allRedemptions.filter(r => 
          r.vendorId === vendor.id && r.dealType === dealType
        );
        
        if (matchingRedemptions.length === 0) {
          // No redemptions found, deal can be redeemed
          Logger.debug(LogCategory.REDEMPTION, 'Vendor included - no previous redemptions', {
            vendorId: vendor.id,
            vendorName: vendor.name,
            dealType
          });
          filteredVendors.push(vendor);
          continue;
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
        
        if (canRedeem) {
          Logger.debug(LogCategory.REDEMPTION, 'Vendor included - enough time passed since last redemption', {
            vendorId: vendor.id,
            vendorName: vendor.name,
            dealType,
            lastRedemption: lastRedemptionDate.toISOString(),
            hoursSince: Math.round(timeDiff / (60 * 60 * 1000)),
            requiredHours: rule.periodHours
          });
          filteredVendors.push(vendor);
        } else {
          Logger.debug(LogCategory.REDEMPTION, 'Vendor excluded - not enough time since last redemption', {
            vendorId: vendor.id,
            vendorName: vendor.name,
            dealType,
            lastRedemption: lastRedemptionDate.toISOString(),
            hoursSince: Math.round(timeDiff / (60 * 60 * 1000)),
            requiredHours: rule.periodHours
          });
        }
      }
      
      Logger.info(LogCategory.REDEMPTION, 'Vendor filtering complete', {
        totalVendors: vendors.length,
        includedVendors: filteredVendors.length,
        rejectedVendors: vendors.length - filteredVendors.length,
        dealType
      });
      
      return filteredVendors;
    } catch (error) {
      Logger.error(LogCategory.REDEMPTION, 'Error filtering redeemable vendors', { error });
      return vendors; // Return original list in case of error
    }
  }

  /**
   * Helper to check if vendor has a specific deal type available
   * @param {Object} vendor - Vendor object
   * @param {string} dealType - Type of deal
   * @returns {boolean} - Whether vendor has the deal
   */
  vendorHasDealType(vendor, dealType) {
    if (!vendor) return false;
    
    // Vendors from proximity query are guaranteed to have the deal type
    // since we queried for vendors with that specific deal type
    if (vendor.distance !== undefined || vendor.dealType === dealType) {
      return true;
    }
    
    // For vendors from other sources, check the deals property
    if (!vendor.deals) return false;
    
    switch (dealType) {
      case 'birthday':
        return !!vendor.deals.birthday;
      case 'daily':
        // Current day of week
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = daysOfWeek[new Date().getDay()];
        return vendor.deals.daily && 
               Array.isArray(vendor.deals.daily[currentDay]) && 
               vendor.deals.daily[currentDay].length > 0;
      case 'multi_day':
        // Current day of week
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = days[new Date().getDay()];
        // Check if any multi-day deals have today as an active day
        return vendor.deals.multi_day && 
               Array.isArray(vendor.deals.multi_day) && 
               vendor.deals.multi_day.some(deal => 
                 deal.activeDays && 
                 Array.isArray(deal.activeDays) && 
                 deal.activeDays.includes(today)
               );
      case 'special':
        // Check if there are any active special deals
        const now = new Date();
        const activeSpecials = vendor.deals.special?.filter(deal => {
          if (!deal.startDate || !deal.endDate) return true;
          const startDate = new Date(deal.startDate);
          const endDate = new Date(deal.endDate);
          return now >= startDate && now <= endDate;
        }) || [];
        return activeSpecials.length > 0;
      case 'everyday':
        return vendor.deals.everyday && vendor.deals.everyday.length > 0;
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

  /**
   * Get statistics on redemption activity
   * @returns {Object} Stats on redemption activity
   */
  async getRedemptionStats() {
    try {
      const redemptions = await this.getRedemptions();
      const now = new Date();
      
      // Get current day boundaries
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const todayEnd = todayStart + 24 * 60 * 60 * 1000;
      
      // Get current week boundaries
      const dayOfWeek = now.getDay();
      const weekStart = new Date(todayStart - dayOfWeek * 24 * 60 * 60 * 1000).getTime();
      const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
      
      // Get current month boundaries
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime() + 24 * 60 * 60 * 1000;
      
      // Filter redemptions by time periods
      const todayRedemptions = redemptions.filter(r => {
        const timestamp = new Date(r.timestamp).getTime();
        return timestamp >= todayStart && timestamp < todayEnd;
      });
      
      const weekRedemptions = redemptions.filter(r => {
        const timestamp = new Date(r.timestamp).getTime();
        return timestamp >= weekStart && timestamp < weekEnd;
      });
      
      const monthRedemptions = redemptions.filter(r => {
        const timestamp = new Date(r.timestamp).getTime();
        return timestamp >= monthStart && timestamp < monthEnd;
      });
      
      // Calculate unique vendors for each period
      const getUniqueVendors = (redeemList) => {
        return new Set(redeemList.map(r => r.vendorId)).size;
      };
      
      return {
        today: {
          count: todayRedemptions.length,
          uniqueVendors: getUniqueVendors(todayRedemptions)
        },
        week: {
          count: weekRedemptions.length,
          uniqueVendors: getUniqueVendors(weekRedemptions)
        },
        month: {
          count: monthRedemptions.length,
          uniqueVendors: getUniqueVendors(monthRedemptions)
        },
        total: {
          count: redemptions.length,
          uniqueVendors: getUniqueVendors(redemptions)
        }
      };
    } catch (error) {
      Logger.error(LogCategory.REDEMPTION, 'Error generating redemption stats', { error });
      // Return empty stats if there's an error
      return {
        today: { count: 0, uniqueVendors: 0 },
        week: { count: 0, uniqueVendors: 0 },
        month: { count: 0, uniqueVendors: 0 },
        total: { count: 0, uniqueVendors: 0 }
      };
    }
  }

  /**
   * Check if a deal has been redeemed today for a specific vendor
   * @param {string} vendorId - ID of the vendor
   * @param {string} dealType - Type of deal
   * @returns {Promise<boolean>} - Whether deal was redeemed today
   */
  async hasRedeemedToday(vendorId, dealType) {
    try {
      // Get all redemptions
      const redemptions = await this.getRedemptions();
      
      // Get today's date boundaries
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const todayEnd = todayStart + 24 * 60 * 60 * 1000;
      
      Logger.debug(LogCategory.REDEMPTION, 'Checking for today\'s redemptions', { 
        vendorId, 
        dealType,
        totalRedemptions: redemptions.length,
        todayStart: new Date(todayStart).toISOString(),
        todayEnd: new Date(todayEnd).toISOString()
      });
      
      // Find any redemptions for this vendor and deal type today
      const todayRedemptions = redemptions.filter(r => {
        if (r.vendorId !== vendorId || r.dealType !== dealType) return false;
        
        const timestamp = new Date(r.timestamp).getTime();
        const isToday = timestamp >= todayStart && timestamp < todayEnd;
        
        if (isToday) {
          Logger.debug(LogCategory.REDEMPTION, 'Found redemption from today', {
            vendorId,
            dealType,
            redemptionTime: new Date(timestamp).toISOString()
          });
        }
        
        return isToday;
      });
      
      const hasRedeemed = todayRedemptions.length > 0;
      
      Logger.debug(LogCategory.REDEMPTION, `Deal ${hasRedeemed ? 'has' : 'has not'} been redeemed today`, {
        vendorId,
        dealType,
        redemptionsToday: todayRedemptions.length
      });
      
      return hasRedeemed;
    } catch (error) {
      Logger.error(LogCategory.REDEMPTION, 'Error checking for today\'s redemptions', { error });
      return false; // Default to not redeemed in case of error
    }
  }
}

// Create and export a singleton instance
const redemptionService = new RedemptionService();
export default redemptionService;