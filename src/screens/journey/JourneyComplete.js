// src/screens/journey/JourneyComplete.js
import React, { useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  FlatList
} from 'react-native';
import { 
  Text, 
  Button, 
  Card, 
  Icon,
  Divider,
  ListItem
} from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import LottieView from 'lottie-react-native';

const JourneyComplete = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  
  // Calculate journey statistics
  const journeyType = state.journey.dealType || 'daily';
  const vendorsVisited = state.journey.vendors || [];
  const totalVendors = state.journey.totalVendors || 0;
  const totalDistance = state.route.totalDistance || 0;
  const totalPoints = vendorsVisited.length * 10; // 10 points per vendor
  
  // Award points on component mount
  useEffect(() => {
    // Update points in global state
    dispatch(AppActions.updatePoints(totalPoints));
    
    // Log journey completion
    Logger.info(LogCategory.JOURNEY, 'Journey completed', {
      journeyType,
      vendorsVisited: vendorsVisited.length,
      totalVendors,
      totalDistance,
      pointsEarned: totalPoints
    });
    
    // End journey in state
    return () => {
      dispatch(AppActions.endJourney());
    };
  }, []);
  
  const getJourneyTypeTitle = () => {
    switch (journeyType) {
      case 'birthday':
        return 'Birthday Deals';
      case 'special':
        return 'Special Offers';
      default:
        return 'Daily Deals';
    }
  };
  
  const renderVendorItem = ({ item, index }) => (
    <ListItem 
      bottomDivider={index < vendorsVisited.length - 1}
      onPress={() => navigation.navigate('VendorProfile', { vendorId: item.id })}
    >
      <ListItem.Content>
        <ListItem.Title>{item.name}</ListItem.Title>
        <ListItem.Subtitle>{item.location.address}</ListItem.Subtitle>
      </ListItem.Content>
      <Icon name="check-circle" type="material" color="#4CAF50" />
    </ListItem>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <View style={styles.confettiContainer}>
            {/* Lottie animation would go here in a real app */}
            <Icon name="celebration" type="material" size={80} color="#FFD700" />
          </View>
          <Text style={styles.congrats}>Congratulations!</Text>
          <Text style={styles.journeyComplete}>Journey Complete</Text>
          <Text style={styles.journeyType}>{getJourneyTypeTitle()}</Text>
        </View>
        
        <Card containerStyle={styles.statsCard}>
          <Card.Title>Journey Statistics</Card.Title>
          <Card.Divider />
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Icon name="place" type="material" color="#4CAF50" size={24} />
              <Text style={styles.statValue}>{vendorsVisited.length}</Text>
              <Text style={styles.statLabel}>Vendors Visited</Text>
            </View>
            
            <View style={styles.statItem}>
              <Icon name="route" type="material" color="#2196F3" size={24} />
              <Text style={styles.statValue}>{totalDistance.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Miles Traveled</Text>
            </View>
            
            <View style={styles.statItem}>
              <Icon name="loyalty" type="material" color="#E91E63" size={24} />
              <Text style={styles.statValue}>+{totalPoints}</Text>
              <Text style={styles.statLabel}>Points Earned</Text>
            </View>
          </View>
        </Card>
        
        <Card containerStyle={styles.vendorsCard}>
          <Card.Title>Vendors Visited</Card.Title>
          <Card.Divider />
          <FlatList
            data={vendorsVisited}
            renderItem={renderVendorItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No vendors visited</Text>
            }
          />
        </Card>
        
        <View style={styles.actionsContainer}>
          <Button
            title="Share Journey"
            icon={{
              name: "share",
              type: "material",
              size: 20,
              color: "white"
            }}
            buttonStyle={styles.shareButton}
            containerStyle={styles.buttonContainer}
            onPress={() => {
              // In a real app, this would open a share dialog
              alert('Sharing functionality will be implemented in a future update.');
            }}
          />
          
          <Button
            title="Start New Journey"
            icon={{
              name: "add-location",
              type: "material",
              size: 20,
              color: "white"
            }}
            buttonStyle={styles.newJourneyButton}
            containerStyle={styles.buttonContainer}
            onPress={() => navigation.navigate('DealSelection')}
          />
          
          <Button
            title="Return to Home"
            type="outline"
            icon={{
              name: "home",
              type: "material",
              size: 20,
              color: "#4CAF50"
            }}
            buttonStyle={styles.homeButton}
            containerStyle={styles.buttonContainer}
            titleStyle={{ color: '#4CAF50' }}
            onPress={() => navigation.navigate('MainTabs')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  confettiContainer: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  congrats: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  journeyComplete: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  journeyType: {
    fontSize: 18,
    color: '#666666',
  },
  statsCard: {
    borderRadius: 8,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
  },
  vendorsCard: {
    borderRadius: 8,
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#666666',
    fontStyle: 'italic',
  },
  actionsContainer: {
    marginBottom: 24,
  },
  buttonContainer: {
    marginBottom: 12,
  },
  shareButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
  },
  newJourneyButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  homeButton: {
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
});

export default JourneyComplete;