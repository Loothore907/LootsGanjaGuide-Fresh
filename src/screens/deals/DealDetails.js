// src/screens/deals/DealDetails.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Share,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { 
  Text, 
  Button, 
  Card, 
  Icon, 
  Divider,
  ListItem
} from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import redemptionService from '../../services/RedemptionService';

/**
 * Deal Details Screen
 * 
 * Shows detailed information about a specific deal
 * Allows users to view related vendor info and create a journey
 * Supports sharing deals with others
 */
const DealDetails = ({ route, navigation }) => {
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  const [deal, setDeal] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [redeemable, setRedeemable] = useState(true);
  
  // Get deal and vendor IDs from route params
  const { dealId, vendorId, dealType } = route.params || {};
  
  // Load deal and vendor data
  useEffect(() => {
    loadDealData();
  }, [dealId, vendorId]);
  
  // Check if deal is redeemable
  useEffect(() => {
    if (vendor && dealType) {
      checkRedemptionStatus();
    }
  }, [vendor, dealType]);
  
  const loadDealData = async () => {
    setIsLoading(true);
    
    try {
      await tryCatch(async () => {
        // In a real app, fetch deal data from API
        // For now, use mock data from params or generate it
        
        // If we have complete deal data from navigation params
        if (route.params?.deal) {
          setDeal(route.params.deal);
        } else {
          // Otherwise, construct minimal deal data
          setDeal({
            id: dealId,
            title: route.params?.title || 'Deal Details',
            description: route.params?.description || 'No description available',
            discount: route.params?.discount || 'Special Offer',
            restrictions: route.params?.restrictions || [],
            dealType: dealType || 'standard',
            vendorId: vendorId
          });
        }
        
        // Get vendor data
        // In a real app, call API service
        // For this demo, use findVendorById to get from state
        const vendorData = findVendorById(vendorId);
        if (vendorData) {
          setVendor(vendorData);
        } else {
          Logger.warn(LogCategory.DEALS, 'Vendor not found for deal', { vendorId });
        }
        
        Logger.info(LogCategory.DEALS, 'Loaded deal details', {
          dealId,
          vendorId,
          dealType
        });
      }, LogCategory.DEALS, 'loading deal details', true);
    } catch (error) {
      // Error already logged by tryCatch
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to find vendor in state
  const findVendorById = (id) => {
    if (!id) return null;
    
    // Check vendors list in state
    if (state.vendorData && state.vendorData.list) {
      const vendor = state.vendorData.list.find(v => v.id === id);
      if (vendor) return vendor;
    }
    
    // Check journey vendors
    if (state.journey && state.journey.vendors) {
      const vendor = state.journey.vendors.find(v => v.id === id);
      if (vendor) return vendor;
    }
    
    // Return mock vendor data if not found
    return {
      id: id,
      name: 'Unknown Vendor',
      location: {
        address: 'Address unavailable',
        coordinates: {
          latitude: 61.2175,
          longitude: -149.8584
        }
      },
      distance: 1.0,
      isPartner: false
    };
  };
  
  // Check if deal can be redeemed today
  const checkRedemptionStatus = async () => {
    try {
      const canRedeem = await redemptionService.canRedeemDeal(vendor.id, dealType);
      setRedeemable(canRedeem);
      
      if (!canRedeem) {
        Logger.info(LogCategory.REDEMPTION, 'Deal not redeemable', {
          vendorId: vendor.id,
          dealType
        });
      }
    } catch (error) {
      Logger.error(LogCategory.REDEMPTION, 'Error checking redemption status', { error });
      // Default to true if check fails
      setRedeemable(true);
    }
  };
  
  // Create a journey for this deal only
  const handleCreateJourney = async () => {
    if (!deal || !vendor) return;
    
    setIsLoading(true);
    
    try {
      await tryCatch(async () => {
        // For a single vendor, we just create a simple journey
        const journeyData = {
          dealType: deal.dealType || 'standard',
          vendors: [{
            ...vendor,
            checkedIn: false,
            checkInType: null
          }],
          currentVendorIndex: 0,
          totalVendors: 1,
          maxDistance: 25, // Default
          isActive: true
        };
        
        // Update app state with journey
        dispatch(AppActions.startJourney(journeyData));
        
        // Update route information
        dispatch(AppActions.updateRoute({
          coordinates: [vendor.location.coordinates],
          totalDistance: vendor.distance || 0,
          estimatedTime: Math.round((vendor.distance || 0) * 3) // 3 min per mile
        }));
        
        Logger.info(LogCategory.JOURNEY, 'Created single-vendor journey', {
          dealType: deal.dealType,
          vendorName: vendor.name
        });
        
        // Navigate to route preview
        navigation.navigate('RoutePreview');
      }, LogCategory.JOURNEY, 'creating single-vendor journey', true);
    } catch (error) {
      // Error already logged by tryCatch
    } finally {
      setIsLoading(false);
    }
  };
  
  // Navigate to vendor profile
  const handleViewVendor = () => {
    if (!vendor) return;
    navigation.navigate('VendorProfile', { vendorId: vendor.id });
  };
  
  // Share this deal
  const handleShareDeal = async () => {
    if (!deal || !vendor) return;
    
    try {
      // Prepare share message
      const shareMessage = `Check out this great deal at ${vendor.name}: ${deal.discount} - ${deal.description}. Find it on Loot's Ganja Guide!`;
      
      const result = await Share.share({
        message: shareMessage,
        title: `${vendor.name} Deal`
      });
      
      if (result.action === Share.sharedAction) {
        Logger.info(LogCategory.DEALS, 'Deal shared', {
          dealId: deal.id,
          platform: result.activityType || 'unknown'
        });
      }
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error sharing deal', { error });
      Alert.alert('Error', 'Could not share this deal. Please try again.');
    }
  };
  
  // Get appropriate icon for deal type
  const getDealTypeIcon = () => {
    switch (deal?.dealType) {
      case 'birthday':
        return 'cake';
      case 'daily':
        return 'today';
      case 'special':
        return 'star';
      default:
        return 'local-offer';
    }
  };
  
  // Formatted deal type for display
  const getFormattedDealType = () => {
    switch (deal?.dealType) {
      case 'birthday':
        return 'Birthday Deal';
      case 'daily':
        return 'Daily Deal';
      case 'special':
        return 'Special Offer';
      default:
        return 'Special Deal';
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading deal details...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Error state
  if (!deal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" type="material" size={64} color="#F44336" />
          <Text style={styles.errorText}>Deal not found</Text>
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            buttonStyle={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Deal Card */}
        <Card containerStyle={styles.dealCard}>
          {/* Deal Type Banner */}
          <View style={styles.dealTypeBanner}>
            <Icon
              name={getDealTypeIcon()}
              type="material"
              color="#FFFFFF"
              size={20}
            />
            <Text style={styles.dealTypeText}>{getFormattedDealType()}</Text>
          </View>
          
          {/* Deal Title */}
          <Text style={styles.dealTitle}>{deal.title}</Text>
          
          {/* Vendor Name */}
          {vendor && (
            <Text style={styles.vendorName}>at {vendor.name}</Text>
          )}
          
          {/* Discount Badge */}
          <View style={styles.discountContainer}>
            <Text style={styles.discountText}>{deal.discount}</Text>
          </View>
          
          {/* Deal Description */}
          <Text style={styles.dealDescription}>{deal.description}</Text>
          
          {/* Redemption Status */}
          {!redeemable && (
            <View style={styles.redemptionAlert}>
              <Icon name="error" type="material" color="#F44336" size={20} />
              <Text style={styles.redemptionAlertText}>
                This deal has been redeemed recently and is not currently available. 
                Please check back later.
              </Text>
            </View>
          )}
          
          {/* Divider */}
          <Divider style={styles.divider} />
          
          {/* Restrictions */}
          {deal.restrictions && deal.restrictions.length > 0 && (
            <View style={styles.restrictionsContainer}>
              <Text style={styles.restrictionsTitle}>Restrictions:</Text>
              {deal.restrictions.map((restriction, index) => (
                <Text key={index} style={styles.restrictionText}>• {restriction}</Text>
              ))}
            </View>
          )}
          
          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Button
              title="View Vendor"
              icon={{
                name: "storefront",
                type: "material",
                size: 20,
                color: "#4CAF50"
              }}
              type="outline"
              buttonStyle={styles.viewVendorButton}
              titleStyle={{ color: '#4CAF50' }}
              containerStyle={styles.buttonContainer}
              onPress={handleViewVendor}
            />
            
            <Button
              title="Share Deal"
              icon={{
                name: "share",
                type: "material",
                size: 20,
                color: "#2196F3"
              }}
              type="outline"
              buttonStyle={styles.shareButton}
              titleStyle={{ color: '#2196F3' }}
              containerStyle={styles.buttonContainer}
              onPress={handleShareDeal}
            />
          </View>
        </Card>
        
        {/* Vendor Card */}
        {vendor && (
          <Card containerStyle={styles.vendorCard}>
            <Card.Title>Vendor Information</Card.Title>
            <Card.Divider />
            
            {/* Vendor Name */}
            <Text style={styles.vendorCardName}>{vendor.name}</Text>
            
            {/* Vendor Address */}
            <View style={styles.addressContainer}>
              <Icon name="place" type="material" color="#666" size={16} />
              <Text style={styles.addressText}>{vendor.location.address}</Text>
            </View>
            
            {/* Distance */}
            {vendor.distance !== undefined && (
              <View style={styles.distanceContainer}>
                <Icon name="directions" type="material" color="#4CAF50" size={16} />
                <Text style={styles.distanceText}>
                  {vendor.distance.toFixed(1)} miles away
                </Text>
              </View>
            )}
            
            {/* Partner Badge */}
            {vendor.isPartner && (
              <View style={styles.partnerContainer}>
                <Icon name="verified" type="material" color="#4CAF50" size={16} />
                <Text style={styles.partnerText}>Partner Vendor</Text>
              </View>
            )}
            
            <Card.Divider style={styles.divider} />
            
            <Button
              title="Create Journey"
              icon={{
                name: "navigation",
                type: "material",
                size: 20,
                color: "white"
              }}
              buttonStyle={styles.journeyButton}
              containerStyle={styles.journeyButtonContainer}
              onPress={handleCreateJourney}
              disabled={!redeemable}
              disabledStyle={styles.disabledButton}
            />
            
            {!redeemable && (
              <Text style={styles.disabledButtonNote}>
                This deal cannot be redeemed at this time
              </Text>
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666666',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 40,
  },
  dealCard: {
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  dealTypeBanner: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dealTypeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 4,
  },
  dealTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
    paddingRight: 90, // Space for the banner
  },
  vendorName: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 12,
  },
  discountContainer: {
    backgroundColor: '#F44336',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 12,
  },
  discountText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dealDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
    marginBottom: 16,
  },
  redemptionAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  redemptionAlertText: {
    color: '#D32F2F',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  divider: {
    marginVertical: 16,
  },
  restrictionsContainer: {
    marginBottom: 16,
  },
  restrictionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  restrictionText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
    paddingLeft: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  viewVendorButton: {
    borderColor: '#4CAF50',
  },
  shareButton: {
    borderColor: '#2196F3',
  },
  vendorCard: {
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  vendorCardName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  addressText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  distanceText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4CAF50',
  },
  partnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  partnerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  journeyButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  journeyButtonContainer: {
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  disabledButtonNote: {
    textAlign: 'center',
    color: '#F44336',
    fontSize: 12,
    marginTop: 8,
  },
});

export default DealDetails;