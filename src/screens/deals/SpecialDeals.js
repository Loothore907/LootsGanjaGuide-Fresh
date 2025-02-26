// src/screens/deals/SpecialDeals.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { Text, Button, Card, Icon, CheckBox, Badge } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import { getSpecialDeals, createOptimizedRoute } from '../../services/MockDataService';

const SpecialDeals = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [maxDistance, setMaxDistance] = useState(state.dealFilters.maxDistance || 25);
  const [deals, setDeals] = useState([]);
  const [selectedDeals, setSelectedDeals] = useState([]);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  
  // Load deals on component mount
  useEffect(() => {
    loadSpecialDeals();
  }, [showActiveOnly, maxDistance]);
  
  const loadSpecialDeals = async () => {
    setIsLoading(true);
    setDeals([]);
    
    try {
      await tryCatch(async () => {
        const options = {
          maxDistance: maxDistance,
          activeOnly: showActiveOnly
        };
        
        const specialDeals = await getSpecialDeals(options);
        setDeals(specialDeals);
        
        Logger.info(LogCategory.DEALS, 'Loaded special deals', {
          count: specialDeals.length,
          maxDistance,
          activeOnly: showActiveOnly
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
    const end = new Date(endDate);
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  
  const renderDealItem = ({ item }) => {
    const daysRemaining = getDaysRemaining(item.endDate);
    const isActive = daysRemaining >= 0;
    
    // If showing active only and deal is inactive, don't render
    if (showActiveOnly && !isActive) return null;
    
    return (
      <Card containerStyle={styles.dealCard}>
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => toggleDealSelection(item.id)}
          disabled={!isActive}
        >
          <View style={styles.selectionIndicator}>
            <CheckBox
              checked={selectedDeals.includes(item.id)}
              onPress={() => toggleDealSelection(item.id)}
              containerStyle={styles.checkbox}
              disabled={!isActive}
            />
          </View>
          
          <View style={styles.dealInfo}>
            <Text style={styles.vendorName}>{item.vendorName}</Text>
            <Text style={styles.dealTitle}>{item.title}</Text>
            <Text style={styles.dealDescription}>{item.description}</Text>
            
            <View style={styles.discountContainer}>
              <Text style={styles.discountText}>{item.discount}</Text>
            </View>
            
            <View style={styles.dateContainer}>
              <Text style={styles.dateText}>
                {formatDate(item.startDate)} - {formatDate(item.endDate)}
              </Text>
              
              {isActive ? (
                <Badge 
                  value={`${daysRemaining} days left`} 
                  status="success"
                  containerStyle={styles.badgeContainer}
                />
              ) : (
                <Badge 
                  value="Expired" 
                  status="error"
                  containerStyle={styles.badgeContainer}
                />
              )}
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
              
              {item.vendorIsPartner && (
                <View style={styles.partnerBadge}>
                  <Text style={styles.partnerText}>PARTNER</Text>
                </View>
              )}
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
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filtersContainer}>
        <Text style={styles.title}>Special Offers</Text>
        <Text style={styles.subtitle}>Limited time promotions from local dispensaries</Text>
        
        <View style={styles.filterOptions}>
          <CheckBox
            title="Show active deals only"
            checked={showActiveOnly}
            onPress={() => setShowActiveOnly(!showActiveOnly)}
            containerStyle={styles.filterCheckbox}
          />
          
          <Button
            title="Refresh"
            type="outline"
            onPress={loadSpecialDeals}
            loading={isLoading}
            containerStyle={styles.refreshButton}
          />
        </View>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading special deals...</Text>
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
                <Icon name="event" type="material" size={64} color="#CCCCCC" />
                <Text style={styles.emptyText}>No special deals found.</Text>
                <Text style={styles.emptySubtext}>
                  {showActiveOnly 
                    ? "Try showing expired deals or check back later for new promotions."
                    : "No special deals are available at this time."}
                </Text>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  filterOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterCheckbox: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0,
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
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dealDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  discountContainer: {
    backgroundColor: '#E91E63',
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
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#666666',
    marginRight: 8,
  },
  badgeContainer: {
    marginLeft: 'auto',
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
  partnerBadge: {
    marginLeft: 'auto',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  partnerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
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

export default SpecialDeals;