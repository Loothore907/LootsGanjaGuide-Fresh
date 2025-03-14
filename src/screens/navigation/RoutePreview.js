// src/screens/navigation/RoutePreview.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, Card, Icon, Divider } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { getDayOfWeek } from '../../utils/DateUtils';
import { dealCacheService } from '../../services/DealCacheService';
import { Logger, LogCategory } from '../../services/LoggingService';
import DealRepository from '../../repositories/DealRepository';

const RoutePreview = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  const [relevantDeals, setRelevantDeals] = useState([]);
  const journeyType = state.journey?.dealType || 'daily';
  const dealRepository = DealRepository;

  // Get current vendor with safety checks
  const currentVendor = state.journey && 
    state.journey.vendors && 
    state.journey.currentVendorIndex >= 0 &&
    state.journey.currentVendorIndex < state.journey.vendors.length
    ? state.journey.vendors[state.journey.currentVendorIndex] 
    : null;
    
  const isLastVendor = state.journey && 
    state.journey.vendors && 
    state.journey.currentVendorIndex === state.journey.vendors.length - 1;

  // Load deals for the current vendor on component mount or when vendor changes
  useEffect(() => {
    if (currentVendor) {
      loadRelevantDeals(currentVendor);
    }
  }, [currentVendor, journeyType]);

  // Helper function to normalize deal objects for consistent display
  const normalizeDealObjects = (dealsArray) => {
    if (!dealsArray || !Array.isArray(dealsArray)) {
      return [];
    }
    
    return dealsArray.map(deal => {
      // If deal is a string, convert it to an object
      if (typeof deal === 'string') {
        return {
          description: deal,
          title: deal,
          discount: '',
          restrictions: []
        };
      }
      
      // If deal is missing required properties, fill them in
      return {
        title: deal.title || deal.description || 'Deal Available',
        description: deal.description || deal.title || 'Deal Available',
        discount: deal.discount || '',
        restrictions: Array.isArray(deal.restrictions) ? deal.restrictions : []
      };
    });
  };

  // Load relevant deals based on journey type
  const loadRelevantDeals = async (vendor) => {
    if (!vendor || !vendor.id) {
      setRelevantDeals([]);
      return;
    }

    try {
      setIsLoading(true);
      let deals = [];
      const today = getDayOfWeek();
      
      // Log the vendor object to help us debug
      Logger.info(LogCategory.DEALS, 'Loading deals for vendor', {
        vendorId: vendor.id,
        vendorName: vendor.name,
        journeyType,
        currentDay: today,
        hasDealsProperty: !!vendor.deals
      });
      
      // APPROACH 1: First try to get deals from the deal cache service
      switch (journeyType) {
        case 'birthday':
          deals = dealCacheService.getBirthdayDealsForVendor(vendor);
          break;
        case 'special':
          deals = dealCacheService.getSpecialDealsForVendor(vendor);
          // Filter for only active special deals
          if (deals && deals.length > 0) {
            deals = deals.filter(deal => {
              if (!deal.endDate) return true; // No end date means it's always active
              const endDate = new Date(deal.endDate);
              const now = new Date();
              return endDate >= now;
            });
          }
          break;
        case 'daily':
        default:
          // Get today's daily deals
          const dailyDeals = dealCacheService.getDailyDealsForVendor(vendor, today);
          
          // Get multi-day deals that are active today
          const multiDayDeals = dealCacheService.getMultiDayDealsForVendor(vendor, today);
          
          // Get everyday deals as fallback
          const everydayDeals = dealCacheService.getEverydayDealsForVendor(vendor);
          
          // Combine all deal types
          deals = [...dailyDeals, ...multiDayDeals, ...everydayDeals];
          break;
      }
      
      // Log what we found in the cache
      Logger.info(LogCategory.DEALS, 'Deals from cache service', {
        dealsFound: deals.length,
        journeyType: journeyType,
        day: today
      });
      
      // APPROACH 2: If no deals found in cache, try to extract directly from vendor object
      if (deals.length === 0 && vendor.deals) {
        Logger.info(LogCategory.DEALS, 'Getting deals directly from vendor object', {
          vendorId: vendor.id,
          dealTypes: Object.keys(vendor.deals)
        });
        
        if (journeyType === 'birthday' && vendor.deals.birthday) {
          // Handle birthday deals
          deals = Array.isArray(vendor.deals.birthday) 
            ? vendor.deals.birthday
            : [vendor.deals.birthday].filter(Boolean);
        } 
        else if (journeyType === 'daily' && (vendor.deals.daily || vendor.deals.multiDay || vendor.deals.everyday)) {
          // Handle daily deals - combine daily, multi_day, and everyday deals
          let todayDeals = [];
          
          // Extract today's specific deals
          if (vendor.deals.daily && vendor.deals.daily[today]) {
            todayDeals = Array.isArray(vendor.deals.daily[today])
              ? vendor.deals.daily[today]
              : [vendor.deals.daily[today]].filter(Boolean);
          }
          
          // Extract multi-day deals for today
          let multiDayDeals = [];
          if (vendor.deals.multiDay) {
            const multiDayArray = Array.isArray(vendor.deals.multiDay) 
              ? vendor.deals.multiDay 
              : [vendor.deals.multiDay].filter(Boolean);
            
            multiDayDeals = multiDayArray.filter(deal => 
              deal.days && Array.isArray(deal.days) && deal.days.includes(today)
            );
          }
          
          // Also get everyday deals
          let everydayDeals = [];
          if (vendor.deals.everyday) {
            everydayDeals = Array.isArray(vendor.deals.everyday)
              ? vendor.deals.everyday
              : [vendor.deals.everyday].filter(Boolean);
          }
          
          deals = [...todayDeals, ...multiDayDeals, ...everydayDeals];
        }
        else if (journeyType === 'special' && vendor.deals.special) {
          // Handle special deals
          let specialDeals = Array.isArray(vendor.deals.special)
            ? vendor.deals.special
            : [vendor.deals.special].filter(Boolean);
            
          // Filter for only active special deals
          specialDeals = specialDeals.filter(deal => {
            if (!deal.endDate) return true; // No end date means it's always active
            const endDate = new Date(deal.endDate);
            const now = new Date();
            return endDate >= now;
          });
          
          deals = specialDeals;
        }
        
        Logger.info(LogCategory.DEALS, 'Deals from vendor object', {
          dealsFound: deals.length
        });
      }
      
      // Normalize the deals for consistent display
      const normalizedDeals = normalizeDealObjects(deals);
      
      // Set the deals in state
      setRelevantDeals(normalizedDeals);
      
      Logger.info(LogCategory.DEALS, `Final deals for display`, {
        vendorId: vendor.id,
        dealCount: normalizedDeals.length
      });
    } catch (error) {
      Logger.error(LogCategory.DEALS, `Error loading deals for vendor`, {
        error,
        vendorId: vendor.id,
        journeyType
      });
      setRelevantDeals([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNavigation = () => {
    navigation.navigate('RouteMapView');
  };

  const handleCancelOrEndJourney = () => {
    // Check if this is a single-stop journey
    const isSingleStop = state.journey.vendors.length === 1;
    
    // Check if journey has started by looking at the checkedIn status
    const hasStarted = state.journey.vendors.some(vendor => vendor.checkedIn);
    
    // If it's a single-stop journey or the journey hasn't started yet
    if (isSingleStop || !hasStarted) {
      Alert.alert(
        isSingleStop ? 'Cancel Journey?' : 'End Journey?',
        isSingleStop 
          ? 'Are you sure you want to cancel this journey?' 
          : 'You haven\'t started your journey yet. Are you sure you want to end it?',
        [
          { text: 'No, Stay Here', style: 'cancel' },
          { 
            text: 'Yes, Go Back', 
            onPress: () => {
              dispatch(AppActions.endJourney());
              navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
              });
            }
          }
        ]
      );
    } else {
      // Journey has started and has multiple stops, go to the termination confirmation screen
      navigation.navigate('JourneyComplete', { terminationType: "early" });
    }
  };

  const handleSkipVendor = () => {
    dispatch(AppActions.skipVendor());
    navigation.replace('RoutePreview');
  };

  const formatDistance = (distance) => {
    if (distance === undefined || distance === null) {
      return "Distance unknown";
    }
    return `${distance.toFixed(1)} miles away`;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {!currentVendor ? (
          // Display an error message when vendor data is not available
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Sorry, we couldn't load the journey data. The information may be outdated or incomplete.
            </Text>
            <Button
              title="Return to Home"
              onPress={() => navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
              })}
              containerStyle={styles.errorButtonContainer}
            />
          </View>
        ) : (
          // Rest of the component with currentVendor data
          <>
            <Text h4 style={styles.title}>
              {state.journey.currentVendorIndex === 0 ? 'Starting Your Journey' : 'Next Stop'}
            </Text>

            <Card containerStyle={styles.vendorCard}>
              <Card.Title>{currentVendor.name}</Card.Title>
              <Card.Divider />

              <View style={styles.locationInfo}>
                <Icon
                  name="location-pin"
                  type="material"
                  color="#2089dc"
                  size={24}
                />
                <Text style={styles.distance}>
                  {formatDistance(currentVendor.distance)}
                </Text>
              </View>

              <Text style={styles.address}>
                {currentVendor.location?.address || 'Address not available'}
              </Text>

              <Divider style={styles.divider} />

              <Text style={styles.dealsHeader}>
                {journeyType === 'birthday' ? 'Birthday Deals:' : 
                 journeyType === 'special' ? 'Special Offers:' : 
                 'Available Deals:'}
              </Text>
              {relevantDeals.length > 0 ? (
                relevantDeals.map((deal, index) => {
                  // Normalize the deal structure for display
                  const dealTitle = deal.title || deal.description || deal.discount || 'Deal available';
                  const dealDiscount = deal.discount || deal.title || '';
                  const dealRestrictions = deal.restrictions || [];

                  return (
                    <View key={index} style={styles.dealItem}>
                      <Text style={styles.dealTitle}>{dealTitle}</Text>
                      {dealDiscount && dealDiscount !== dealTitle && (
                        <Text style={styles.discount}>{dealDiscount}</Text>
                      )}
                      {dealRestrictions.length > 0 && dealRestrictions.map((restriction, idx) => (
                        <Text key={idx} style={styles.restriction}>
                          • {restriction}
                        </Text>
                      ))}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.noDealsText}>
                  {journeyType === 'birthday' ? 'No birthday deals available' : 
                   journeyType === 'special' ? 'No special offers available' : 
                   'No deals available for today'}
                </Text>
              )}
            </Card>

            <View style={styles.actionButtons}>
              <Button
                title={state.journey.vendors.length === 1 ? "Cancel" : 
                      isLastVendor ? "End Journey" : 
                      "Skip This Stop"}
                type="outline"
                onPress={isLastVendor || state.journey.vendors.length === 1 ? 
                          handleCancelOrEndJourney : 
                          handleSkipVendor}
                containerStyle={styles.actionButton}
              />
              
              <Button
                title="Let's Go!"
                icon={{
                  name: "navigation",
                  type: "material",
                  size: 20,
                  color: "white"
                }}
                onPress={handleStartNavigation}
                containerStyle={styles.actionButton}
                loading={isLoading}
              />
            </View>

            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                Stop {state.journey.currentVendorIndex + 1} of {state.journey.vendors.length}
              </Text>
              <Text style={styles.estimateText}>
                Estimated time to destination: {Math.round((currentVendor.distance || 0) * 3)} mins
              </Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  vendorCard: {
    borderRadius: 10,
    marginBottom: 20,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  distance: {
    marginLeft: 10,
    fontSize: 16,
    color: '#2089dc',
  },
  address: {
    marginLeft: 34,
    color: '#666',
  },
  divider: {
    marginVertical: 15,
  },
  dealsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  dealItem: {
    marginBottom: 15,
  },
  dealTitle: {
    fontSize: 16,
    marginBottom: 5,
  },
  discount: {
    color: '#2089dc',
    fontSize: 15,
    marginBottom: 5,
  },
  restriction: {
    color: '#666',
    fontSize: 14,
    marginLeft: 10,
  },
  detailsButton: {
    marginTop: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  progressInfo: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 8,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 5,
  },
  estimateText: {
    textAlign: 'center',
    color: '#666',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  errorButtonContainer: {
    width: '100%',
    marginTop: 10,
  },
  noDealsText: {
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
    marginVertical: 10,
  },
});

export default RoutePreview;