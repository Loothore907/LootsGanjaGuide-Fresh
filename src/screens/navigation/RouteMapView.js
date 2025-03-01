// src/screens/navigation/RouteMapView.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  TouchableOpacity,
  Dimensions,
  FlatList,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Button, Card, Icon, Divider, ListItem } from '@rneui/themed';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { Logger, LogCategory } from '../../services/LoggingService';
import { tryCatch } from '../../utils/ErrorHandler';
import AdLoadingScreen from '../../components/AdLoadingScreen';
import env from '../../config/env';
import locationService from '../../services/LocationService';
import routeService from '../../services/RouteService';

const { width, height } = Dimensions.get('window');

/**
 * RouteMapView Component
 * 
 * Shows the entire journey route with all vendors
 * Allows users to navigate between vendors in the journey
 */
const RouteMapView = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [isAdVisible, setIsAdVisible] = useState(true);
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  // Get journey vendors from state
  const { vendors, currentVendorIndex } = state.journey;
  const currentVendor = vendors[currentVendorIndex];
  
  // Determine if this is the last vendor in the journey
  const isLastVendor = state.journey.currentVendorIndex === state.journey.vendors.length - 1;

  // Set up location tracking and route
  useEffect(() => {
    let isMounted = true;
    
    const initializeMap = async () => {
      try {
        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          setIsLoading(false);
          return;
        }

        // Get initial location
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        if (isMounted) {
          setUserLocation(initialLocation.coords);
          
          // Create route coordinates
          const coordinates = [
            { latitude: initialLocation.coords.latitude, longitude: initialLocation.coords.longitude }
          ];
          
          // Add all vendor coordinates to the route
          vendors.forEach(vendor => {
            coordinates.push({
              latitude: vendor.location.coordinates.latitude,
              longitude: vendor.location.coordinates.longitude
            });
          });
          
          setRouteCoordinates(coordinates);
          
          // Fit map to show the entire route
          if (mapRef.current) {
            mapRef.current.fitToCoordinates(
              coordinates,
              {
                edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
                animated: true,
              }
            );
          }
          
          setIsLoading(false);
        }
        
        // Start watching position for real-time updates
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10, // Update every 10 meters
            timeInterval: 10000, // Or every 10 seconds
          },
          (location) => {
            if (isMounted) {
              setUserLocation(location.coords);
              
              // Update first coordinate in the route (user's location)
              if (routeCoordinates.length > 0) {
                const newCoordinates = [...routeCoordinates];
                newCoordinates[0] = {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude
                };
                setRouteCoordinates(newCoordinates);
              }
            }
          }
        );
      } catch (error) {
        if (isMounted) {
          Logger.error(LogCategory.NAVIGATION, 'Error initializing map', { error });
          setErrorMsg('Error getting your location. Please check your GPS settings.');
          setIsLoading(false);
        }
      }
    };

    // Only initialize after ad is hidden
    if (!isAdVisible) {
      initializeMap();
    }

    // Cleanup function
    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [vendors, isAdVisible]);

  // Calculate total journey distance
  const calculateTotalDistance = () => {
    let total = 0;
    
    if (routeCoordinates.length < 2) return total;
    
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const coord1 = routeCoordinates[i];
      const coord2 = routeCoordinates[i + 1];
      
      total += locationService.calculateDistance(
        coord1.latitude,
        coord1.longitude,
        coord2.latitude,
        coord2.longitude
      );
    }
    
    return total;
  };

  // Handle ad finish
  const handleAdFinish = () => {
    setIsAdVisible(false);
  };

  // Navigate to a specific vendor
  const navigateToVendor = (index) => {
    // Update current vendor index in state
    dispatch(AppActions.setCurrentVendorIndex(index));
    
    // Navigate to the map view for that vendor
    navigation.navigate('MapView', { vendorId: vendors[index].id });
  };

  // End the journey
  const endJourney = () => {
    Alert.alert(
      'End Journey',
      'Are you sure you want to end this journey? This will terminate your current progress.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Journey', 
          style: 'destructive',
          onPress: () => {
            // Check if journey is "complete" - all vendors have been checked in
            const allVendorsCheckedIn = vendors.every(vendor => vendor.checkedIn);
            
            // Navigate to journey complete with the appropriate termination type
            navigation.navigate('JourneyComplete', { 
              terminationType: allVendorsCheckedIn ? "success" : "early" 
            });
          }
        }
      ]
    );
  };

  // Handle "I'm Here" button click for arrival confirmation
  const handleArrivalConfirmation = (vendor) => {
    // Navigate to check-in screen
    navigation.navigate('VendorCheckin', { 
      vendorId: vendor.id,
      fromJourney: true 
    });
  };

  // Add the handleSkipVendor function
  const handleSkipVendor = async () => {
    try {
      // Skip the current vendor
      await dispatch(AppActions.skipVendor());
      
      // Check if there are still vendors left in the journey
      if (state.journey.vendors.length === 0 || 
          state.journey.currentVendorIndex >= state.journey.vendors.length) {
        // No vendors left, complete the journey
        navigation.navigate('JourneyComplete', { 
          terminationType: "success" 
        });
        
        Logger.info(LogCategory.JOURNEY, 'Completed journey after skipping last vendor');
      } else {
        // There are more vendors, refresh the route view to show the next vendor
        navigation.replace('RouteMapView');
        
        Logger.info(LogCategory.JOURNEY, 'Skipped to next vendor', {
          skippedVendorName: currentVendor?.name,
          remainingVendorCount: state.journey.vendors.length - state.journey.currentVendorIndex
        });
      }
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error skipping vendor', { error });
      Alert.alert('Error', 'Failed to skip this stop. Please try again.');
    }
  };

  // Update the handleEndJourney function
  const handleEndJourney = () => {
    Alert.alert(
      'End Journey',
      'Are you sure you want to end this journey? This will terminate your current progress.',
      [
        { text: 'CANCEL', style: 'cancel' },
        { 
          text: 'END JOURNEY', 
          style: 'destructive',
          onPress: () => {
            // Navigate to journey complete with early termination
            navigation.navigate('JourneyComplete', { 
              terminationType: "early" 
            });
          }
        }
      ]
    );
  };

  // Render each vendor in the journey list
  const renderVendorItem = ({ item, index }) => (
    <ListItem
      containerStyle={[
        styles.vendorItem,
        index === currentVendorIndex && styles.currentVendorItem
      ]}
      onPress={() => navigateToVendor(index)}
    >
      <ListItem.Content>
        <View style={styles.vendorItemHeader}>
          <View style={styles.vendorNumberContainer}>
            <Text style={styles.vendorNumber}>{index + 1}</Text>
          </View>
          <View style={styles.vendorDetails}>
            <ListItem.Title style={styles.vendorTitle}>{item.name}</ListItem.Title>
            <ListItem.Subtitle style={styles.vendorAddress}>
              {item.location.address}
            </ListItem.Subtitle>
          </View>
        </View>
      </ListItem.Content>
      
      {index === currentVendorIndex ? (
        <TouchableOpacity 
          style={styles.imHereButton}
          onPress={() => handleArrivalConfirmation(item)}
        >
          <Text style={styles.imHereText}>I'm Here</Text>
        </TouchableOpacity>
      ) : (
        <Icon name="chevron-right" type="material" color="#666" />
      )}
    </ListItem>
  );

  // Show loading screen or ad
  if (isAdVisible) {
    return (
      <AdLoadingScreen 
        minDisplayTime={3000}
        onFinish={handleAdFinish}
      />
    );
  }

  // Show error message if we couldn't get location
  if (errorMsg) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="location-off" type="material" size={64} color="#F44336" />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            buttonStyle={styles.errorButton}
            containerStyle={styles.errorButtonContainer}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Your Journey</Text>
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{vendors.length}</Text>
            <Text style={styles.headerStatLabel}>Stops</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>
              {calculateTotalDistance().toFixed(1)}
            </Text>
            <Text style={styles.headerStatLabel}>Miles</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>
              {Math.round(calculateTotalDistance() * 3)}
            </Text>
            <Text style={styles.headerStatLabel}>Minutes</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.content}>
        <View style={styles.mapContainer}>
          {isLoading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: userLocation?.latitude || env.DEFAULT_LATITUDE,
                longitude: userLocation?.longitude || env.DEFAULT_LONGITUDE,
                latitudeDelta: env.DEFAULT_DELTA,
                longitudeDelta: env.DEFAULT_DELTA,
              }}
              showsUserLocation={true}
            >
              {/* Vendor markers */}
              {vendors.map((vendor, index) => (
                <Marker
                  key={vendor.id}
                  coordinate={{
                    latitude: vendor.location.coordinates.latitude,
                    longitude: vendor.location.coordinates.longitude,
                  }}
                  title={vendor.name}
                  description={`Stop ${index + 1}`}
                >
                  <View style={[
                    styles.markerContainer,
                    index === currentVendorIndex && styles.currentMarkerContainer
                  ]}>
                    <Text style={styles.markerText}>{index + 1}</Text>
                  </View>
                </Marker>
              ))}
              
              {/* Route line */}
              {routeCoordinates.length > 1 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeWidth={3}
                  strokeColor="#4CAF50"
                />
              )}
            </MapView>
          )}
          
          {/* Map control buttons */}
          <View style={styles.mapControls}>
            <TouchableOpacity 
              style={styles.mapControlButton}
              onPress={() => {
                if (mapRef.current && routeCoordinates.length > 0) {
                  mapRef.current.fitToCoordinates(
                    routeCoordinates,
                    {
                      edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
                      animated: true,
                    }
                  );
                }
              }}
            >
              <Icon name="fullscreen" type="material" color="#333" size={22} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.mapControlButton}
              onPress={() => {
                if (userLocation && mapRef.current) {
                  mapRef.current.animateToRegion({
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  });
                }
              }}
            >
              <Icon name="my-location" type="material" color="#333" size={22} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.vendorListContainer}>
          <Text style={styles.vendorListTitle}>Stops on Your Journey</Text>
          
          <FlatList
            data={vendors}
            renderItem={renderVendorItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.vendorList}
          />
          
          <View style={styles.actionButtons}>
            {/* Show Skip button if we're not on the last vendor */}
            {!isLastVendor && (
              <Button
                title={`Skip ${currentVendor?.name || 'Current Stop'}`}
                icon={{
                  name: "skip-next",
                  type: "material",
                  size: 20,
                  color: "white"
                }}
                onPress={handleSkipVendor}
                buttonStyle={styles.continueButton}
                containerStyle={styles.continueButtonContainer}
              />
            )}
            
            {/* End Journey button is always visible */}
            <Button
              title="End Journey"
              type="outline"
              onPress={handleEndJourney}
              buttonStyle={styles.endButton}
              containerStyle={[
                styles.endButtonContainer,
                isLastVendor && styles.fullWidthButton
              ]}
              titleStyle={styles.endButtonTitle}
            />
          </View>       
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerContainer: {
    backgroundColor: '#4CAF50',
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerStat: {
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
  },
  mapContainer: {
    height: height * 0.35,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  mapControls: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'column',
  },
  mapControlButton: {
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  markerContainer: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  currentMarkerContainer: {
    backgroundColor: '#4CAF50',
    width: 36,
    height: 36,
  },
  markerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  vendorListContainer: {
    flex: 1,
    padding: 16,
  },
  vendorListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  vendorList: {
    flexGrow: 1,
  },
  vendorItem: {
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ddd',
  },
  currentVendorItem: {
    borderLeftColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  vendorItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vendorNumberContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  vendorNumber: {
    fontWeight: 'bold',
    color: '#333',
  },
  vendorDetails: {
    flex: 1,
  },
  vendorTitle: {
    fontWeight: 'bold',
  },
  vendorAddress: {
    fontSize: 12,
    color: '#666',
  },
  imHereButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  imHereText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  actionButtons: {
    marginTop: 16,
  },
  continueButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  continueButtonContainer: {
    marginBottom: 10,
  },
  endButton: {
    borderColor: '#F44336',
    borderRadius: 8,
    paddingVertical: 12,
  },
  endButtonTitle: {
    color: '#F44336',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#4CAF50',
  },
  errorButtonContainer: {
    width: '80%',
  },
  fullWidthButton: {
    width: '100%', // Full width when it's the only button
  },
});

export default RouteMapView;