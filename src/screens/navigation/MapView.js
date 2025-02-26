// src/screens/navigation/MapView.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Linking, Platform } from 'react-native';
import { Text, Button, Card, Icon, Divider } from '@rneui/themed';
import * as Location from 'expo-location';
import { useAppState } from '../../context/AppStateContext';

const MapViewScreen = ({ navigation }) => {
  const { state } = useAppState();
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [distance, setDistance] = useState(null);
  const [bearing, setBearing] = useState(null);

  const currentVendor = state.journey.vendors[state.journey.currentVendorIndex];

  useEffect(() => {
    let locationSubscription;

    const startLocationUpdates = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }

        // Start watching position
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10, // Update every 10 meters
          },
          (location) => {
            setUserLocation(location.coords);
            updateDistanceAndBearing(location.coords);
          }
        );
      } catch (error) {
        setErrorMsg('Error getting location');
        console.error('Location error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    startLocationUpdates();

    // Cleanup
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  const updateDistanceAndBearing = (userCoords) => {
    if (!userCoords || !currentVendor) return;

    const vendorCoords = currentVendor.location.coordinates;
    
    // Calculate distance
    const dist = calculateDistance(
      userCoords.latitude,
      userCoords.longitude,
      vendorCoords.latitude,
      vendorCoords.longitude
    );
    setDistance(dist);

    // Calculate bearing
    const bear = calculateBearing(
      userCoords.latitude,
      userCoords.longitude,
      vendorCoords.latitude,
      vendorCoords.longitude
    );
    setBearing(bear);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d * 0.621371; // Convert to miles
  };

  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const dLon = deg2rad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(deg2rad(lat2));
    const x = Math.cos(deg2rad(lat1)) * Math.sin(deg2rad(lat2)) -
              Math.sin(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.cos(dLon);
    let brng = Math.atan2(y, x);
    brng = rad2deg(brng);
    return (brng + 360) % 360; // Normalize to 0-360
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };

  const rad2deg = (rad) => {
    return rad * (180/Math.PI);
  };

  const getDirectionArrow = (bearing) => {
    // Convert bearing to 8 cardinal directions
    const normalized = Math.round(bearing / 45);
    const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    return arrows[normalized % 8];
  };

  const openInMaps = () => {
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

    Linking.openURL(url);
  };

  const handleArrival = () => {
    // Check if we're close enough (within 0.1 miles)
    if (distance && distance <= 0.1) {
      navigation.navigate('VendorCheckin');
    } else {
      alert('You need to be closer to the vendor to check in');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <Text>Getting your location...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.centeredContainer}>
        <Text>{errorMsg}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card containerStyle={styles.directionCard}>
        <Card.Title>{currentVendor.name}</Card.Title>
        <Divider style={styles.divider} />
        
        <View style={styles.directionInfo}>
          <Text style={styles.directionArrow}>
            {bearing ? getDirectionArrow(bearing) : ''}
          </Text>
          <Text style={styles.distance}>
            {distance ? `${distance.toFixed(2)} miles` : 'Calculating...'}
          </Text>
        </View>

        <Text style={styles.address}>{currentVendor.location.address}</Text>
      </Card>

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
          disabled={!distance || distance > 0.1}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionCard: {
    borderRadius: 10,
    marginBottom: 20,
  },
  divider: {
    marginBottom: 20,
  },
  directionInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  directionArrow: {
    fontSize: 48,
    marginBottom: 10,
  },
  distance: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2089dc',
  },
  address: {
    textAlign: 'center',
    color: '#666',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
});

export default MapViewScreen;