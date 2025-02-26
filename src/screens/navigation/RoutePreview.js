// src/screens/navigation/RoutePreview.js
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, Icon, Divider } from '@rneui/themed';
import { useAppState } from '../../context/AppStateContext';
import { vendorService } from '../../services/Vendor.Service';

const RoutePreview = ({ navigation }) => {
  const { state } = useAppState();
  const [isLoading, setIsLoading] = useState(false);

  // Get current vendor from journey state
  const currentVendor = state.journey.vendors[state.journey.currentVendorIndex];
  const isLastVendor = state.journey.currentVendorIndex === state.journey.vendors.length - 1;

  const handleStartNavigation = () => {
    navigation.navigate('MapView');
  };

  const handleSkipVendor = () => {
    // This will be handled by AppStateContext
    // dispatch(AppActions.skipVendor());
    navigation.replace('RoutePreview');
  };

  const handleShowDetails = () => {
    navigation.navigate('VendorDetails', { vendorId: currentVendor.id });
  };

  const handleEndJourney = () => {
    navigation.navigate('JourneyComplete');
  };

  const formatDistance = (distance) => {
    return `${distance.toFixed(1)} miles away`;
  };

  const getTodaysDeals = (vendor) => {
    const today = new Date().toLocaleLowerCase();
    return vendor.deals.daily[today] || [];
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text h4 style={styles.title}>
          {state.journey.currentVendorIndex === 0 ? 'Starting Your Journey' : 'Next Stop'}
        </Text>

        <Card containerStyle={styles.vendorCard}>
          <Card.Title>{currentVendor.name}</Card.Title>
          <Card.Divider />

          <View style={styles.locationInfo}>
            <Icon
              name="location-pin"
              type="material"
              color="#2089dc"
              size={24}
            />
            <Text style={styles.distance}>
              {formatDistance(currentVendor.distance)}
            </Text>
          </View>

          <Text style={styles.address}>
            {currentVendor.location.address}
          </Text>

          <Divider style={styles.divider} />

          <Text style={styles.dealsHeader}>Today's Deals:</Text>
          {getTodaysDeals(currentVendor).map((deal, index) => (
            <View key={index} style={styles.dealItem}>
              <Text style={styles.dealTitle}>{deal.description}</Text>
              <Text style={styles.discount}>{deal.discount}</Text>
              {deal.restrictions.map((restriction, idx) => (
                <Text key={idx} style={styles.restriction}>
                  • {restriction}
                </Text>
              ))}
            </View>
          ))}

          <Button
            title="Show All Deals"
            type="outline"
            onPress={handleShowDetails}
            containerStyle={styles.detailsButton}
          />
        </Card>

        <View style={styles.actionButtons}>
          <Button
            title={isLastVendor ? "End Journey" : "Skip This Stop"}
            type="outline"
            onPress={isLastVendor ? handleEndJourney : handleSkipVendor}
            containerStyle={styles.actionButton}
          />
          
          <Button
            title="Let's Go!"
            icon={{
              name: "navigation",
              type: "material",
              size: 20,
              color: "white"
            }}
            onPress={handleStartNavigation}
            containerStyle={styles.actionButton}
            loading={isLoading}
          />
        </View>

        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            Stop {state.journey.currentVendorIndex + 1} of {state.journey.totalVendors}
          </Text>
          <Text style={styles.estimateText}>
            Estimated time to destination: {Math.round(currentVendor.distance * 3)} mins
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
  content: {
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  vendorCard: {
    borderRadius: 10,
    marginBottom: 20,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  distance: {
    marginLeft: 10,
    fontSize: 16,
    color: '#2089dc',
  },
  address: {
    marginLeft: 34,
    color: '#666',
  },
  divider: {
    marginVertical: 15,
  },
  dealsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  dealItem: {
    marginBottom: 15,
  },
  dealTitle: {
    fontSize: 16,
    marginBottom: 5,
  },
  discount: {
    color: '#2089dc',
    fontSize: 15,
    marginBottom: 5,
  },
  restriction: {
    color: '#666',
    fontSize: 14,
    marginLeft: 10,
  },
  detailsButton: {
    marginTop: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  progressInfo: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 8,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 5,
  },
  estimateText: {
    textAlign: 'center',
    color: '#666',
  },
});

export default RoutePreview;