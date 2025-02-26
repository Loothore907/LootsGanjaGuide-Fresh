// src/screens/vendor/VendorCheckin.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';

const VendorCheckin = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  
  const handleNextVendor = () => {
    dispatch(AppActions.nextVendor());
    
    // If this was the last vendor, go to journey complete
    if (state.journey.currentVendorIndex + 1 >= state.journey.vendors.length - 1) {
      navigation.navigate('JourneyComplete');
    } else {
      navigation.navigate('RoutePreview');
    }
  };
  
  return (
    <View style={styles.container}>
      <Text h3 style={styles.title}>Vendor Check-in</Text>
      <Text style={styles.subtitle}>
        This screen will implement the QR code scanner for vendor check-ins.
      </Text>
      
      <Button
        title="Complete Check-in"
        onPress={handleNextVendor}
        containerStyle={styles.button}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    width: '80%',
    marginTop: 20,
  },
});

export default VendorCheckin;