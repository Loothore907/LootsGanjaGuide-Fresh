// src/screens/deals/DailyDeals.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  Alert
} from 'react-native';
import { Text, Button, Card, Icon, CheckBox, Chip, Divider } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import { getDailyDeals, createOptimizedRoute } from '../../services/MockDataService';

const DailyDeals = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [deals, setDeals] = useState([]);
  const [selectedDeals, setSelectedDeals] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [maxDistance, setMaxDistance] = useState(state.dealFilters.maxDistance || 25);
  const [currentDay, setCurrentDay] = useState(getDayOfWeek());
  
  // Product categories
  const categories = [
    { id: 'flower', label: 'Flower', icon: 'local-florist' },
    { id: 'prerolls', label: 'Pre-rolls', icon: 'filter-list' },
    { id: 'concentrates', label: 'Concentrates', icon: 'opacity' },
    { id: 'cartridges', label: 'Cartridges', icon: 'battery-std' },
    { id: 'edibles', label: 'Edibles', icon: 'restaurant' },
    { id: 'tinctures', label: 'Tinctures', icon: 'colorize' },
    { id: 'topicals', label: 'Topicals', icon: 'spa' },
    { id: 'accessories', label: 'Accessories', icon: 'devices' }
  ];
  
  // Days of the week
  const daysOfWeek = [
    { id: 'monday', label: 'Mon' },
    { id: 'tuesday', label: 'Tue' },
    { id: 'wednesday', label: 'Wed' },
    { id: 'thursday', label: 'Thu' },
    { id: 'friday', label: 'Fri' },
    { id: 'saturday', label: 'Sat' },
    { id: 'sunday', label: 'Sun' }
  ];
  
  // Helper function to get current day of week
  function getDayOfWeek() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay();
    return days[today];
  }
  
  // Load deals on component mount and when filters change
  useEffect(() => {
    loadDailyDeals();
  }, [currentDay, selectedCategory, maxDistance]);
  
  const loadDailyDeals = async () => {
    setIsLoading(true);
    setDeals([]);
    
    try {
      await tryCatch(async () => {
        const options = {
          maxDistance: maxDistance,
          category: selectedCategory
        };
        
        const dailyDeals = await getDailyDeals(currentDay, options);
        setDeals(dailyDeals);
        
        Logger.info(LogCategory.DEALS, 'Loaded daily deals', {
          day: currentDay,
          category: selectedCategory,
          count: dailyDeals.length,
          maxDistance
        });
      }, LogCategory.DEALS, 'loading daily deals', true);
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
  
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId === selectedCategory ? null : categoryId);
  };
  
  const handleDaySelect = (day) => {
    setCurrentDay(day);
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
          dealType: 'daily',
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
        
        Logger.info(LogCategory.JOURNEY, 'Daily deal journey created', {
          vendorCount: route.vendors.length,
          totalDistance: route.totalDistance,
          estimatedTime: route.estimatedTime
        });
        
        // Navigate to route preview
        navigation.navigate('RoutePreview');
      }, LogCategory.DEALS, 'creating daily deal journey', true);
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScrollView}>
          {daysOfWeek.map(day => (
            <TouchableOpacity
              key={day.id}
              style={[
                styles.dayButton,
                currentDay === day.id && styles.selectedDayButton
              ]}
              onPress={() => handleDaySelect(day.id)}
            >
              <Text 
                style={[
                  styles.dayText,
                  currentDay === day.id && styles.selectedDayText
                ]}
              >
                {day.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <Divider width={1} style={styles.divider} />
        
        <Text style={styles.sectionTitle}>Filter by Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScrollView}>
          {categories.map(category => (
            <Chip
              key={category.id}
              title={category.label}
              icon={{
                name: category.icon,
                type: 'material',
                size: 16,
                color: selectedCategory === category.id ? 'white' : '#666666',
              }}
              buttonStyle={[
                styles.categoryChip,
                selectedCategory === category.id && styles.selectedCategoryChip
              ]}
              titleStyle={[
                styles.categoryChipTitle,
                selectedCategory === category.id && styles.selectedCategoryChipTitle
              ]}
              onPress={() => handleCategorySelect(category.id)}
              containerStyle={styles.chipContainer}
            />
          ))}
        </ScrollView>
        
        <View style={styles.selectedCount}>
          <Text style={styles.selectedCountText}>
            {selectedDeals.length} deals selected
          </Text>
          
          <Button
            title="Refresh"
            type="outline"
            onPress={loadDailyDeals}
            loading={isLoading}
            containerStyle={styles.refreshButton}
          />
        </View>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading daily deals...</Text>
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
                <Icon name="local-offer" type="material" size={64} color="#CCCCCC" />
                <Text style={styles.emptyText}>No daily deals found for {currentDay}.</Text>
                <Text style={styles.emptySubtext}>Try selecting a different day or category.</Text>
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
  daysScrollView: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  selectedDayButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  dayText: {
    fontSize: 14,
    color: '#666666',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  categoriesScrollView: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  chipContainer: {
    marginRight: 8,
  },
  categoryChip: {
    backgroundColor: '#FFFFFF',
  },
  selectedCategoryChip: {
    backgroundColor: '#4CAF50',
  },
  categoryChipTitle: {
    color: '#666666',
  },
  selectedCategoryChipTitle: {
    color: '#FFFFFF',
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

export default DailyDeals;