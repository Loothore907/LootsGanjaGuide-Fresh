import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
  Modal
} from 'react-native';
import { 
  Text, 
  Button, 
  Card, 
  Icon, 
  CheckBox, 
  Chip, 
  Divider
} from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import serviceProvider from '../../services/ServiceProvider';

const EverydayDeals = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [deals, setDeals] = useState([]);
  const [selectedDeals, setSelectedDeals] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [maxDistance, setMaxDistance] = useState(state.dealFilters.maxDistance || 25);
  const [showCategories, setShowCategories] = useState(false);
  const [sortByValue, setSortByValue] = useState(true);
  
  // Enhanced product categories with icons
  const categories = [
    { id: 'flower', label: 'Flower', icon: 'local-florist' },
    { id: 'prerolls', label: 'Pre-rolls', icon: 'filter-list' },
    { id: 'vapes', label: 'Vapes', icon: 'battery-std' },
    { id: 'cartridges', label: 'Cartridges', icon: 'battery-full' },
    { id: 'concentrates', label: 'Concentrates', icon: 'opacity' },
    { id: 'edibles', label: 'Edibles', icon: 'restaurant' },
    { id: 'tinctures', label: 'Tinctures', icon: 'opacity' },
    { id: 'topicals', label: 'Topicals', icon: 'spa' },
    { id: 'accessories', label: 'Accessories', icon: 'devices' },
    { id: 'seeds', label: 'Seeds', icon: 'grain' },
    { id: 'cbd', label: 'CBD', icon: 'healing' },
    { id: 'beverages', label: 'Beverages', icon: 'local-drink' },
    { id: 'merchandise', label: 'Merchandise', icon: 'shopping-bag' },
    { id: 'misc', label: 'Miscellaneous', icon: 'more-horiz' }
  ];
  
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
    
    // Boost popular categories slightly
    if (deal.category === 'flower' || deal.category === 'cartridges') {
      score += 5;
    }
    
    return score;
  };
  
  // Load deals on component mount and when filters change
  useEffect(() => {
    loadEverydayDeals();
  }, [selectedCategories, maxDistance, sortByValue]);
  
  const loadEverydayDeals = async () => {
    setIsLoading(true);
    setDeals([]);
    
    try {
      await tryCatch(async () => {
        const options = {
          maxDistance: maxDistance,
          // Send array of categories instead of single category
          categories: selectedCategories.length > 0 ? selectedCategories : undefined
        };
        
        // Get everyday deals
        const everydayDeals = await serviceProvider.getEverydayDeals(options);
        
        // Sort deals based on user preference
        const sortedDeals = [...everydayDeals].sort((a, b) => {
          if (sortByValue) {
            // Sort by calculated value score
            return calculateDealValue(b) - calculateDealValue(a);
          } else {
            // Default sort - distance
            return (a.vendorDistance || 999) - (b.vendorDistance || 999);
          }
        });
        
        setDeals(sortedDeals);
        
        Logger.info(LogCategory.DEALS, 'Loaded everyday deals', {
          categories: selectedCategories,
          dealsCount: everydayDeals.length,
          maxDistance,
          sortByValue
        });
      }, LogCategory.DEALS, 'loading everyday deals', true);
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
  
  const toggleCategorySelection = (categoryId) => {
    if (selectedCategories.includes(categoryId)) {
      // Remove from selection
      setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
    } else {
      // Add to selection if under 10 categories
      if (selectedCategories.length < 10) {
        setSelectedCategories([...selectedCategories, categoryId]);
      } else {
        // Show alert if max categories reached
        Alert.alert(
          'Maximum Categories Selected',
          'You can select up to 10 categories at once. Please deselect a category first.',
          [{ text: 'OK' }]
        );
      }
    }
  };
  
  const clearCategorySelection = () => {
    setSelectedCategories([]);
  };
  
  const toggleSortByValue = () => {
    setSortByValue(!sortByValue);
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
        const route = await serviceProvider.createOptimizedRoute(selectedVendorIds, {
          // Use current location in a real app
          startLocation: {
            latitude: 61.2176, // Anchorage default
            longitude: -149.8997
          },
          dealType: 'everyday',
          maxDistance: maxDistance || 25
        });
        
        // Save route data to state
        dispatch(AppActions.startJourney({
          dealType: 'everyday',
          vendors: route.vendors,
          maxDistance: maxDistance || 25,
          startLocation: route.startLocation
        }));
        
        // Update route data
        dispatch(AppActions.updateRoute({
          coordinates: route.coordinates,
          totalDistance: route.totalDistance,
          estimatedTime: route.estimatedTime
        }));
        
        Logger.info(LogCategory.JOURNEY, 'Created everyday deal journey', { 
          vendors: route.vendors.length,
          totalDistance: route.totalDistance
        });
        
        // Navigate to route preview
        navigation.navigate('RoutePreview');
      }, LogCategory.JOURNEY, 'creating everyday deal journey', true);
    } catch (error) {
      // Error already logged by tryCatch
      Alert.alert('Error', 'Failed to create journey. Please try again.');
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
      }, LogCategory.JOURNEY, 'creating direct journey for everyday deal', true);
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
      dealType: 'everyday'
    });
    
    if (!route || !route.vendors || route.vendors.length === 0) {
      throw new Error('Failed to create route with vendor');
    }
    
    // Start journey in app state
    dispatch(AppActions.startJourney({
      dealType: 'everyday',
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
    
    Logger.info(LogCategory.JOURNEY, 'Created direct journey for everyday deal', { 
      vendorId: deal.vendorId, 
      dealTitle: deal.title
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
  
  const renderDealItem = ({ item, index }) => (
    <Card containerStyle={styles.dealCard}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => createDirectJourney(item)}
      >
        <View style={styles.dealInfo}>
          <View style={styles.dealHeader}>
            <Text style={styles.dealTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>
          </View>
          
          <Text style={styles.vendorName} numberOfLines={1} ellipsizeMode="tail">{item.vendorName}</Text>
          
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{item.discount}</Text>
          </View>
          
          <View style={styles.distanceContainer}>
            <Icon name="place" type="material" size={14} color="#4CAF50" />
            <Text style={styles.distanceText}>
              {item.vendorDistance ? item.vendorDistance.toFixed(1) : '?'} miles away
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      
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
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Top banner */}
      <View style={styles.topDealsBanner}>
        <Text style={styles.bannerTitle}>Everyday Deals</Text>
        <Text style={styles.bannerSubtitle}>Regular menu offerings from dispensaries</Text>
        <View style={styles.filterButtonsRow}>
          <Button
            title="Browse Categories"
            type="outline"
            icon={{
              name: "category",
              type: "material",
              size: 18,
              color: "#4CAF50"
            }}
            buttonStyle={styles.categoryButton}
            containerStyle={styles.categoryButtonContainer}
            titleStyle={{ color: '#4CAF50' }}
            onPress={() => setShowCategories(true)}
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
            onPress={toggleSortByValue}
          />
        </View>
      </View>
      
      {/* Categories Modal */}
      <Modal
        visible={showCategories}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCategories(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Browse by Category</Text>
            
            <Divider width={1} style={{ marginVertical: 10 }} />
            
            {/* Categories Selector */}
            <View style={styles.categoryHeader}>
              <Text style={styles.sectionTitle}>Product Categories</Text>
              <Text style={styles.categoryCountText}>{selectedCategories.length}/10 selected</Text>
            </View>
            
            <ScrollView style={{ maxHeight: 300 }}>
              <View style={styles.categoriesGrid}>
                {categories.map(category => (
                  <TouchableOpacity
                    key={category.id}
                    style={styles.categoryItem}
                    onPress={() => toggleCategorySelection(category.id)}
                  >
                    <CheckBox
                      checked={selectedCategories.includes(category.id)}
                      onPress={() => toggleCategorySelection(category.id)}
                      containerStyle={styles.checkbox}
                      checkedColor="#4CAF50"
                    />
                    <Icon
                      name={category.icon}
                      type="material"
                      size={20}
                      color={selectedCategories.includes(category.id) ? "#4CAF50" : "#666666"}
                    />
                    <Text style={[
                      styles.categoryLabel,
                      selectedCategories.includes(category.id) && { color: '#4CAF50', fontWeight: 'bold' }
                    ]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            
            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <Button
                title="Clear All"
                type="outline"
                containerStyle={{ flex: 1, marginRight: 8 }}
                buttonStyle={{ borderColor: '#FF5722' }}
                titleStyle={{ color: '#FF5722' }}
                onPress={clearCategorySelection}
              />
              <Button
                title="Apply Filters"
                containerStyle={{ flex: 2 }}
                buttonStyle={{ backgroundColor: '#4CAF50' }}
                onPress={() => {
                  loadEverydayDeals();
                  setShowCategories(false);
                }}
              />
            </View>
            
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowCategories(false)}
            >
              <Icon name="close" type="material" size={24} color="#999" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Selected categories display */}
      {selectedCategories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedCategoriesScroll}>
          {selectedCategories.map(categoryId => {
            const category = categories.find(c => c.id === categoryId);
            return (
              <Chip
                key={categoryId}
                title={category?.label || categoryId}
                icon={{
                  name: category?.icon || 'label',
                  type: 'material',
                  size: 16,
                  color: 'white',
                }}
                buttonStyle={styles.activeFilterChip}
                titleStyle={styles.activeFilterChipText}
                onPress={() => toggleCategorySelection(categoryId)}
                containerStyle={styles.activeChipContainer}
              />
            );
          })}
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearCategorySelection}>
            <Text style={styles.clearFiltersText}>Clear All</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      
      <View style={styles.contentContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading everyday deals...</Text>
          </View>
        ) : (
          <FlatList
            data={deals.slice(0, 10)} // Only show top 10 deals
            renderItem={renderDealItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="local-offer" type="material" size={64} color="#CCCCCC" />
                <Text style={styles.emptyText}>No everyday deals found.</Text>
                <Text style={styles.emptySubtext}>Try adjusting your category filters.</Text>
              </View>
            }
          />
        )}
      </View>
      
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
    </SafeAreaView>
  );
};

// Styles matching the other deal screens
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
  categoryButtonContainer: {
    flex: 1,
    marginRight: 8,
  },
  categoryButton: {
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    position: 'relative',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  categoryCountText: {
    fontSize: 14,
    color: '#666',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  checkbox: {
    padding: 0,
    margin: 0,
    marginRight: 0,
    marginLeft: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  categoryLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
  },
  
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
  },
  selectedCategoriesScroll: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  activeFilterChip: {
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  activeFilterChipText: {
    color: 'white',
    fontSize: 12,
  },
  activeChipContainer: {
    marginRight: 4,
  },
  clearFiltersButton: {
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  clearFiltersText: {
    color: '#FF5722',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
  },
  listContainer: {
    paddingBottom: 10,
  },
});

export default EverydayDeals; 