// src/screens/deals/JourneySettings.js

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
  Icon
} from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppState, AppActions } from '../../context/AppStateContext';
import routeService from '../../services/RouteService';
import locationService from '../../services/LocationService';
import { Logger, LogCategory } from '../../services/LoggingService';
import * as Location from 'expo-location';

const JourneySettings = ({ navigation, route }) => {
  const { state, dispatch } = useAppState();
  const { dealType = 'birthday' } = route.params || {};
  
  // State variables
  const [numVendors, setNumVendors] = useState(3);
  const [maxDistance, setMaxDistance] = useState(15);
  const [isLoading, setIsLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState('unknown');
  
  // Get current location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);
  
  // Get current location with better error handling
  const getCurrentLocation = async () => {
    setLocationStatus('requesting');
    try {
      // Request permission first
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Logger.warn(LogCategory.LOCATION, 'Location permission denied by user');
        setLocationStatus('denied');
        return;
      }
      
      // Try to get current position with a timeout
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      // Set a timeout of 10 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Location request timed out')), 10000);
      });
      
      // Race the location request against the timeout
      const location = await Promise.race([locationPromise, timeoutPromise]);
      
      if (location && location.coords) {
        const userLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        };
        dispatch(AppActions.updateUserLocation(userLocation));
        setLocationStatus('granted');
        Logger.info(LogCategory.LOCATION, 'Successfully obtained user location');
      } else {
        throw new Error('Invalid location data received');
      }
    } catch (error) {
      // More detailed error logging
      Logger.error(LogCategory.LOCATION, 'Error getting current location', { 
        error: error.message || 'Unknown error',
        stack: error.stack
      });
      setLocationStatus('error');
      
      // More helpful error message
      Alert.alert(
        'Location Error',
        'We had trouble getting your location. Please check your device settings and try again.',
        [{ text: 'OK' }]
      );
    }
  };
  
  // Create a journey route based on selected options
  const handleCreateRoute = async () => {
    // Check location first
    if (locationStatus !== 'granted' || !state.user?.location) {
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
        dealType: dealType,
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
        dealType: dealType,
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
        dealType: dealType,
        vendorCount: routeResult.vendors.length,
        totalDistance: routeResult.totalDistance
      });
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error creating journey', { 
        error: error.message || 'Unknown error',
        stack: error.stack
      });
      Alert.alert(
        'Error',
        'Failed to create your journey. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.header}>Journey Settings</Text>
        
        {/* Journey Type Indicator */}
        <View style={styles.journeyTypeContainer}>
          <Icon
            name={dealType === 'birthday' ? 'cake' : 
                 dealType === 'daily' ? 'today' : 'stars'}
            type="material"
            size={32}
            color="#4CAF50"
          />
          <Text style={styles.journeyTypeText}>
            {dealType === 'birthday' ? 'Birthday Deals' : 
             dealType === 'daily' ? 'Daily Deals' : 'Special Deals'} Journey
          </Text>
        </View>
        
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
            <Text>7</Text>
            <Text>10</Text>
          </View>
        </View>
        
        {/* Max Distance */}
        <Text style={styles.sectionTitle}>Maximum Distance (miles)</Text>
        <View style={styles.sliderContainer}>
          <Slider
            value={maxDistance}
            onValueChange={value => setMaxDistance(value)}
            minimumValue={5}
            maximumValue={25}
            step={5}
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
            <Text>5</Text>
            <Text>10</Text>
            <Text>15</Text>
            <Text>20</Text>
            <Text>25</Text>
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
          title="Start Journey"
          icon={{
            name: 'directions',
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
  journeyTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
  },
  journeyTypeText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
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
});

export default JourneySettings;