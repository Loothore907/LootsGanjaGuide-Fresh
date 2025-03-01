// src/screens/journey/JourneyComplete.js
import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  FlatList,
  Alert
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
import AsyncStorage from '@react-native-async-storage/async-storage';

const JourneyComplete = ({ navigation, route }) => {
  const { state, dispatch } = useAppState();
  const [journeyData, setJourneyData] = useState(null);
  const [noBonusReason, setNoBonusReason] = useState(null);
  
  // Get termination type from route params, default to "success" if not provided
  const { terminationType = "success" } = route.params || {};
  const isSuccess = terminationType === "success";
  
  // Get journey data from route params or state
  useEffect(() => {
    // Try to get journey data from route params
    const routeJourneyData = route.params?.journeyData;
    
    if (routeJourneyData) {
      // Use journey data from route params
      setJourneyData(routeJourneyData);
    } else {
      // Use current journey data from state
      const currentJourney = {
        journeyType: state.journey.dealType || 'daily',
        vendors: state.journey.vendors || [],
        currentVendorIndex: state.journey.currentVendorIndex || 0,
        totalVendors: state.journey.totalVendors || 0,
        totalDistance: state.route.totalDistance || 0
      };
      
      setJourneyData(currentJourney);
    }
  }, []);
  
  // Calculate journey statistics using journeyData
  const journeyType = journeyData?.journeyType || state.journey.dealType || 'daily';
  const vendorsVisited = journeyData?.vendors ? 
    journeyData.vendors.slice(0, journeyData.currentVendorIndex + 1) : 
    (state.journey.vendors ? state.journey.vendors.slice(0, state.journey.currentVendorIndex + 1) : []);
  const totalVendors = journeyData?.totalVendors || state.journey.totalVendors || 0;
  const totalDistance = journeyData?.totalDistance || state.route.totalDistance || 0;
  
  // Calculate bonus points based on QR code usage
  const calculatePoints = () => {
    if (!journeyData) {
      return { checkinPoints: 0, bonusPoints: 0, totalPoints: 0 };
    }
    
    // Get all vendors that were checked in
    const checkedInVendors = journeyData.vendors.filter(v => v.checkedIn);
    
    // Calculate base points from individual check-ins
    const checkinPoints = checkedInVendors.reduce((total, vendor) => {
      // 10 points for QR scan or non-QR vendor, 5 points for skipped QR
      return total + (vendor.checkInType === 'qr_skipped' ? 5 : 10);
    }, 0);
    
    // Calculate QR compliance rate - what percentage of QR-enabled vendors were scanned
    const qrEnabledVendors = journeyData.vendors.filter(v => v.hasQrCode);
    const qrScannedVendors = checkedInVendors.filter(v => v.checkInType === 'qr');
    
    let bonusPoints = 0;
    
    // Only calculate bonus if there were QR-enabled vendors
    if (qrEnabledVendors.length > 0) {
      const qrComplianceRate = qrScannedVendors.length / qrEnabledVendors.length;
      
      // Award journey bonus points only if more than half the QR codes were scanned
      if (qrComplianceRate >= 0.5) {
        // Calculate completion percentage (checked in / total)
        const completionRate = checkedInVendors.length / journeyData.totalVendors;
        
        // Award 25 points for each 25% milestone
        const milestones = Math.floor(completionRate * 4);
        bonusPoints = milestones * 25;
      } else if (qrEnabledVendors.length > 0) {
        // Show message explaining why no bonus points were awarded
        setNoBonusReason("More than half of QR codes were skipped. Journey bonus points are only awarded when most QR codes are scanned.");
      }
    } else {
      // If no QR vendors, award normal bonus based on completion
      const completionRate = checkedInVendors.length / journeyData.totalVendors;
      const milestones = Math.floor(completionRate * 4);
      bonusPoints = milestones * 25;
    }
    
    return {
      checkinPoints,
      bonusPoints,
      totalPoints: checkinPoints + bonusPoints
    };
  };
  
  const pointsInfo = calculatePoints();
  
  // Estimated money saved (dummy value for now)
  const estimatedSavings = vendorsVisited.filter(v => v.checkedIn).length * 15; // Assume $15 savings per successful checkin
  
  // Award points on component mount
  useEffect(() => {
    // Update points in global state
    dispatch(AppActions.updatePoints(pointsInfo.totalPoints));
    
    // Log journey completion or termination
    Logger.info(
      LogCategory.JOURNEY, 
      isSuccess ? 'Journey completed successfully' : 'Journey terminated early', 
      {
        journeyType,
        vendorsVisited: vendorsVisited.length,
        checkedInCount: vendorsVisited.filter(v => v.checkedIn).length,
        totalVendors,
        totalDistance,
        pointsEarned: pointsInfo.totalPoints
      }
    );
    
    // For successful journeys, immediately clear journey state
    if (isSuccess) {
      // Explicitly clear all journey-related data from storage
      AsyncStorage.multiRemove([
        'current_journey', 
        'current_route_data'
      ]);
      
      // Clear state
      dispatch(AppActions.endJourney());
    }
    
    // Otherwise, wait for user confirmation before clearing
  }, [journeyData]);
  
  // Handle confirmation for early termination
  const handleConfirmTermination = async () => {
    try {
      // Clear stored journey data
      await AsyncStorage.multiRemove([
        'current_journey', 
        'current_route_data'
      ]);
      
      // Clear journey state
      dispatch(AppActions.endJourney());
      
      // Navigate to home
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error clearing journey data', { error });
      // Still try to navigate even if clearing fails
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  };
  
  // Handle cancellation of early termination
  const handleCancelTermination = () => {
    // Return to previous screen without clearing journey
    navigation.goBack();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {journeyData ? (
          <>
            <View style={styles.headerSection}>
              {isSuccess ? (
                <>
                  <View style={styles.confettiContainer}>
                    <Icon name="celebration" type="material" size={80} color="#FFD700" />
                  </View>
                  <Text style={styles.congrats}>Congratulations!</Text>
                  <Text style={styles.journeyComplete}>Journey Complete</Text>
                </>
              ) : (
                <>
                  <View style={styles.confettiContainer}>
                    <Icon name="sentiment-dissatisfied" type="material" size={80} color="#7E7E7E" />
                  </View>
                  <Text style={styles.terminatedText}>Journey Terminated</Text>
                  <Text style={styles.terminatedSubText}>You've ended your journey early</Text>
                </>
              )}
              <Text style={styles.journeyType}>{journeyType === 'birthday' ? 'Birthday Deals' : 'Daily Deals'}</Text>
            </View>
            
            <Card containerStyle={styles.statsCard}>
              <Card.Title>Journey Statistics</Card.Title>
              <Card.Divider />
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Icon name="place" type="material" color="#4CAF50" size={24} />
                  <Text style={styles.statValue}>{vendorsVisited.filter(v => v.checkedIn).length}/{vendorsVisited.length}</Text>
                  <Text style={styles.statLabel}>Vendors Visited</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Icon name="route" type="material" color="#2196F3" size={24} />
                  <Text style={styles.statValue}>{totalDistance.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Miles Traveled</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Icon name="loyalty" type="material" color="#E91E63" size={24} />
                  <Text style={styles.statValue}>+{pointsInfo.totalPoints}</Text>
                  <Text style={styles.statLabel}>Points Earned</Text>
                </View>
              </View>
              
              {/* Only show savings if implemented or if using dummy value */}
              {estimatedSavings > 0 && (
                <>
                  <Card.Divider style={styles.divider} />
                  <View style={styles.savingsContainer}>
                    <Icon name="savings" type="material" color="#4CAF50" size={24} />
                    <Text style={styles.savingsAmount}>${estimatedSavings.toFixed(2)}</Text>
                    <Text style={styles.savingsLabel}>Estimated Savings</Text>
                  </View>
                </>
              )}
              
              {/* Show points breakdown for clarity */}
              <Card.Divider style={styles.divider} />
              <View style={styles.pointsBreakdown}>
                <Text style={styles.pointsBreakdownTitle}>Points Breakdown:</Text>
                <Text style={styles.pointsBreakdownItem}>
                  Check-ins: {pointsInfo.checkinPoints} pts
                </Text>
                {pointsInfo.bonusPoints > 0 && (
                  <Text style={styles.pointsBreakdownItem}>
                    Completion Bonus: {pointsInfo.bonusPoints} pts
                  </Text>
                )}
              </View>
              
              {noBonusReason && (
                <View style={styles.noBonusContainer}>
                  <Icon name="info" type="material" color="#FFA000" size={20} />
                  <Text style={styles.noBonusText}>{noBonusReason}</Text>
                </View>
              )}
            </Card>
            
            <Card containerStyle={styles.vendorsCard}>
              <Card.Title>Vendors Visited</Card.Title>
              <Card.Divider />
              <FlatList
                data={vendorsVisited}
                renderItem={({ item }) => (
                  <ListItem bottomDivider>
                    <ListItem.Content>
                      <ListItem.Title>{item.name}</ListItem.Title>
                      <ListItem.Subtitle>
                        {item.location?.address || 'Address unavailable'}
                      </ListItem.Subtitle>
                    </ListItem.Content>
                    {item.checkedIn ? (
                      <Icon name="check-circle" type="material" color="#4CAF50" />
                    ) : (
                      <Icon name="cancel" type="material" color="#E0E0E0" />
                    )}
                  </ListItem>
                )}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No vendors visited</Text>
                }
              />
            </Card>
            
            <View style={styles.actionsContainer}>
              {isSuccess ? (
                // Actions for successful completion
                <>
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
                </>
              ) : (
                // Actions for early termination
                <>
                  <Text style={styles.confirmationText}>
                    Are you sure you want to end this journey? Any incomplete checkins will be lost.
                  </Text>
                  
                  <Button
                    title="Yes, End Journey"
                    buttonStyle={styles.confirmButton}
                    containerStyle={styles.buttonContainer}
                    onPress={handleConfirmTermination}
                  />
                  
                  <Button
                    title="No, Resume Journey"
                    type="outline"
                    buttonStyle={styles.cancelButton}
                    containerStyle={styles.buttonContainer}
                    onPress={handleCancelTermination}
                  />
                </>
              )}
              
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
                onPress={() => navigation.reset({
                  index: 0,
                  routes: [{ name: 'MainTabs' }],
                })}
              />
            </View>
          </>
        ) : (
          // Show loading state when journeyData is not yet available
          <View style={styles.loadingContainer}>
            <Text>Loading journey data...</Text>
          </View>
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
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  terminatedText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#7E7E7E',
    marginBottom: 8,
  },
  terminatedSubText: {
    fontSize: 18,
    color: '#666666',
    marginBottom: 8,
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
  savingsContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  savingsAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
    marginBottom: 4,
  },
  savingsLabel: {
    fontSize: 14,
    color: '#666666',
  },
  pointsBreakdown: {
    padding: 12,
  },
  pointsBreakdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pointsBreakdownItem: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  noBonusContainer: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noBonusText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#F57C00',
    lineHeight: 20,
  },
  divider: {
    marginVertical: 15,
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
  confirmButton: {
    backgroundColor: '#F44336',
    borderRadius: 8,
    paddingVertical: 12,
  },
  cancelButton: {
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  homeButton: {
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  confirmationText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
});

export default JourneyComplete;