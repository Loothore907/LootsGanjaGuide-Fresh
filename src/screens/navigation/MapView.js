// src/screens/navigation/MapView.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Linking, 
  Platform, 
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Button, Card, Icon, Divider } from '@rneui/themed';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { Logger, LogCategory } from '../../services/LoggingService';
import { tryCatch } from '../../utils/ErrorHandler';
import AdLoadingScreen from '../../components/AdLoadingScreen';
import env from '../../config/env';
import locationService from '../../services/LocationService';

/**
 * MapViewScreen Component
 * 
 * Shows navigation to a single vendor with real-time updates
 * Displays distance and direction to the selected vendor
 */
const MapViewScreen = ({ route, navigation }) => {
  const { state, dispatch } = useAppState();
  const { vendorId } = route.params || {};
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [distance, setDistance] = useState(null);
  const [bearing, setBearing] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [isAdVisible, setIsAdVisible] = useState(true);
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  // Get the current vendor from state or direct parameter
  const currentVendor = vendorId 
    ? state.vendorData.list.find(v => v.id === vendorId) 
    : state.journey.vendors[state.journey.currentVendorIndex];

  // Set up location tracking and route
  useEffect(() => {
    let isMounted = true;
    
    const startLocationUpdates = async () => {
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
          updateDistanceAndBearing(initialLocation.coords);

          // Fit map to show both user and destination
          if (mapRef.current && currentVendor) {
            fitMapToShowMarkers(initialLocation.coords);
          }
        }
        
        // Start watching position for real-time updates
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10, // Update every 10 meters
            timeInterval: 5000, // Or every 5 seconds
          },
          (location) => {
            if (isMounted) {
              setUserLocation(location.coords);
              updateDistanceAndBearing(location.coords);
              updateRouteToVendor(location.coords);
            }
          }
        );
      } catch (error) {
        if (isMounted) {
          Logger.error(LogCategory.NAVIGATION, 'Error getting location', { error });
          setErrorMsg('Error getting your location. Please check your GPS settings.');
          setIsLoading(false);
        }
      }
    };

    // Only start location updates after ad is hidden
    if (!isAdVisible) {
      startLocationUpdates();
    }

    // Cleanup function
    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [currentVendor, isAdVisible]);

  // Calculate the distance and bearing to the vendor
  const updateDistanceAndBearing = (userCoords) => {
    if (!userCoords || !currentVendor) return;

    const vendorCoords = currentVendor.location.coordinates;
    
    // Calculate distance
    const dist = locationService.calculateDistance(
      userCoords.latitude,
      userCoords.longitude,
      vendorCoords.latitude,
      vendorCoords.longitude
    );
    setDistance(dist);

    // Calculate bearing
    const bear = locationService.calculateBearing(
      userCoords.latitude,
      userCoords.longitude,
      vendorCoords.latitude,
      vendorCoords.longitude
    );
    setBearing(bear);
  };

  // Update the route between user and vendor
  const updateRouteToVendor = async (userCoords) => {
    if (!userCoords || !currentVendor) return;

    try {
      // In a production app, we would call a directions API here
      // For now, just create a direct line between points
      const vendorCoords = currentVendor.location.coordinates;
      
      setRouteCoordinates([
        { latitude: userCoords.latitude, longitude: userCoords.longitude },
        { latitude: vendorCoords.latitude, longitude: vendorCoords.longitude }
      ]);
      
      setIsLoading(false);
    } catch (error) {
      Logger.error(LogCategory.NAVIGATION, 'Error updating route', { error });
    }
  };

  // Fit the map to show both the user location and destination
  const fitMapToShowMarkers = (userCoords) => {
    if (!userCoords || !currentVendor || !mapRef.current) return;

    const vendorCoords = currentVendor.location.coordinates;
    
    mapRef.current.fitToCoordinates(
      [
        { latitude: userCoords.latitude, longitude: userCoords.longitude },
        { latitude: vendorCoords.latitude, longitude: vendorCoords.longitude }
      ],
      {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      }
    );
  };

  // Get a direction arrow based on bearing
  const getDirectionArrow = (bearing) => {
    if (bearing === null) return '';
    
    // Convert bearing to 8 cardinal directions
    const normalized = Math.round(bearing / 45);
    const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    return arrows[normalized % 8];
  };

  // Get cardinal direction name
  const getDirectionName = (bearing) => {
    if (bearing === null) return '';
    
    const directions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  };

  // Open the vendor in external maps app
  const openInMaps = () => {
    if (!currentVendor) return;

    const { latitude, longitude } = currentVendor.location.coordinates;
    const label = encodeURIComponent(currentVendor.name);
    const scheme = Platform.select({
      ios: 'maps:0,0?q=',
      android: 'geo:0,0?q='
    });
    const latLng = `${latitude},${longitude}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });

    Linking.openURL(url).catch(err => {
      Logger.error(LogCategory.NAVIGATION, 'Error opening maps app', { error: err });
      Alert.alert('Error', 'Could not open maps application');
    });
  };

  // Check if user has arrived at destination
  const handleArrival = () => {
    // Check if we're close enough (within 0.1 miles)
    if (distance && distance <= 0.1) {
      navigation.navigate('VendorCheckin', { vendorId: currentVendor.id });
    } else {
      Alert.alert(
        'Not Close Enough',
        `You need to be closer to ${currentVendor.name} to check in. Current distance: ${distance.toFixed(2)} miles.`,
        [{ text: 'OK' }]
      );
    }
  };

  // Handle ad finish
  const handleAdFinish = () => {
    setIsAdVisible(false);
  };

  // Show loading screen or ad
  if (isAdVisible) {
    return (
      <AdLoadingScreen 
        minDisplayTime={3000}
        onFinish={handleAdFinish}
        vendorId={currentVendor?.id}
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
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      ) : (
        <>
          {/* Map display */}
          <View style={styles.mapContainer}>
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
              followsUserLocation={true}
              showsMyLocationButton={true}
              showsCompass={true}
              showsScale={true}
              toolbarEnabled={false}
            >
              {/* Vendor marker */}
              {currentVendor && (
                <Marker
                  coordinate={{
                    latitude: currentVendor.location.coordinates.latitude,
                    longitude: currentVendor.location.coordinates.longitude,
                  }}
                  title={currentVendor.name}
                  description={currentVendor.location.address}
                  pinColor="#4CAF50"
                />
              )}
              
              {/* Route line */}
              {routeCoordinates.length > 0 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeWidth={4}
                  strokeColor="#4CAF50"
                  lineDashPattern={[1]}
                />
              )}
            </MapView>
            
            {/* Recenter button */}
            <TouchableOpacity 
              style={styles.recenterButton}
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
              <Icon name="my-location" type="material" color="#4CAF50" size={24} />
            </TouchableOpacity>
          </View>
          
          {/* Direction card */}
          <Card containerStyle={styles.directionCard}>
            <Card.Title>{currentVendor?.name || 'Destination'}</Card.Title>
            <Card.Divider />
            
            <View style={styles.directionInfo}>
              <Text style={styles.directionArrow}>
                {getDirectionArrow(bearing)}
              </Text>
              <View style={styles.directionTextContainer}>
                <Text style={styles.distanceText}>
                  {distance ? `${distance.toFixed(2)} miles` : 'Calculating...'}
                </Text>
                <Text style={styles.bearingText}>
                  {bearing ? `Head ${getDirectionName(bearing)}` : ''}
                </Text>
              </View>
            </View>

            <Text style={styles.addressText}>{currentVendor?.location.address || ''}</Text>
            
            <Card.Divider style={styles.divider} />
            
            <View style={styles.buttonsContainer}>
              <Button
                title="Open in Maps"
                icon={{
                  name: "directions",
                  type: "material",
                  size: 20,
                  color: "white"
                }}
                onPress={openInMaps}
                containerStyle={styles.button}
                buttonStyle={styles.mapsButton}
              />
              
              <Button
                title="I've Arrived"
                icon={{
                  name: "check-circle",
                  type: "material",
                  size: 20,
                  color: "white"
                }}
                onPress={handleArrival}
                containerStyle={styles.button}
                buttonStyle={styles.arrivedButton}
                disabled={!distance || distance > 0.1}
              />
            </View>
            
            {distance && distance <= 0.1 && (
              <Text style={styles.arrivalText}>
                You have arrived! You can now check in.
              </Text>
            )}
          </Card>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  directionCard: {
    borderRadius: 10,
    marginBottom: 20,
    margin: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  directionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  directionArrow: {
    fontSize: 48,
    marginRight: 16,
    color: '#4CAF50',
  },
  directionTextContainer: {
    flex: 1,
  },
  distanceText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  bearingText: {
    fontSize: 16,
    color: '#666',
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  divider: {
    marginBottom: 16,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
  mapsButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 10,
  },
  arrivedButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
  },
  arrivalText: {
    textAlign: 'center',
    marginTop: 10,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
});

export default MapViewScreen;