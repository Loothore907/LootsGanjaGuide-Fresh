// src/screens/home/Dashboard.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  FlatList,
  RefreshControl,
  Dimensions,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Text, Button, Card, Icon, Divider, Badge } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import routeService from '../../services/RouteService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import redemptionService from '../../services/RedemptionService';
import serviceProvider from '../../services/ServiceProvider';

const { width } = Dimensions.get('window');

const Dashboard = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const [recentVendors, setRecentVendors] = useState([]);
  const [activeJourney, setActiveJourney] = useState(null);
  const [metrics, setMetrics] = useState({
    today: { count: 0, uniqueVendors: 0 },
    total: { count: 0, uniqueVendors: 0 }
  });
  
  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [birthdayAvailable, setBirthdayAvailable] = useState(false);
  const [dailyAvailable, setDailyAvailable] = useState(false);
  const [specialAvailable, setSpecialAvailable] = useState(false);
  const [error, setError] = useState(null);
  
  // Load data on component mount
  useEffect(() => {
    loadData();
    checkForActiveJourney();
  }, []);
  
  // Load metrics in useEffect
  useEffect(() => {
    const loadMetrics = async () => {
      const stats = await redemptionService.getRedemptionStats();
      setMetrics(stats);
    };
    
    loadMetrics();
  }, []);
  
  // Check for active journey
  const checkForActiveJourney = async () => {
    try {
      // Check if there's an active journey in AsyncStorage
      const storedJourney = await AsyncStorage.getItem('current_journey');
      
      if (storedJourney) {
        const journey = JSON.parse(storedJourney);
        
        // Verify journey is valid and not completed
        if (journey && !journey.completedAt) {
          // Check if journey is expired (optional)
          const journeyDate = new Date(journey.createdAt);
          const now = new Date();
          const journeyAge = now - journeyDate;
          const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          
          if (journeyAge <= ONE_DAY) {
            // Journey is valid and not expired
            setActiveJourney({
              dealType: journey.dealType,
              progress: `${journey.currentVendorIndex + 1}/${journey.totalVendors}`,
              currentVendor: journey.vendors[journey.currentVendorIndex]
            });
            return;
          }
        }
      }
      
      // No valid journey found, ensure activeJourney is null
      setActiveJourney(null);
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error checking for active journey', { error });
      setActiveJourney(null);
    }
  };
  
  // Modified useEffect that loads journey data
  useEffect(() => {
    // Initial check for active journey is now handled by the function above
    // This useEffect can be used for other journey-related tasks if needed
  }, []);
  
  // Load all dashboard data
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await tryCatch(async () => {
        // Skip featured deals - remove this section
        // let featuredDeals = [];
        // try {
        //   featuredDeals = await serviceProvider.getFeaturedDeals({ limit: 20 });
        //   Logger.info(LogCategory.DEALS, 'Loaded featured deals', { count: featuredDeals.length });
        // } catch (dealsError) {
        //   Logger.error(LogCategory.DEALS, 'Error getting featured deals', { error: dealsError });
        //   // Continue with empty deals array rather than failing completely
        // }
        
        // Focus on getting vendors only with active status filtering
        let vendors = [];
        try {
          vendors = await serviceProvider.getAllVendors({ 
            limit: 10,
            activeRegionsOnly: true
          });
          Logger.info(LogCategory.VENDORS, 'Loaded vendors for dashboard', { count: vendors.length });
        } catch (vendorsError) {
          Logger.error(LogCategory.VENDORS, 'Error getting vendors', { error: vendorsError });
          // Continue with empty vendors array
        }
        
        // Get user's recent visits
        let recentVendors = [];
        try {
          recentVendors = await serviceProvider.getRecentVendors(10);
          Logger.info(LogCategory.VENDORS, 'Loaded recent vendors', { count: recentVendors.length });
        } catch (recentError) {
          Logger.error(LogCategory.VENDORS, 'Error getting recent vendors', { error: recentError });
          // Continue with empty recent vendors array
        }
        
        // Get favorites - safely
        let favorites = [];
        try {
          favorites = await serviceProvider.getFavorites();
        } catch (favoritesError) {
          Logger.error(LogCategory.VENDORS, 'Error getting favorites', { error: favoritesError });
          // Use favorites from state as fallback
          favorites = state.user.favorites.map(id => {
            const vendor = vendors.find(v => v.id === id);
            return vendor || { id };
          }).filter(v => v.name); // Filter out any that don't have a name
        }
        
        // Refresh metrics
        let stats = {
          today: { count: 0, uniqueVendors: 0 },
          total: { count: 0, uniqueVendors: 0 }
        };
        
        try {
          stats = await redemptionService.getRedemptionStats();
        } catch (statsError) {
          Logger.error(LogCategory.REDEMPTION, 'Error getting redemption stats', { error: statsError });
          // Continue with default stats
        }
        
        // Check for available deals
        let birthdayDeals = 0;
        let dailyDeals = 0;
        let specialDeals = 0;
        
        try {
          // Count birthday deals from vendors with birthday deals
          birthdayDeals = vendors.filter(vendor => 
            vendor.deals && 
            vendor.deals.birthday && 
            vendor.status === "Active-Operating"
          ).length;
          
          // Count daily deals from vendors with daily deals for today
          const today = getCurrentDayOfWeek();
          dailyDeals = vendors.filter(vendor => 
            vendor.deals && 
            vendor.deals.daily && 
            vendor.deals.daily[today] && 
            vendor.deals.daily[today].length > 0 &&
            vendor.status === "Active-Operating"
          ).length;
          
          // Count special deals from vendors with active special deals
          specialDeals = vendors.filter(vendor => 
            vendor.deals && 
            vendor.deals.special && 
            vendor.deals.special.length > 0 &&
            vendor.status === "Active-Operating"
          ).length;
          
          Logger.info(LogCategory.DEALS, 'Deal availability checked', {
            birthdayCount: birthdayDeals,
            dailyCount: dailyDeals,
            specialCount: specialDeals
          });
        } catch (countError) {
          Logger.error(LogCategory.DEALS, 'Error counting available deals', { error: countError });
        }
        
        // Update state with all loaded data - remove featuredDeals
        // setFeaturedDeals(featuredDeals); <- Remove this
        setVendors(vendors);
        setRecentVendors(recentVendors);
        setMetrics(stats);
        setBirthdayAvailable(birthdayDeals > 0);
        setDailyAvailable(dailyDeals > 0);
        setSpecialAvailable(specialDeals > 0);
        
        // Store vendor data in global state for reuse
        if (vendors.length > 0) {
          dispatch(AppActions.updateVendorData(vendors));
        }
        
        Logger.info(LogCategory.GENERAL, 'Dashboard data loaded successfully');
      }, LogCategory.GENERAL, 'loading dashboard data', true);
    } catch (error) {
      // Error already logged by tryCatch
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };
  
  // Helper function to get the current day of the week
  const getCurrentDayOfWeek = () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay();
    return days[today];
  };
  
  // Handle pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    checkForActiveJourney();
  };
  
  const navigateToDealType = (dealType) => {
    if (dealType === 'birthday') {
      // Birthday deals go to slider screen
      navigation.navigate('DealSelection', { initialDealType: 'birthday', showOnlyBirthday: true });
    } else if (dealType === 'daily') {
      // Daily deals go directly to daily deals list
      navigation.navigate('DailyDeals');
    } else if (dealType === 'special') {
      // Special deals go directly to special deals list
      navigation.navigate('SpecialDeals');
    }
  };
    
  const navigateToVendorProfile = (vendorId) => {
    navigation.navigate('VendorProfile', { vendorId });
  };
  
  const resumeJourney = () => {
    navigation.navigate('RoutePreview');
  };
  
  const renderDealTypeCard = ({ icon, title, description, type, color }) => (
    <TouchableOpacity 
      style={[styles.dealTypeCard, { borderColor: color }]}
      onPress={() => navigateToDealType(type)}
    >
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <Icon name={icon} type="material" color="#FFFFFF" size={32} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </TouchableOpacity>
  );
  
  const renderRecentVendor = ({ item }) => (
    <TouchableOpacity 
      style={styles.recentVendorCard}
      onPress={() => navigateToVendorProfile(item.id)}
    >
      <Image 
        source={{ uri: item.logoUrl }} 
        style={styles.vendorLogo}
        resizeMode="contain"
      />
      <Text style={styles.vendorName}>{item.name}</Text>
      <View style={styles.vendorRating}>
        <Icon name="star" type="material" size={16} color="#FFD700" />
        <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
      </View>
    </TouchableOpacity>
  );
  
  // Handle journey selection
  const handleSelectJourney = (dealType) => {
    // Check if there are vendors with this deal type
    let hasDeals = false;
    
    switch (dealType) {
      case 'birthday':
        hasDeals = birthdayAvailable;
        break;
      case 'daily':
        hasDeals = dailyAvailable;
        break;
      case 'special':
        hasDeals = specialAvailable;
        break;
    }
    
    if (!hasDeals) {
      Alert.alert(
        'No Deals Available',
        `Sorry, there are no ${dealType} deals available right now.`
      );
      return;
    }
    
    // Navigate to journey planner
    navigation.navigate('JourneyPlanner', { dealType });
  };
  
  // Handle single vendor visit (for daily and special deals)
  const handleSingleVendorVisit = async (dealType) => {
    // This would typically find the best vendor for the selected deal type
    // and navigate directly to the vendor profile or check-in
    Alert.alert(
      'Not Implemented',
      'Single vendor visits are not fully implemented in this demo.',
      [{ text: 'OK' }]
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.usernameText}>{state.user.username || 'Cannasseur'}</Text>
        </View>
        <View style={styles.pointsContainer}>
          <Icon name="loyalty" type="material" size={22} color="#4CAF50" />
          <Text style={styles.pointsText}>{state.user.points || 0} pts</Text>
        </View>
      </View>
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
          />
        }
      >
        {/* Error message if data loading failed */}
        {error && (
          <View style={styles.errorContainer}>
            <Icon name="error-outline" type="material" size={24} color="#F44336" />
            <Text style={styles.errorText}>{error}</Text>
            <Button
              title="Try Again"
              onPress={loadData}
              buttonStyle={styles.retryButton}
              titleStyle={styles.retryButtonText}
            />
          </View>
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Loading deals...</Text>
          </View>
        )}
        
        {/* Activity Metrics */}
        <View style={styles.metricsContainer}>
          <Text style={styles.metricsTitle}>Today's Activity</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{metrics.today.count}</Text>
              <Text style={styles.metricLabel}>Deals</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{metrics.today.uniqueVendors}</Text>
              <Text style={styles.metricLabel}>Vendors</Text>
            </View>
          </View>
        </View>
        
        {/* Active Journey Card (if any) */}
        {activeJourney && (
          <Card containerStyle={styles.activeJourneyCard}>
            <View style={styles.journeyHeader}>
              <Text style={styles.journeyTitle}>Active Journey</Text>
              <Badge value={activeJourney.progress} status="success" />
              <TouchableOpacity 
                style={styles.closeJourneyButton}
                onPress={() => {
                  // Show confirmation dialog
                  Alert.alert(
                    'Close Journey',
                    'Are you sure you want to dismiss this journey? You can still resume it later.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Dismiss', 
                        style: 'destructive',
                        onPress: () => {
                          // Just hide the banner, don't clear the journey state
                          setActiveJourney(null);
                        }
                      },
                      {
                        text: 'End Journey',
                        onPress: async () => {
                          try {
                            // Clean up journey data completely
                            await routeService.clearCurrentJourney();
                            dispatch(AppActions.endJourney());
                            setActiveJourney(null);
                          } catch (error) {
                            Logger.error(LogCategory.JOURNEY, 'Error ending journey from banner', { error });
                            setActiveJourney(null);
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <Icon name="close" type="material" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.journeyType}>
              {activeJourney.dealType === 'birthday' ? 'Birthday Deals' : 'Daily Specials'}
            </Text>
            <Text style={styles.journeyVendor}>
              Next Stop: {activeJourney.currentVendor.name}
            </Text>
            <Button
              title="Resume Journey"
              onPress={resumeJourney}
              buttonStyle={styles.resumeButton}
              icon={{
                name: "navigation",
                type: "material",
                size: 18,
                color: "white"
              }}
            />
          </Card>
        )}
        
        {/* Deal Types Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Find Your Deal</Text>
          <View style={styles.dealTypesContainer}>
            {renderDealTypeCard({
              icon: 'cake',
              title: 'Birthday Deals',
              description: 'Special offers for your birthday month',
              type: 'birthday',
              color: '#8E44AD'
            })}
            
            {renderDealTypeCard({
              icon: 'local-offer',
              title: 'Daily Deals',
              description: 'Best deals available today',
              type: 'daily',
              color: '#2ECC71'
            })}
            
            {renderDealTypeCard({
              icon: 'event',
              title: 'Special Offers',
              description: 'Limited time promotions',
              type: 'special',
              color: '#E74C3C'
            })}
          </View>
        </View>
        
        {/* Featured Deals Section */}
        {/* <View style={styles.sectionContainer}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Featured Deals</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AllDeals')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={featuredDeals}
            renderItem={renderFeaturedDeal}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredDealsContainer}
            ListEmptyComponent={
              <Text style={styles.emptyListText}>No featured deals available</Text>
            }
          />
        </View> */}
        
        {/* Recent Vendors Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Recently Visited</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AllVendors')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={recentVendors}
            renderItem={renderRecentVendor}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentVendorsContainer}
            ListEmptyComponent={
              <Text style={styles.emptyListText}>No recent visits yet</Text>
            }
          />
        </View>
        
        <Text style={styles.sectionTitle}>Start a Journey</Text>
        
        {isLoading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={styles.loadingIndicator} />
        ) : (
          <View style={styles.journeyTypesContainer}>
            {/* Birthday Deals Journey */}
            <TouchableOpacity 
              style={[
                styles.journeyCard, 
                !birthdayAvailable && styles.disabledJourneyCard
              ]}
              disabled={!birthdayAvailable}
              onPress={() => handleSelectJourney('birthday')}
            >
              <View style={styles.journeyCardContent}>
                <View style={styles.journeyIconContainer}>
                  <Icon name="cake" type="material" size={32} color="#4CAF50" />
                </View>
                <View style={styles.journeyTextContainer}>
                  <Text style={styles.journeyTitle}>Birthday Deals</Text>
                  <Text style={styles.journeyDescription}>Create a custom route to visit multiple dispensaries with birthday specials.</Text>
                </View>
                <Icon name="chevron-right" type="material" size={24} color="#666" />
              </View>
              
              {!birthdayAvailable && (
                <View style={styles.unavailableOverlay}>
                  <Text style={styles.unavailableText}>No redeemable deals available</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Daily Deals Journey */}
            <TouchableOpacity 
              style={[
                styles.journeyCard, 
                !dailyAvailable && styles.disabledJourneyCard
              ]}
              disabled={!dailyAvailable}
              onPress={() => handleSelectJourney('daily')}
            >
              <View style={styles.journeyCardContent}>
                <View style={styles.journeyIconContainer}>
                  <Icon name="today" type="material" size={32} color="#4CAF50" />
                </View>
                <View style={styles.journeyTextContainer}>
                  <Text style={styles.journeyTitle}>Daily Deals</Text>
                  <Text style={styles.journeyDescription}>Check out special deals available only today.</Text>
                </View>
                <Icon name="chevron-right" type="material" size={24} color="#666" />
              </View>
              
              {!dailyAvailable && (
                <View style={styles.unavailableOverlay}>
                  <Text style={styles.unavailableText}>No redeemable deals available</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Special Deals Journey */}
            <TouchableOpacity 
              style={[
                styles.journeyCard, 
                !specialAvailable && styles.disabledJourneyCard
              ]}
              disabled={!specialAvailable}
              onPress={() => handleSelectJourney('special')}
            >
              <View style={styles.journeyCardContent}>
                <View style={styles.journeyIconContainer}>
                  <Icon name="stars" type="material" size={32} color="#4CAF50" />
                </View>
                <View style={styles.journeyTextContainer}>
                  <Text style={styles.journeyTitle}>Special Promotions</Text>
                  <Text style={styles.journeyDescription}>Limited-time special deals and promotions from partner dispensaries.</Text>
                </View>
                <Icon name="chevron-right" type="material" size={24} color="#666" />
              </View>
              
              {!specialAvailable && (
                <View style={styles.unavailableOverlay}>
                  <Text style={styles.unavailableText}>No redeemable deals available</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
        
        <Text style={styles.sectionTitle}>Quick Links</Text>
        
        <View style={styles.quickLinksContainer}>
          <TouchableOpacity 
            style={styles.quickLinkButton}
            onPress={() => navigation.navigate('VendorList')}
          >
            <Icon name="storefront" type="material" size={24} color="#4CAF50" />
            <Text style={styles.quickLinkText}>All Dispensaries</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickLinkButton}
            onPress={() => navigation.navigate('RecentVisits')}
          >
            <Icon name="history" type="material" size={24} color="#4CAF50" />
            <Text style={styles.quickLinkText}>Recent Visits</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickLinkButton}
            onPress={() => navigation.navigate('UserProfile')}
          >
            <Icon name="account-circle" type="material" size={24} color="#4CAF50" />
            <Text style={styles.quickLinkText}>My Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickLinkButton}
            onPress={() => navigation.navigate('PointsShop')}
          >
            <Icon name="redeem" type="material" size={24} color="#4CAF50" />
            <Text style={styles.quickLinkText}>Points Shop</Text>
          </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  welcomeText: {
    fontSize: 14,
    color: '#666666',
  },
  usernameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pointsText: {
    marginLeft: 4,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  metricsContainer: {
    margin: 20,
    marginBottom: 10,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  metricsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333333',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  seeAllText: {
    color: '#2089dc',
    fontWeight: '600',
  },
  dealTypesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  dealTypeCard: {
    width: (width - 56) / 3,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  featuredDealsContainer: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  featuredDealCard: {
    width: width * 0.75,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  dealImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  dealOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 10,
  },
  dealBadge: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  dealBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  dealCardContent: {
    padding: 12,
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dealVendor: {
    fontSize: 14,
    color: '#2089dc',
    marginBottom: 6,
  },
  dealDescription: {
    fontSize: 14,
    color: '#666666',
  },
  recentVendorsContainer: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  recentVendorCard: {
    width: 100,
    marginRight: 10,
    alignItems: 'center',
  },
  vendorLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
  },
  vendorName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  vendorRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666666',
  },
  activeJourneyCard: {
    margin: 20,
    marginTop: 10,
    marginBottom: 24,
    borderRadius: 8,
    padding: 16,
    borderWidth: 0,
    backgroundColor: '#FFF8E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  journeyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  journeyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  journeyType: {
    fontSize: 14,
    marginBottom: 6,
  },
  journeyVendor: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  resumeButton: {
    backgroundColor: '#FF9800',
  },
  emptyListText: {
    padding: 20,
    color: '#999999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  closeJourneyButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  journeyTypesContainer: {
    marginBottom: 24,
  },
  journeyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden', // For the overlay to be properly contained
  },
  journeyCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  disabledJourneyCard: {
    opacity: 0.7,
  },
  journeyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  journeyTextContainer: {
    flex: 1,
  },
  journeyDescription: {
    fontSize: 14,
    color: '#666666',
  },
  unavailableOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
  },
  unavailableText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
  },
  quickLinksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickLinkButton: {
    width: '48%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  quickLinkText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#F44336',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
  },
  retryButtonText: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#2196F3',
    marginTop: 10,
  },
});

export default Dashboard;