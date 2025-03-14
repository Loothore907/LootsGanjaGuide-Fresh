// src/screens/deals/SpecialDeals.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Modal
} from 'react-native';
import { Text, Button, Card, Icon, CheckBox, Badge, Divider, Chip } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import serviceProvider from '../../services/ServiceProvider';

const SpecialDeals = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [maxDistance, setMaxDistance] = useState(state.dealFilters.maxDistance || 25);
  const [deals, setDeals] = useState([]);
  const [selectedDeals, setSelectedDeals] = useState([]);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [sortByValue, setSortByValue] = useState(true);
  
  // Load deals on component mount
  useEffect(() => {
    loadSpecialDeals();
  }, [showActiveOnly, maxDistance, sortByValue]);
  
  // Helper to calculate deal value score
  const calculateDealValue = (deal) => {
    // Base score from discount percentage
    let score = 0;
    
    // Extract percentage from discount text
    const percentMatch = deal.discount?.match(/(\d+)%/);
    if (percentMatch) {
      score += parseInt(percentMatch[1]);
    }
    
    // Additional score for BOGO deals
    if (deal.discount?.toLowerCase().includes('bogo')) {
      score += 50;
    }
    
    // Bonus for deals with no restrictions
    if (!deal.restrictions || deal.restrictions.length === 0) {
      score += 10;
    }
    
    // Penalize for each restriction
    if (deal.restrictions && deal.restrictions.length > 0) {
      score -= deal.restrictions.length * 2;
    }
    
    return score;
  };
  
  const loadSpecialDeals = async () => {
    setIsLoading(true);
    setDeals([]);
    
    try {
      await tryCatch(async () => {
        const options = {
          maxDistance: maxDistance,
          activeOnly: showActiveOnly
        };
        
        // Use serviceProvider instance to get special deals
        const specialDeals = await serviceProvider.getSpecialDeals(options);
        
        // Sort deals based on user preference
        const sortedDeals = [...specialDeals].sort((a, b) => {
          if (sortByValue) {
            // Sort by calculated value score
            return calculateDealValue(b) - calculateDealValue(a);
          } else {
            // Default sort - distance
            return (a.vendorDistance || 999) - (b.vendorDistance || 999);
          }
        });
        
        setDeals(sortedDeals);
        
        Logger.info(LogCategory.DEALS, 'Loaded special deals', {
          count: specialDeals.length,
          maxDistance,
          activeOnly: showActiveOnly,
          sortByValue
        });
      }, LogCategory.DEALS, 'loading special deals', true);
    } catch (error) {
      // Error already logged by tryCatch
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleDealSelection = (dealId) => {
    if (selectedDeals.includes(dealId)) {
      setSelectedDeals(selectedDeals.filter(id => id !== dealId));
    } else {
      setSelectedDeals([...selectedDeals, dealId]);
    }
  };
  
  const handleCreateJourney = async () => {
    if (selectedDeals.length === 0) {
      Alert.alert(
        'No Deals Selected',
        'Please select at least one deal to create a journey.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setIsCreatingRoute(true);
    try {
      await tryCatch(async () => {
        // Get selected vendor IDs
        const selectedVendorIds = selectedDeals.map(dealId => {
          const deal = deals.find(d => d.id === dealId);
          return deal.vendorId;
        });
        
        // Create optimized route using the serviceProvider instance
        const route = await serviceProvider.createOptimizedRoute(selectedVendorIds, {
          // Use current location in a real app
          startLocation: {
            latitude: 61.217381,
            longitude: -149.863129
          }
        });
        
        // Start journey in app state
        dispatch(AppActions.startJourney({
          dealType: 'special',
          vendors: route.vendors,
          maxDistance: maxDistance,
          totalVendors: route.vendors.length
        }));
        
        // Update route information
        dispatch(AppActions.updateRoute({
          coordinates: route.vendors.map(v => v.location.coordinates),
          totalDistance: route.totalDistance,
          estimatedTime: route.estimatedTime
        }));
        
        Logger.info(LogCategory.JOURNEY, 'Special deal journey created', {
          vendorCount: route.vendors.length,
          totalDistance: route.totalDistance,
          estimatedTime: route.estimatedTime
        });
        
        // Navigate to route preview
        navigation.navigate('RoutePreview');
      }, LogCategory.DEALS, 'creating special deal journey', true);
    } catch (error) {
      // Error already logged by tryCatch
    } finally {
      setIsCreatingRoute(false);
    }
  };
  
  // New function to create a journey with a single deal
  const createDirectJourney = async (deal) => {
    try {
      // Set loading state
      setIsLoading(true);
      
      await tryCatch(async () => {
        // Check if there's an active journey and confirm replacement if needed
        if (state.journey && state.journey.active) {
          Alert.alert(
            'Replace Active Journey?',
            'You have an active journey in progress. Starting a new journey will replace it. Continue?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setIsLoading(false) },
              { 
                text: 'Continue', 
                onPress: async () => {
                  // End the current journey
                  dispatch(AppActions.endJourney());
                  // Create a new journey with just this vendor
                  await createSingleVendorJourney(deal);
                }
              }
            ]
          );
        } else {
          // No active journey, create a new one directly
          await createSingleVendorJourney(deal);
        }
      }, LogCategory.JOURNEY, 'creating direct journey for special deal', true);
    } catch (error) {
      // Error already logged by tryCatch
      Alert.alert('Error', 'Failed to create journey. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to create a single vendor journey
  const createSingleVendorJourney = async (deal) => {
    // Create an optimized route with just this vendor
    const route = await serviceProvider.createOptimizedRoute([deal.vendorId], {
      startLocation: state.user?.location || {
        latitude: 61.217381, // Default to Anchorage if no user location
        longitude: -149.863129
      },
      dealType: 'special'
    });
    
    if (!route || !route.vendors || route.vendors.length === 0) {
      throw new Error('Failed to create route with vendor');
    }
    
    // Start journey in app state
    dispatch(AppActions.startJourney({
      dealType: 'special',
      vendors: route.vendors,
      maxDistance: maxDistance || 25,
      totalVendors: route.vendors.length
    }));
    
    // Update route information
    dispatch(AppActions.updateRoute({
      coordinates: route.vendors.map(v => v.location.coordinates),
      totalDistance: route.totalDistance,
      estimatedTime: route.estimatedTime
    }));
    
    Logger.info(LogCategory.JOURNEY, 'Created direct journey for special deal', { 
      vendorId: deal.vendorId, 
      dealTitle: deal.title,
      daysRemaining: getDaysRemaining(deal.endDate)
    });
    
    // Navigate to the route preview screen
    navigation.reset({
      index: 0,
      routes: [
        { name: 'MainTabs' },
        { name: 'RoutePreview' }
      ],
    });
  };
  
  // Format date in a readable way
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Calculate days remaining for a deal
  const getDaysRemaining = (endDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for fair comparison
    const end = new Date(endDate);
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  
  // Updated render item to match DailyDeals card style
  const renderDealItem = ({ item }) => {
    const daysRemaining = getDaysRemaining(item.endDate);
    const isActive = daysRemaining >= 0;
    
    // If showing active only and deal is inactive, don't render
    if (showActiveOnly && !isActive) return null;
    
    return (
      <Card containerStyle={styles.dealCard}>
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => isActive ? createDirectJourney(item) : Alert.alert('Expired Deal', 'This deal has expired and is no longer valid.')}
        >
          <View style={styles.dealInfo}>
            {/* Deal title and expiration */}
            <View style={styles.dealHeader}>
              <Text style={styles.dealTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>
            </View>
            
            {/* Vendor name */}
            <Text style={styles.vendorName} numberOfLines={1} ellipsizeMode="tail">{item.vendorName}</Text>
            
            {/* Discount badge */}
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{item.discount}</Text>
            </View>
            
            {/* Date range badge */}
            <View style={styles.dateRangeBadge}>
              <Icon name="date-range" type="material" size={14} color="#4CAF50" />
              <Text style={styles.dateRangeText}>
                {formatDate(item.startDate)} - {formatDate(item.endDate)}
              </Text>
            </View>
            
            {/* Days remaining tag */}
            {isActive ? (
              <View style={styles.daysRemainingTag}>
                <Text style={styles.daysRemainingText}>
                  {daysRemaining === 0 ? 'Last day!' : `${daysRemaining} days left`}
                </Text>
              </View>
            ) : (
              <View style={[styles.daysRemainingTag, { backgroundColor: '#F44336' }]}>
                <Text style={styles.daysRemainingText}>Expired</Text>
              </View>
            )}
            
            {/* Distance info */}
            <View style={styles.distanceContainer}>
              <Icon name="place" type="material" size={14} color="#4CAF50" />
              <Text style={styles.distanceText}>
                {item.vendorDistance ? item.vendorDistance.toFixed(1) : '?'} miles away
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        
        {/* View Vendor button */}
        <TouchableOpacity 
          style={styles.buttonSection}
          onPress={() => navigation.navigate('VendorProfile', { vendorId: item.vendorId })}
        >
          <View style={styles.viewVendorButtonContent}>
            <Icon name="store" type="material" size={16} color="#2089dc" />
            <Text style={styles.viewVendorText}>View Vendor</Text>
          </View>
        </TouchableOpacity>
      </Card>
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Banner & controls */}
      <View style={styles.topDealsBanner}>
        <Text style={styles.bannerTitle}>Special Offers</Text>
        <Text style={styles.bannerSubtitle}>Limited time promotions from local dispensaries</Text>
        <View style={styles.filterButtonsRow}>
          <Button
            title={showActiveOnly ? "Active Only" : "Show All"}
            type="outline"
            icon={{
              name: showActiveOnly ? "check-circle" : "radio-button-unchecked",
              type: "material",
              size: 18,
              color: "#4CAF50"
            }}
            buttonStyle={styles.filterButton}
            containerStyle={styles.filterButtonContainer}
            titleStyle={{ color: '#4CAF50' }}
            onPress={() => setShowActiveOnly(!showActiveOnly)}
          />
          <Button
            title={sortByValue ? "Sorting: Value" : "Sorting: Distance"}
            type="outline"
            icon={{
              name: sortByValue ? "trending-up" : "place",
              type: "material",
              size: 18,
              color: "#4CAF50"
            }}
            buttonStyle={styles.sortButton}
            containerStyle={styles.sortButtonContainer}
            titleStyle={{ color: '#4CAF50' }}
            onPress={() => setSortByValue(!sortByValue)}
          />
        </View>
      </View>
      
      <View style={styles.contentContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading special offers...</Text>
          </View>
        ) : (
          <FlatList
            data={deals}
            renderItem={renderDealItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="event-busy" type="material" size={64} color="#CCCCCC" />
                <Text style={styles.emptyText}>No special offers found.</Text>
                <Text style={styles.emptySubtext}>
                  {showActiveOnly 
                    ? "Try disabling the 'Active Only' filter to see past offers."
                    : "Check back later for special promotions!"}
                </Text>
              </View>
            }
          />
        )}
      </View>
      
      {selectedDeals.length > 0 && (
        <View style={styles.createJourneyContainer}>
          <Button
            title={`Create Journey (${selectedDeals.length})`}
            onPress={handleCreateJourney}
            disabled={isCreatingRoute}
            loading={isCreatingRoute}
            buttonStyle={styles.createJourneyButton}
            containerStyle={styles.createJourneyButtonContainer}
            icon={{
              name: "navigation",
              type: "material",
              size: 20,
              color: "white"
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

// Updated styles to match DailyDeals
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  topDealsBanner: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginBottom: 10,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
    textAlign: 'center',
  },
  filterButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterButtonContainer: {
    flex: 1,
    marginRight: 8,
  },
  filterButton: {
    backgroundColor: 'white',
    borderColor: 'white',
    borderRadius: 8,
  },
  sortButtonContainer: {
    flex: 1,
    marginLeft: 8,
  },
  sortButton: {
    backgroundColor: 'white',
    borderColor: 'white',
    borderRadius: 8,
  },
  
  // Card styles matching DailyDeals
  dealCard: {
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 0,
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  cardContent: {
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  dealInfo: {
    flex: 1,
  },
  dealHeader: {
    marginBottom: 2,
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  vendorName: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
  },
  discountBadge: {
    backgroundColor: '#4CAF50',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 2,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  discountText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  dateRangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4C3',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  dateRangeText: {
    fontSize: 12,
    color: '#827717',
    marginLeft: 4,
  },
  daysRemainingTag: {
    backgroundColor: '#FF9800',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  daysRemainingText: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  distanceText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
  buttonSection: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  viewVendorButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewVendorText: {
    color: '#2089dc',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  
  contentContainer: {
    flex: 1,
    width: '100%',
  },
  listContainer: {
    paddingBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 30,
    marginTop: 8,
  },
  createJourneyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  createJourneyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 4,
  },
  createJourneyButtonContainer: {
    width: '100%',
  },
});

export default SpecialDeals;