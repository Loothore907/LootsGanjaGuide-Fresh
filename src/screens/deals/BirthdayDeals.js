// src/screens/deals/BirthdayDeals.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { Text, Button, Card, Icon, CheckBox, Slider } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import { getBirthdayDeals, createOptimizedRoute } from '../../services/MockDataService';

const BirthdayDeals = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [birthMonth, setBirthMonth] = useState(new Date().getMonth());
  const [maxDistance, setMaxDistance] = useState(state.dealFilters.maxDistance || 25);
  const [deals, setDeals] = useState([]);
  const [selectedDeals, setSelectedDeals] = useState([]);
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Load deals on component mount
  useEffect(() => {
    loadBirthdayDeals();
  }, []);
  
  const loadBirthdayDeals = async () => {
    setIsLoading(true);
    setDeals([]);
    
    try {
      await tryCatch(async () => {
        const options = {
          maxDistance: maxDistance,
          activeOnly: true
        };
        
        const birthdayDeals = await getBirthdayDeals(options);
        setDeals(birthdayDeals);
        
        Logger.info(LogCategory.DEALS, 'Loaded birthday deals', {
          count: birthdayDeals.length,
          maxDistance
        });
      }, LogCategory.DEALS, 'loading birthday deals', true);
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
  
  const handleDistanceChange = (value) => {
    setMaxDistance(value);
    dispatch(AppActions.updateDealFilters({ maxDistance: value }));
  };
  
  const handleRefresh = () => {
    loadBirthdayDeals();
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
        
        // Create optimized route
        const route = await createOptimizedRoute(selectedVendorIds, {
          // Use current location in a real app
          startLocation: {
            latitude: 61.217381,
            longitude: -149.863129
          }
        });
        
        // Start journey in app state
        dispatch(AppActions.startJourney({
          dealType: 'birthday',
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
        
        Logger.info(LogCategory.JOURNEY, 'Birthday deal journey created', {
          vendorCount: route.vendors.length,
          totalDistance: route.totalDistance,
          estimatedTime: route.estimatedTime
        });
        
        // Navigate to route preview
        navigation.navigate('RoutePreview');
      }, LogCategory.DEALS, 'creating birthday deal journey', true);
    } catch (error) {
      // Error already logged by tryCatch
    } finally {
      setIsCreatingRoute(false);
    }
  };
  
  const renderDealItem = ({ item }) => (
    <Card containerStyle={styles.dealCard}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => toggleDealSelection(item.id)}
      >
        <View style={styles.selectionIndicator}>
          <CheckBox
            checked={selectedDeals.includes(item.id)}
            onPress={() => toggleDealSelection(item.id)}
            containerStyle={styles.checkbox}
          />
        </View>
        
        <View style={styles.dealInfo}>
          <Text style={styles.vendorName}>{item.vendorName}</Text>
          <Text style={styles.dealTitle}>{item.title}</Text>
          
          <View style={styles.discountContainer}>
            <Text style={styles.discountText}>{item.discount}</Text>
          </View>
          
          {item.restrictions && item.restrictions.length > 0 && (
            <View style={styles.restrictionsContainer}>
              <Text style={styles.restrictionsTitle}>Restrictions:</Text>
              {item.restrictions.map((restriction, index) => (
                <Text key={index} style={styles.restrictionText}>• {restriction}</Text>
              ))}
            </View>
          )}
          
          <View style={styles.distanceContainer}>
            <Icon name="place" type="material" size={16} color="#666" />
            <Text style={styles.distanceText}>
              {item.vendorDistance.toFixed(1)} miles away
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      
      <Card.Divider />
      
      <View style={styles.cardActions}>
        <Button
          title="View Vendor"
          type="clear"
          onPress={() => navigation.navigate('VendorProfile', { vendorId: item.vendorId })}
        />
        <Button
          title="Directions"
          type="clear"
          icon={{
            name: "directions",
            type: "material",
            size: 20,
            color: "#2089dc"
          }}
          onPress={() => navigation.navigate('MapView', { vendorId: item.vendorId })}
        />
      </View>
    </Card>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filtersContainer}>
        <Text style={styles.sectionTitle}>Birthday Month</Text>
        <View style={styles.monthSelector}>
          <Button
            icon={{
              name: 'chevron-left',
              type: 'material',
              size: 24,
              color: 'white'
            }}
            onPress={() => setBirthMonth((birthMonth - 1 + 12) % 12)}
            containerStyle={styles.monthButton}
          />
          <View style={styles.monthNameContainer}>
            <Text style={styles.monthName}>{monthNames[birthMonth]}</Text>
          </View>
          <Button
            icon={{
              name: 'chevron-right',
              type: 'material',
              size: 24,
              color: 'white'
            }}
            onPress={() => setBirthMonth((birthMonth + 1) % 12)}
            containerStyle={styles.monthButton}
          />
        </View>
        
        <Text style={styles.sectionTitle}>Maximum Distance: {maxDistance} miles</Text>
        <Slider
          value={maxDistance}
          onValueChange={handleDistanceChange}
          maximumValue={50}
          minimumValue={1}
          step={1}
          thumbStyle={styles.sliderThumb}
          trackStyle={styles.sliderTrack}
          containerStyle={styles.sliderContainer}
        />
        
        <View style={styles.selectedCount}>
          <Text style={styles.selectedCountText}>
            {selectedDeals.length} deals selected
          </Text>
          
          <Button
            title="Refresh"
            type="outline"
            onPress={handleRefresh}
            loading={isLoading}
            containerStyle={styles.refreshButton}
          />
        </View>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading birthday deals...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={deals}
            renderItem={renderDealItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="cake" type="material" size={64} color="#CCCCCC" />
                <Text style={styles.emptyText}>No birthday deals found for your selected criteria.</Text>
                <Text style={styles.emptySubtext}>Try increasing your maximum distance or check again later.</Text>
              </View>
            }
          />
          
          <View style={styles.createJourneyContainer}>
            <Button
              title={`Create Journey (${selectedDeals.length})`}
              onPress={handleCreateJourney}
              disabled={selectedDeals.length === 0 || isCreatingRoute}
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
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  filtersContainer: {
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthButton: {
    width: 50,
  },
  monthNameContainer: {
    flex: 1,
    alignItems: 'center',
  },
  monthName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderThumb: {
    backgroundColor: '#4CAF50',
  },
  sliderTrack: {
    height: 4,
  },
  selectedCount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedCountText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  refreshButton: {
    width: 100,
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
  listContainer: {
    padding: 8,
  },
  dealCard: {
    borderRadius: 8,
    padding: 0,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
  },
  selectionIndicator: {
    justifyContent: 'flex-start',
  },
  checkbox: {
    margin: 0,
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  dealInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dealTitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  discountContainer: {
    backgroundColor: '#4CAF50',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  discountText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  restrictionsContainer: {
    marginBottom: 8,
  },
  restrictionsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 4,
  },
  restrictionText: {
    fontSize: 12,
    color: '#666666',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666666',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  createJourneyContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  createJourneyButtonContainer: {
    width: '100%',
  },
  createJourneyButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
});

export default BirthdayDeals;