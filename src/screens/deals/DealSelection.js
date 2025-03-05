// src/screens/deals/DealSelection.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { 
  Text, 
  Button, 
  Slider, 
  Icon,
  Card,
  Divider
} from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppState, AppActions } from '../../context/AppStateContext';
import routeService from '../../services/RouteService';
import locationService from '../../services/LocationService';
import { Logger, LogCategory } from '../../services/LoggingService';
import redemptionService from '../../services/RedemptionService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DealSelection = ({ navigation, route }) => {
  const { state, dispatch } = useAppState();
  
  // Get the deal type passed from the previous screen
  const selectedDealType = route.params?.dealType || route.params?.initialDealType || 'daily';
  
  // State variables
  const [numVendors, setNumVendors] = useState(3);
  const [maxDistance, setMaxDistance] = useState(10); // Default starting value is now 10
  const [isLoading, setIsLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState('unknown');
  const [recentRedemptions, setRecentRedemptions] = useState([]);
  
  // Get current location and recent redemptions on mount
  useEffect(() => {
    getCurrentLocation();
    loadRecentRedemptions();
  }, []);
  
  // Function to load recent redemptions for display
  const loadRecentRedemptions = async () => {
    try {
      const redemptions = await redemptionService.getRedemptions();
      // Get only recent redemptions (last 24 hours)
      const now = new Date();
      const recentOnly = redemptions.filter(r => {
        const timestamp = new Date(r.timestamp);
        const timeDiff = now - timestamp;
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        return hoursDiff < 24;
      });
      
      setRecentRedemptions(recentOnly);
    } catch (error) {
      Logger.error(LogCategory.REDEMPTION, 'Failed to load recent redemptions', { error });
    }
  };
  
  // Get current location
  const getCurrentLocation = async () => {
    setLocationStatus('requesting');
    try {
      const location = await locationService.getCurrentLocation();
      if (location) {
        dispatch(AppActions.updateUserLocation(location));
        setLocationStatus('granted');
      } else {
        setLocationStatus('denied');
      }
    } catch (error) {
      Logger.error(LogCategory.LOCATION, 'Error getting current location', { error });
      setLocationStatus('error');
    }
  };
  
  // Create a journey route based on selected options
  const handleCreateRoute = async () => {
    // Check location first
    if (locationStatus !== 'granted' || !state.user.location) {
      Alert.alert(
        'Location Required',
        'We need your location to create an optimized route. Please grant location permission and try again.',
        [
          { text: 'OK', onPress: getCurrentLocation }
        ]
      );
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create route using the route service
      const routeOptions = {
        dealType: selectedDealType,
        maxVendors: numVendors,
        maxDistance: maxDistance,
        startLocation: state.user.location
      };
      
      const routeResult = await routeService.createRoute(routeOptions);
      
      if (!routeResult.success) {
        Alert.alert(
          'Route Creation Failed',
          routeResult.error || 'Unable to create route. Please try different options.',
          [{ text: 'OK' }]
        );
        setIsLoading(false);
        return;
      }
      
      // Check if we found enough vendors
      if (routeResult.vendors.length === 0) {
        Alert.alert(
          'No Vendors Found',
          'We couldn\'t find any vendors with the selected deal type. Please try increasing your search distance.',
          [{ text: 'OK' }]
        );
        setIsLoading(false);
        return;
      }
      
      // Create journey state
      const journeyData = {
        dealType: selectedDealType,
        vendors: routeResult.vendors.map(vendor => ({
          ...vendor,
          checkedIn: false,
          checkInType: null
        })),
        currentVendorIndex: 0,
        totalVendors: routeResult.vendors.length,
        maxDistance: maxDistance,
        isActive: true,
        startTime: new Date().toISOString()
      };
      
      // Update app state with journey and route data
      dispatch(AppActions.startJourney(journeyData));
      dispatch(AppActions.updateRoute({
        path: routeResult.vendors,
        totalDistance: routeResult.totalDistance
      }));
      
      // Navigate to route preview
      navigation.navigate('RoutePreview');
      
      Logger.info(LogCategory.JOURNEY, 'Journey started', {
        dealType: selectedDealType,
        vendorCount: routeResult.vendors.length,
        totalDistance: routeResult.totalDistance
      });
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error creating journey', { error });
      Alert.alert(
        'Error',
        'Failed to create your journey. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render recent redemptions
  const renderRecentRedemptions = () => {
    if (recentRedemptions.length === 0) {
      return null;
    }
    
    return (
      <Card containerStyle={styles.recentRedemptionsCard}>
        <Card.Title>Recent Redemptions (Last 24hrs)</Card.Title>
        <Card.Divider />
        {recentRedemptions.map((redemption, index) => (
          <View key={redemption.id || index} style={styles.redemptionItem}>
            <Icon name="check-circle" type="material" color="#4CAF50" size={16} />
            <Text style={styles.redemptionText}>
              {redemption.dealType.charAt(0).toUpperCase() + redemption.dealType.slice(1)} deal at {redemption.vendorId} 
              ({new Date(redemption.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
            </Text>
          </View>
        ))}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.header}>Select Your Journey</Text>
        
        {/* Recent Redemptions */}
        {renderRecentRedemptions()}
        
        {/* Number of Vendors */}
        <Text style={styles.sectionTitle}>Number of Dispensaries</Text>
        <View style={styles.sliderContainer}>
          <Slider
            value={numVendors}
            onValueChange={value => setNumVendors(value)}
            minimumValue={1}
            maximumValue={10}
            step={1}
            thumbStyle={styles.thumbStyle}
            thumbProps={{
              children: (
                <Text style={styles.thumbText}>{numVendors}</Text>
              ),
            }}
            trackStyle={styles.trackStyle}
            minimumTrackTintColor="#4CAF50"
          />
          <View style={styles.sliderLabels}>
            <Text>1</Text>
            <Text>3</Text>
            <Text>5</Text>
            <Text>8</Text>
            <Text>10</Text>
          </View>
        </View>
        
        {/* Max Distance */}
        <Text style={styles.sectionTitle}>Maximum Distance (miles)</Text>
        <View style={styles.sliderContainer}>
          <Slider
            value={maxDistance}
            onValueChange={value => setMaxDistance(value)}
            minimumValue={10}
            maximumValue={100}
            step={25}
            thumbStyle={styles.thumbStyle}
            thumbProps={{
              children: (
                <Text style={styles.thumbText}>{maxDistance}</Text>
              ),
            }}
            trackStyle={styles.trackStyle}
            minimumTrackTintColor="#4CAF50"
          />
          <View style={styles.sliderLabels}>
            <Text>10</Text>
            <Text>35</Text>
            <Text>60</Text>
            <Text>85</Text>
            <Text>100</Text>
          </View>
        </View>
        
        {/* Location Status */}
        <View style={styles.locationStatusContainer}>
          <Icon
            name={locationStatus === 'granted' ? 'location-on' : 'location-off'}
            type="material"
            color={locationStatus === 'granted' ? '#4CAF50' : '#F44336'}
            size={24}
          />
          <Text style={[
            styles.locationStatusText,
            locationStatus === 'granted' ? styles.locationGranted : styles.locationDenied
          ]}>
            {locationStatus === 'granted'
              ? 'Location: Available'
              : locationStatus === 'requesting'
                ? 'Location: Requesting...'
                : 'Location: Not Available'}
          </Text>
          {locationStatus !== 'granted' && locationStatus !== 'requesting' && (
            <Button
              title="Enable Location"
              type="clear"
              onPress={getCurrentLocation}
              titleStyle={styles.locationButton}
            />
          )}
        </View>
        
        {/* Create Route Button */}
        <Button
          title="Create Route"
          icon={{
            name: 'route',
            type: 'material',
            size: 20,
            color: 'white'
          }}
          buttonStyle={styles.createRouteButton}
          containerStyle={styles.createRouteButtonContainer}
          disabled={isLoading || locationStatus !== 'granted'}
          disabledStyle={styles.disabledButton}
          onPress={handleCreateRoute}
        />
        
        {isLoading && (
          <ActivityIndicator 
            size="large" 
            color="#4CAF50" 
            style={styles.loadingIndicator} 
          />
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
  scrollContainer: {
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#333333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#333333',
  },
  sliderContainer: {
    marginBottom: 24,
  },
  thumbStyle: {
    backgroundColor: '#4CAF50',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  trackStyle: {
    height: 6,
    borderRadius: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  locationStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  locationStatusText: {
    marginLeft: 8,
    flex: 1,
  },
  locationGranted: {
    color: '#4CAF50',
  },
  locationDenied: {
    color: '#F44336',
  },
  locationButton: {
    color: '#4CAF50',
  },
  createRouteButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  createRouteButtonContainer: {
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  loadingIndicator: {
    marginTop: 16,
  },
  recentRedemptionsCard: {
    marginBottom: 16,
    borderRadius: 8,
  },
  redemptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  redemptionText: {
    marginLeft: 8,
    fontSize: 14,
  },
});

export default DealSelection;