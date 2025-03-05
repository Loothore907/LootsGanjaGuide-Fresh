// src/screens/deals/DailyDeals.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  Alert,
  Image
} from 'react-native';
import { 
  Text, 
  Button, 
  Card, 
  Icon, 
  CheckBox, 
  Chip, 
  Divider,
  Overlay 
} from '@rneui/themed';
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
  const [showCategories, setShowCategories] = useState(false);
  
  // Product categories
  const categories = [
    { id: 'flower', label: 'Flower', icon: 'local-florist' },
    { id: 'prerolls', label: 'Pre-rolls', icon: 'filter-list' },
    { id: 'cartridges', label: 'Cartridges', icon: 'battery-std' },
    { id: 'concentrates', label: 'Concentrates', icon: 'opacity' },
    { id: 'edibles', label: 'Edibles', icon: 'restaurant' },
    { id: 'accessories', label: 'Accessories', icon: 'devices' },
    { id: 'misc', label: 'Miscellaneous', icon: 'more-horiz' },
    { id: 'everyday', label: 'Everyday Deals', icon: 'local-offer' }
  ];
  
  // Days of the week
  const daysOfWeek = [
    { id: 'monday', label: 'Mon' },
    { id: 'tuesday', label: 'Tue' },
    { id: 'wednesday', label: 'Wed' },
    { id: 'thursday', label: 'Thu' },
    { id: 'friday', label: 'Fri' },
    { id: 'saturday', label: 'Sat' },
    { id: 'sunday', label: 'Sun' },
    { id: 'everyday', label: 'All' }
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
        
        // Sort by "true value" (simulated here - you would implement your own logic)
        const sortedDeals = dailyDeals.sort((a, b) => {
          // Calculate "true value" - this is just an example
          // You would replace this with your actual value calculation
          const valueA = parseInt(a.discount) || 0;
          const valueB = parseInt(b.discount) || 0;
          return valueB - valueA; // Higher discount first
        });
        
        setDeals(sortedDeals);
        
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
    // ... existing code ...
  };
  
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId === selectedCategory ? null : categoryId);
  };
  
  const handleDaySelect = (day) => {
    setCurrentDay(day);
  };
  
  const handleCreateJourney = async () => {
    // ... existing code ...
  };
  
  const renderDealItem = ({ item, index }) => (
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
          
          <View style={styles.dealTitleContainer}>
            <Text style={styles.dealTitle}>{item.title}</Text>
            {item.isEveryday && (
              <Chip
                title="Everyday"
                buttonStyle={styles.everydayChip}
                titleStyle={styles.everydayChipText}
              />
            )}
          </View>
          
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
        onPress={async () => {
          try {
            // Create a single-vendor journey with complete vendor structure
            const selectedVendor = {
              id: item.vendorId,
              name: item.vendorName,
              location: {
                address: item.vendorAddress || "Address unavailable",
                coordinates: {
                  latitude: item.vendorCoordinates?.latitude || 61.2175,
                  longitude: item.vendorCoordinates?.longitude || -149.8584
                }
              },
              distance: item.vendorDistance || 0,
              // Add the deals structure that RoutePreview expects
              deals: {
                daily: {
                  // Initialize daily deals structure for all days
                  monday: [],
                  tuesday: [],
                  wednesday: [],
                  thursday: [],
                  friday: [],
                  saturday: [],
                  sunday: []
                },
                birthday: null,
                special: []
              }
            };
            
            // Add the current deal to the appropriate day
            const today = getDayOfWeek();
            selectedVendor.deals.daily[today] = [{
              description: item.description || item.title || "Daily Deal",
              discount: item.discount || "Special Offer",
              restrictions: item.restrictions || []
            }];
            
            // Start journey in app state with just one vendor
            dispatch(AppActions.startJourney({
              dealType: 'daily',
              vendors: [selectedVendor],
              maxDistance: maxDistance || 25,
              totalVendors: 1
            }));
            
            // Update route information
            dispatch(AppActions.updateRoute({
              coordinates: [selectedVendor.location.coordinates],
              totalDistance: selectedVendor.distance,
              estimatedTime: Math.round(selectedVendor.distance * 3) // 3 min per mile estimate
            }));
            
            Logger.info(LogCategory.JOURNEY, 'Single vendor journey created', {
              vendorName: selectedVendor.name,
              distance: selectedVendor.distance
            });
            
            // Navigate to route preview (same as Birthday Deals flow)
            navigation.navigate('RoutePreview');
          } catch (error) {
            Logger.error(LogCategory.NAVIGATION, 'Error creating single vendor journey', { error });
            Alert.alert('Navigation Error', 'Unable to get directions at this time.');
          }
        }}
      />

    </View>
    </Card>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Banner for top deals */}
      <View style={styles.topDealsBanner}>
        <Text style={styles.bannerTitle}>Today's Top Deals</Text>
        <Text style={styles.bannerSubtitle}>The best cannabis deals in Anchorage</Text>
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
      </View>
      
      {/* Categories Overlay */}
      <Overlay 
        isVisible={showCategories} 
        onBackdropPress={() => setShowCategories(false)}
        overlayStyle={styles.overlay}
      >
        <View style={styles.overlayContent}>
          <Text style={styles.overlayTitle}>Browse by Category</Text>
          
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
          
          <Text style={styles.sectionTitle}>Product Categories</Text>
          <ScrollView style={{maxHeight: 300}}>
            <View style={styles.categoriesGrid}>
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
            </View>
          </ScrollView>
          
          <Button
            title="Apply Filters"
            buttonStyle={{ backgroundColor: '#4CAF50' }}
            containerStyle={{ marginTop: 20 }}
            onPress={() => {
              loadDailyDeals();
              setShowCategories(false);
            }}
          />
          
          <Button
            title="Close"
            type="clear"
            containerStyle={{ marginTop: 10 }}
            onPress={() => setShowCategories(false)}
          />
        </View>
      </Overlay>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading daily deals...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={deals.slice(0, 10)} // Only show top 10 deals
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

// Add these styles to your existing styles
const styles = StyleSheet.create({
  // ... keep your existing styles ...
  
  topDealsBanner: {
    backgroundColor: '#4CAF50',
    padding: 16,
    alignItems: 'center',
  },
  bannerTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bannerSubtitle: {
    color: 'white',
    fontSize: 14,
    marginBottom: 16,
  },
  categoryButton: {
    backgroundColor: 'white',
    borderColor: 'white',
    paddingHorizontal: 20,
  },
  categoryButtonContainer: {
    width: '80%',
  },
  overlay: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 10,
    padding: 20,
  },
  overlayContent: {
    flex: 1,
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  dealTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4
  },
  
  everydayChip: {
    backgroundColor: '#4CAF50',
    marginLeft: 8,
    height: 24,
    borderRadius: 12
  },
  
  everydayChipText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold'
  },
  
  // Continue with your existing styles...
});

export default DailyDeals;