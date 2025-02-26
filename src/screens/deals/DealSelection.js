// src/screens/deals/DealSelection.js
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, Slider } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';

const DealSelection = ({ navigation }) => {
  const { dispatch } = useAppState();
  const [dealType, setDealType] = useState(null);
  const [distance, setDistance] = useState(10);
  const [vendorCount, setVendorCount] = useState(3);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartJourney = async () => {
    setIsLoading(true);
    try {
      // Get current location (in real app, we'd use GPS)
      const currentLocation = {
        latitude: 61.217381,
        longitude: -149.863129
      };

      const vendors = await vendorService.searchVendors({
        dealType,
        maxDistance: distance,
        maxResults: vendorCount,
        currentLocation
      });

      dispatch(AppActions.startJourney({
        dealType,
        vendors: mockVendors,
        maxDistance: distance,
        totalVendors: vendorCount
      }));

      navigation.navigate('RoutePreview');
    } catch (error) {
      console.error('Failed to start journey:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.contentContainer}>
        <Text h3 style={styles.title}>Select Your Deal Hunt</Text>
        
        <View style={styles.dealTypeContainer}>
          <Text style={styles.sectionTitle}>Deal Type</Text>
          <View style={styles.cardContainer}>
            <Card>
              <Button
                type={dealType === 'birthday' ? 'solid' : 'outline'}
                title="Birthday Deals"
                onPress={() => setDealType('birthday')}
                icon={{
                  name: 'cake',
                  type: 'material',
                  color: dealType === 'birthday' ? 'white' : 'black',
                }}
                containerStyle={styles.dealButton}
              />
              <Text style={styles.dealDescription}>
                Special offers for birthday month celebrations
              </Text>
            </Card>

            <Card>
              <Button
                type={dealType === 'daily' ? 'solid' : 'outline'}
                title="Daily Specials"
                onPress={() => setDealType('daily')}
                icon={{
                  name: 'local-offer',
                  type: 'material',
                  color: dealType === 'daily' ? 'white' : 'black',
                }}
                containerStyle={styles.dealButton}
              />
              <Text style={styles.dealDescription}>
                Today's best deals from local vendors
              </Text>
            </Card>
          </View>
        </View>

        <View style={styles.preferencesContainer}>
          <Text style={styles.sectionTitle}>Journey Preferences</Text>
          
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>
              Maximum Distance: {distance} miles
            </Text>
            <Slider
              value={distance}
              onValueChange={setDistance}
              minimumValue={1}
              maximumValue={25}
              step={1}
              thumbStyle={styles.sliderThumb}
              trackStyle={styles.sliderTrack}
            />
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>
              Number of Stops: {vendorCount}
            </Text>
            <Slider
              value={vendorCount}
              onValueChange={setVendorCount}
              minimumValue={1}
              maximumValue={10}
              step={1}
              thumbStyle={styles.sliderThumb}
              trackStyle={styles.sliderTrack}
            />
          </View>
        </View>

        <Button
          title="Start Journey"
          onPress={handleStartJourney}
          disabled={!dealType || isLoading}
          loading={isLoading}
          containerStyle={styles.startButton}
          raised
        />

        <View style={styles.estimateContainer}>
          <Text style={styles.estimate}>
            Estimated journey time: {Math.round(vendorCount * 15)} minutes
          </Text>
          <Text style={styles.estimate}>
            Potential stops within range: 12
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
  },
  dealTypeContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  cardContainer: {
    gap: 15,
  },
  dealButton: {
    marginBottom: 10,
  },
  dealDescription: {
    textAlign: 'center',
    color: '#666',
  },
  preferencesContainer: {
    marginBottom: 30,
  },
  sliderContainer: {
    marginBottom: 20,
  },
  sliderLabel: {
    fontSize: 16,
    marginBottom: 10,
  },
  sliderThumb: {
    backgroundColor: '#2089dc',
  },
  sliderTrack: {
    height: 4,
  },
  startButton: {
    marginVertical: 20,
  },
  estimateContainer: {
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  estimate: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 5,
  },
});

export default DealSelection;