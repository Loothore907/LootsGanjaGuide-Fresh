// src/screens/journey/JourneyComplete.js
import React, { useEffect, useState, useRef } from 'react';
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
  const pointsAwardedRef = useRef(false);
  
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
  
  // Check if we have explicitly set allCheckedIn flag in journey data
  const allVendorsCheckedIn = journeyData?.allCheckedIn || false;
  
  // Use vendors from journey data, ensuring the last vendor is marked as checked in if allCheckedIn is true
  const vendorsVisited = journeyData?.vendors ? 
    (allVendorsCheckedIn ? 
      // If allCheckedIn is true, ensure all vendors show as checked in
      journeyData.vendors.map(vendor => ({...vendor, checkedIn: true})) :
      // Otherwise use the data as is
      journeyData.vendors
    ) : 
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
  
  // Calculate points once when journeyData is available
  const pointsInfo = React.useMemo(() => calculatePoints(), [journeyData]);
  
  // Estimated money saved (dummy value for now)
  const estimatedSavings = vendorsVisited.filter(v => v.checkedIn).length * 15; // Assume $15 savings per successful checkin
  
  // Award points on component mount - only once
  useEffect(() => {
    // Only proceed if we have journey data and haven't awarded points yet
    if (journeyData && !pointsAwardedRef.current) {
      // Mark points as awarded to prevent infinite loop
      pointsAwardedRef.current = true;
      
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
    }
  }, [journeyData, dispatch]);
  
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
  
  // Determine if this is a single vendor journey
  const isSingleVendorJourney = totalVendors === 1 || vendorsVisited.length === 1;
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {journeyData ? (
          <>
            {/* Enlarged Header Section */}
            <View style={styles.headerSection}>
              {isSuccess ? (
                <>
                  <View style={styles.iconTextRow}>
                    <Icon name="celebration" type="material" size={80} color="#FFD700" />
                    <View style={styles.headerTextContainer}>
                      <Text style={styles.congrats}>Congratulations!</Text>
                      <Text style={styles.journeyComplete}>Journey Complete</Text>
                      <Text style={styles.journeyType}>{journeyType === 'birthday' ? 'Birthday Deals' : journeyType === 'special' ? 'Special Deals' : 'Daily Deals'}</Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.iconTextRow}>
                    <Icon name="sentiment-dissatisfied" type="material" size={80} color="#7E7E7E" />
                    <View style={styles.headerTextContainer}>
                      <Text style={styles.terminatedText}>Journey Terminated</Text>
                      <Text style={styles.terminatedSubText}>You've ended your journey early</Text>
                      <Text style={styles.journeyType}>{journeyType === 'birthday' ? 'Birthday Deals' : journeyType === 'special' ? 'Special Deals' : 'Daily Deals'}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
            
            {/* Compact Stats Card */}
            <Card containerStyle={styles.statsCard}>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <View style={styles.statRow}>
                    <Icon name="place" type="material" color="#4CAF50" size={28} />
                    <Text style={styles.statValue}>
                      {allVendorsCheckedIn ? 
                        `${vendorsVisited.length}/${vendorsVisited.length}` : 
                        `${vendorsVisited.filter(v => v.checkedIn).length}/${vendorsVisited.length}`}
                    </Text>
                  </View>
                  <Text style={styles.statLabel}>Vendors Visited</Text>
                </View>
                
                <View style={styles.statItem}>
                  <View style={styles.statRow}>
                    <Icon name="route" type="material" color="#2196F3" size={28} />
                    <Text style={styles.statValue}>{totalDistance.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.statLabel}>Miles Traveled</Text>
                </View>
                
                <View style={styles.statItem}>
                  <View style={styles.statRow}>
                    <Icon name="loyalty" type="material" color="#E91E63" size={28} />
                    <Text style={styles.statValue}>+{pointsInfo.totalPoints}</Text>
                  </View>
                  <Text style={styles.statLabel}>Points Earned</Text>
                </View>
                
                {estimatedSavings > 0 && (
                  <View style={styles.statItem}>
                    <View style={styles.statRow}>
                      <Icon name="savings" type="material" color="#4CAF50" size={28} />
                      <Text style={styles.statValue}>${estimatedSavings.toFixed(0)}</Text>
                    </View>
                    <Text style={styles.statLabel}>Est. Savings</Text>
                  </View>
                )}
              </View>
              
              {/* Show points breakdown in a more compact format */}
              {(pointsInfo.bonusPoints > 0 || noBonusReason) && (
                <>
                  <Divider style={styles.divider} />
                  <View style={styles.pointsBreakdown}>
                    {pointsInfo.bonusPoints > 0 ? (
                      <View style={styles.pointsBreakdownRow}>
                        <Text style={styles.pointsBreakdownItem}>
                          Check-ins: {pointsInfo.checkinPoints} pts • Bonus: {pointsInfo.bonusPoints} pts
                        </Text>
                      </View>
                    ) : noBonusReason ? (
                      <View style={styles.noBonusContainer}>
                        <Icon name="info" type="material" color="#FFA000" size={16} />
                        <Text style={styles.noBonusText}>{noBonusReason}</Text>
                      </View>
                    ) : null}
                  </View>
                </>
              )}
            </Card>
            
            {/* Only show vendor card for multi-vendor journeys */}
            {!isSingleVendorJourney && (
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
                      {(item.checkedIn || allVendorsCheckedIn) ? (
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
            )}
            
            {/* Improved Action Buttons with more space */}
            <View style={styles.actionsContainer}>
              {isSuccess ? (
                // Actions for successful completion
                <>
                  {/* Return Home button is now more prominent and above other actions */}
                  <Button
                    title="Return to Home"
                    icon={{
                      name: "home",
                      type: "material",
                      size: 22,
                      color: "white"
                    }}
                    buttonStyle={styles.homeButton}
                    containerStyle={styles.buttonContainer}
                    titleStyle={styles.buttonTitle}
                    onPress={() => navigation.reset({
                      index: 0,
                      routes: [{ name: 'MainTabs' }],
                    })}
                  />
                  
                  <View style={styles.secondaryActionsRow}>
                    {/* Only show birthday button for birthday journeys */}
                    {journeyType === 'birthday' && (
                      <Button
                        title="Get MOAR Birthday Deals!!!"
                        icon={{
                          name: "cake",
                          type: "material",
                          size: 22,
                          color: "white"
                        }}
                        buttonStyle={styles.birthdayButton}
                        containerStyle={[styles.secondaryButtonContainer, { flex: 3 }]}
                        titleStyle={styles.buttonTitle}
                        onPress={() => navigation.navigate('BirthdayDeals')}
                      />
                    )}
                    
                    <Button
                      title="Share"
                      icon={{
                        name: "share",
                        type: "material",
                        size: 22,
                        color: "white"
                      }}
                      buttonStyle={styles.shareButton}
                      containerStyle={[
                        styles.secondaryButtonContainer, 
                        { flex: journeyType === 'birthday' ? 2 : 1 }
                      ]}
                      titleStyle={styles.buttonTitle}
                      onPress={() => {
                        // In a real app, this would open a share dialog
                        alert('Sharing functionality will be implemented in a future update.');
                      }}
                    />
                  </View>
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
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  headerSection: {
    marginBottom: 30,
    paddingVertical: 20,
  },
  iconTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 20,
  },
  congrats: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 6,
  },
  journeyComplete: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  terminatedText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#7E7E7E',
    marginBottom: 6,
  },
  terminatedSubText: {
    fontSize: 18,
    color: '#666666',
    marginBottom: 6,
  },
  journeyType: {
    fontSize: 18,
    color: '#666666',
    marginTop: 4,
  },
  // Enlarged Stats Card Styles
  statsCard: {
    borderRadius: 10,
    marginBottom: 30,
    padding: 18,
    paddingBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statItem: {
    width: '48%',
    marginBottom: 18,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  statLabel: {
    fontSize: 15,
    color: '#666666',
    marginLeft: 38, // Align with icon + value
    marginTop: 4,
  },
  divider: {
    marginVertical: 12,
  },
  pointsBreakdown: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 4,
  },
  pointsBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  pointsBreakdownItem: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  noBonusContainer: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  noBonusText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#F57C00',
  },
  // Vendor Card Styles (only shown for multi-vendor journeys)
  vendorsCard: {
    borderRadius: 10,
    marginBottom: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#666666',
    fontStyle: 'italic',
  },
  // Improved Action Button Styles
  actionsContainer: {
    marginBottom: 20,
  },
  buttonContainer: {
    marginBottom: 16,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryButtonContainer: {
    marginHorizontal: 5,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  homeButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
  },
  shareButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 14,
  },
  birthdayButton: {
    backgroundColor: '#FF4081',
    borderRadius: 8,
    paddingVertical: 14,
  },
  confirmButton: {
    backgroundColor: '#F44336',
    borderRadius: 8,
    paddingVertical: 14,
  },
  cancelButton: {
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
  },
  confirmationText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
});

export default JourneyComplete;