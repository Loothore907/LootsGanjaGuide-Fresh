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
import vendorCacheService from '../../services/VendorCacheService';
import { dealCacheService } from '../../services/DealCacheService';

const { width } = Dimensions.get('window');

const Dashboard = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const [recentVendors, setRecentVendors] = useState([]);
  const [partnerVendors, setPartnerVendors] = useState([]);
  const [currentPartnerIndex, setCurrentPartnerIndex] = useState(0);
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
  const [everydayAvailable, setEverydayAvailable] = useState(false);
  const [error, setError] = useState(null);
  
  // Deal count state variables
  const [birthdayDealCount, setBirthdayDealCount] = useState(0);
  const [dailyDealCount, setDailyDealCount] = useState(0);
  const [specialDealCount, setSpecialDealCount] = useState(0);
  const [everydayDealCount, setEverydayDealCount] = useState(0);
  const [featuredVendor, setFeaturedVendor] = useState(null);
  
  // Load data on component mount
  useEffect(() => {
    loadData();
    checkForActiveJourney();
    loadRecentVendors();
    
    // Check if deal cache is loaded
    console.log('Deal cache loaded:', dealCacheService.isCacheLoaded());
    console.log('Deal cache service:', dealCacheService);
  }, []);
  
  // Add debug logs for deal counts
  useEffect(() => {
    console.log('Birthday Deal Count:', birthdayDealCount);
    console.log('Daily Deal Count:', dailyDealCount);
    console.log('Special Deal Count:', specialDealCount);
    console.log('Everyday Deal Count:', everydayDealCount);
  }, [birthdayDealCount, dailyDealCount, specialDealCount, everydayDealCount]);
  
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
  
  // Load recent vendors
  const loadRecentVendors = async () => {
    try {
      // Get today's redemption stats from redemptionService
      const todayStats = await redemptionService.getRedemptionStats();
      
      // Get recent vendors with actual visit data
      const recentVisits = await serviceProvider.getRecentVendors(5);
      setRecentVendors(recentVisits);
      
      Logger.info(LogCategory.DASHBOARD, 'Loaded recent vendors', {
        visitCount: todayStats.today.uniqueVendors,
        redemptionCount: todayStats.today.count,
        recentVendors: recentVisits.length
      });
    } catch (error) {
      Logger.error(LogCategory.DASHBOARD, 'Error loading recent vendors', { error });
    }
  };
  
  // Modified loadData function to handle partner vendors
  const loadData = async () => {
    setIsLoading(true);
    
    try {
      await tryCatch(async () => {
        // Get vendors from cache
        const vendorsData = vendorCacheService.getAllVendors();
        
        // Get recent vendors
        const recentVendorsData = await serviceProvider.getRecentVendors(5);
        
        try {
          // Get redemption stats directly from redemptionService instead of serviceProvider
          const stats = await redemptionService.getRedemptionStats();
          setMetrics(stats);
          
          Logger.info(LogCategory.DASHBOARD, 'Loaded redemption metrics', {
            todayCount: stats.today.count,
            todayVendors: stats.today.uniqueVendors,
            totalCount: stats.total.count,
            totalVendors: stats.total.uniqueVendors
          });
        } catch (statsError) {
          Logger.error(LogCategory.DASHBOARD, 'Error fetching metrics', { error: statsError });
          // Use default metrics if error
          setMetrics({
            today: { count: 0, uniqueVendors: 0 },
            total: { count: 0, uniqueVendors: 0 }
          });
        }
        
        // Count available deals using dealCacheService instead of vendor objects
        let birthdayDeals = 0;
        let dailyDeals = 0;
        let specialDeals = 0;
        let everydayDeals = 0;
        let totalDeals = 0;
        
        try {
          // Check if deal cache is loaded
          if (dealCacheService.isCacheLoaded()) {
            console.log('Deal cache is loaded, getting deals by type');
            
            // Get deals by type - use 'type' property for filtering
            const birthdayDealsList = dealCacheService.getAllDeals({ type: 'birthday' });
            const today = getCurrentDayOfWeek();
            const dailyDealsList = dealCacheService.getAllDeals({ type: 'daily', day: today });
            const specialDealsList = dealCacheService.getAllDeals({ type: 'special' });
            const everydayDealsList = dealCacheService.getAllDeals({ type: 'everyday' });
            
            // Log the counts for debugging
            console.log('Deal counts from cache:', {
              birthday: birthdayDealsList.length,
              daily: dailyDealsList.length,
              special: specialDealsList.length,
              everyday: everydayDealsList.length
            });
            
            // Set the counts
            birthdayDeals = birthdayDealsList.length;
            dailyDeals = dailyDealsList.length;
            specialDeals = specialDealsList.length;
            everydayDeals = everydayDealsList.length;
            totalDeals = birthdayDeals + dailyDeals + specialDeals + everydayDeals;
            
            // Set deal counts for display in cards
            console.log('Setting birthday deal count:', birthdayDeals);
            console.log('Setting daily deal count:', dailyDeals);
            console.log('Setting special deal count:', specialDeals);
            console.log('Setting everyday deal count:', everydayDeals);
            
            setBirthdayDealCount(birthdayDeals);
            setDailyDealCount(dailyDeals); // Only daily deals for this card
            setSpecialDealCount(specialDeals);
            setEverydayDealCount(everydayDeals); // Separate count for everyday deals
            
            // Log the counts to verify they're being set correctly
            Logger.info(LogCategory.DASHBOARD, 'Setting deal counts for display', {
              birthdayDealCount: birthdayDeals,
              dailyDealCount: dailyDeals,
              specialDealCount: specialDeals,
              everydayDealCount: everydayDeals
            });
            
            // Do NOT update metrics with available deal counts - metrics should show redemptions
            // Keep the redemption metrics from redemptionService
            
            Logger.info(LogCategory.DEALS, 'Deal availability checked', {
              birthdayCount: birthdayDeals,
              dailyCount: dailyDeals,
              specialCount: specialDeals,
              everydayCount: everydayDealsList.length,
              totalDeals: totalDeals
            });
          } else {
            console.log('Deal cache not loaded, using default counts');
          }
        } catch (dealError) {
          Logger.error(LogCategory.DASHBOARD, 'Error counting deals', { error: dealError });
        }
        
        // Get all vendors and filter partners
        const partners = vendorsData.filter(vendor => vendor.isPartner);
        setPartnerVendors(partners);
        
        // Set featured vendor from partners list
        if (partners.length > 0) {
          // Use modulo to cycle through partners
          const index = currentPartnerIndex % partners.length;
          setFeaturedVendor(partners[index]);
          // Update index for next load
          setCurrentPartnerIndex(prev => (prev + 1) % partners.length);
        }
        
        // Update state with all loaded data
        setVendors(vendorsData);
        setRecentVendors(recentVendorsData);
        setBirthdayAvailable(birthdayDeals > 0);
        setDailyAvailable(dailyDeals > 0);
        setSpecialAvailable(specialDeals > 0);
        setEverydayAvailable(everydayDeals > 0);
        
        // Store vendor data in global state for reuse
        if (vendorsData.length > 0) {
          dispatch(AppActions.updateVendorData({
            vendors: vendorsData
          }));
        }
      }, LogCategory.GENERAL, 'loading dashboard data', true);
    } catch (error) {
      // Error already logged by tryCatch
      setError('Failed to load dashboard data. Pull down to refresh.');
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
    } else if (dealType === 'everyday') {
      // Navigate to the dedicated Everyday Deals screen
      navigation.navigate('EverydayDeals');
    }
  };
    
  const navigateToVendorProfile = (vendorId) => {
    navigation.navigate('VendorProfile', { vendorId });
  };
  
  const resumeJourney = () => {
    navigation.navigate('RoutePreview');
  };
  
  const renderDealTypeCard = ({ icon, title, description, type, color, count }) => {
    console.log(`Rendering ${type} card with count:`, count);
    
    return (
      <TouchableOpacity 
        style={[styles.dealTypeCard, { borderColor: color }]}
        onPress={() => navigateToDealType(type)}
      >
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          <Icon name={icon} type="material" color="#FFFFFF" size={32} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
        <View style={styles.dealCountBadge}>
          <Text style={styles.dealCountText}>{count} deals</Text>
        </View>
      </TouchableOpacity>
    );
  };
  
  const renderRecentVendor = ({ item }) => (
    <TouchableOpacity 
      style={styles.recentVendorCard}
      onPress={() => navigateToVendorProfile(item.id)}
    >
      <Image 
        source={{ uri: item.logoUrl || 'https://via.placeholder.com/150' }} 
        style={styles.vendorLogo}
        resizeMode="contain"
      />
      <Text style={styles.vendorName}>{item.name}</Text>
      {item.lastVisited && (
        <Text style={styles.lastVisitedText}>
          {formatLastVisited(item.lastVisited)}
        </Text>
      )}
    </TouchableOpacity>
  );
  
  // Placeholder for when there are no recent vendors
  const renderEmptyRecentVendors = () => (
    <View style={styles.emptyRecentVendors}>
      <Icon name="storefront" type="material" size={24} color="#BBBBBB" />
      <Text style={styles.emptyRecentVendorsText}>Visit vendors to see them here</Text>
    </View>
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
  
  // Helper function to format last visited time
  const formatLastVisited = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return diffHours === 0 ? 'Just now' : `${diffHours}h ago`;
    }
    return date.toLocaleDateString();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <View style={styles.vendorCountContainer}>
          <Icon name="store" type="material" size={18} color="#4CAF50" />
          <Text style={styles.vendorCountText}>{vendors.length} vendors</Text>
        </View>
        
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.usernameText}>{state.user.username || 'Cannasseur'}</Text>
        </View>
        
        <View style={styles.pointsContainer}>
          <Icon name="loyalty" type="material" size={22} color="#4CAF50" />
          <Text style={styles.pointsText}>{state.user.points || 0} pts</Text>
        </View>
      </View>
      
      {/* Activity Metrics Banner - showing redemption counts */}
      <View style={styles.activityBanner}>
        <View style={styles.activityBannerLeft}>
          <Icon name="history" type="material" size={18} color="#4CAF50" />
          <Text style={styles.activityBannerTitle}>Today's Activity</Text>
        </View>
        <View style={styles.activityBannerRight}>
          <View style={styles.activityMetric}>
            <Text style={styles.activityMetricValue}>{metrics.today.count}</Text>
            <Text style={styles.activityMetricLabel}>Redeemed</Text>
          </View>
          <View style={styles.activityDivider} />
          <View style={styles.activityMetric}>
            <Text style={styles.activityMetricValue}>{metrics.today.uniqueVendors}</Text>
            <Text style={styles.activityMetricLabel}>Visited</Text>
          </View>
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
            {console.log('Rendering Birthday Deal Card with count:', birthdayDealCount)}
            {renderDealTypeCard({
              icon: 'cake',
              title: 'Birthday Deals',
              description: 'Special offers for your birthday month',
              type: 'birthday',
              color: '#8E44AD',
              count: birthdayDealCount
            })}
            
            {console.log('Rendering Daily Deal Card with count:', dailyDealCount)}
            {renderDealTypeCard({
              icon: 'today',
              title: 'Daily Deals',
              description: 'Special offers for today only',
              type: 'daily',
              color: '#2ECC71',
              count: dailyDealCount
            })}
            
            {console.log('Rendering Special Deal Card with count:', specialDealCount)}
            {renderDealTypeCard({
              icon: 'event',
              title: 'Special Offers',
              description: 'Limited time promotions',
              type: 'special',
              color: '#E74C3C',
              count: specialDealCount
            })}
            
            {console.log('Rendering Everyday Deal Card with count:', everydayDealCount)}
            {renderDealTypeCard({
              icon: 'repeat',
              title: 'Everyday Deals',
              description: 'Available any day of the week',
              type: 'everyday',
              color: '#3498DB',
              count: everydayDealCount
            })}
          </View>
        </View>
        
        {/* Recently Visited Vendors */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recently Visited</Text>
            <TouchableOpacity onPress={() => navigation.navigate('VendorList')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {recentVendors.length > 0 ? (
            <FlatList
              data={recentVendors}
              renderItem={renderRecentVendor}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentVendorsContainer}
            />
          ) : (
            renderEmptyRecentVendors()
          )}
        </View>
        
        {/* Featured Vendor */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Featured Vendor</Text>
          
          {featuredVendor ? (
            <TouchableOpacity 
              style={styles.featuredVendorCard}
              onPress={() => navigateToVendorProfile(featuredVendor.id)}
            >
              <Image 
                source={{ uri: featuredVendor.logoUrl || 'https://via.placeholder.com/150' }} 
                style={styles.featuredVendorLogo}
                resizeMode="cover"
              />
              <View style={styles.featuredVendorOverlay}>
                <View style={styles.featuredVendorContent}>
                  <Text style={styles.featuredVendorName}>{featuredVendor.name}</Text>
                  <Text style={styles.featuredVendorAddress}>
                    {featuredVendor.location?.address || 'Address not available'}
                  </Text>
                  
                  {/* Deal count badge if vendor has deals */}
                  {dealCacheService.getDealsByVendorId(featuredVendor.id)?.length > 0 && (
                    <View style={styles.featuredVendorDealBadge}>
                      <Text style={styles.featuredVendorDealCount}>
                        {dealCacheService.getDealsByVendorId(featuredVendor.id).length} deals available
                      </Text>
                    </View>
                  )}
                  
                  <Button
                    title="View Details"
                    buttonStyle={styles.featuredVendorButton}
                    titleStyle={styles.featuredVendorButtonText}
                    icon={{
                      name: 'arrow-forward',
                      type: 'material',
                      size: 16,
                      color: 'white'
                    }}
                    iconRight
                  />
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <Text style={styles.emptyStateText}>No featured vendor available</Text>
          )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  welcomeContainer: {
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: '#757575',
  },
  usernameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  vendorCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  vendorCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 4,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 4,
  },
  activityBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  activityBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333333',
  },
  activityBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityMetric: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  activityMetricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  activityMetricLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  activityDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#DDDDDD',
    marginHorizontal: 8,
  },
  sectionContainer: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginLeft: 16,
    marginBottom: 8,
  },
  seeAllText: {
    color: '#2196F3',
    fontSize: 14,
  },
  dealTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  dealTypeCard: {
    width: (width - 48) / 2,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 11,
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
    paddingLeft: 16,
    paddingRight: 16,
  },
  recentVendorCard: {
    width: 80,
    marginRight: 12,
    alignItems: 'center',
  },
  vendorLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F5F5',
    marginBottom: 4,
  },
  vendorName: {
    fontSize: 12,
    textAlign: 'center',
    color: '#333333',
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
  dealCountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#E74C3C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dealCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  featuredVendorCard: {
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  featuredVendorLogo: {
    width: '100%',
    height: '100%',
  },
  featuredVendorOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
  },
  featuredVendorContent: {
    width: '100%',
  },
  featuredVendorName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  featuredVendorAddress: {
    color: '#EEEEEE',
    fontSize: 14,
    marginBottom: 8,
  },
  featuredVendorDealBadge: {
    backgroundColor: '#4CAF50',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  featuredVendorDealCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  featuredVendorButton: {
    backgroundColor: '#2196F3',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  featuredVendorButtonText: {
    fontSize: 14,
  },
  emptyStateText: {
    color: '#757575',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 20,
  },
  emptyRecentVendors: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginHorizontal: 16,
  },
  emptyRecentVendorsText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  lastVisitedText: {
    fontSize: 10,
    color: '#666666',
    marginTop: 2,
  },
});

export default Dashboard;