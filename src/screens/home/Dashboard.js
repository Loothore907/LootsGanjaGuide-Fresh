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
  Dimensions
} from 'react-native';
import { Text, Button, Card, Icon, Divider, Badge } from '@rneui/themed';
import { useAppState } from '../../context/AppStateContext';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Mock data service (will be replaced with proper implementation)
import { getRecentVendors, getFeaturedDeals } from '../../services/MockDataService';

const { width } = Dimensions.get('window');

const Dashboard = ({ navigation }) => {
  const { state } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const [featuredDeals, setFeaturedDeals] = useState([]);
  const [recentVendors, setRecentVendors] = useState([]);
  const [activeJourney, setActiveJourney] = useState(null);
  
  // Load data on component mount
  useEffect(() => {
    loadDashboardData();
    checkForActiveJourney();
  }, []);
  
  const loadDashboardData = async () => {
    setRefreshing(true);
    try {
      await tryCatch(async () => {
        // Get featured deals
        const deals = await getFeaturedDeals();
        setFeaturedDeals(deals);
        
        // Get recent vendors
        const vendors = await getRecentVendors();
        setRecentVendors(vendors);
        
        Logger.info(LogCategory.GENERAL, 'Dashboard data loaded successfully');
      }, LogCategory.GENERAL, 'loading dashboard data', false);
    } catch (error) {
      // Error already logged by tryCatch
    } finally {
      setRefreshing(false);
    }
  };
  
  const checkForActiveJourney = () => {
    if (state.journey && state.journey.isActive) {
      setActiveJourney({
        dealType: state.journey.dealType,
        progress: `${state.journey.currentVendorIndex + 1}/${state.journey.totalVendors}`,
        currentVendor: state.journey.vendors[state.journey.currentVendorIndex]
      });
    }
  };
  
  const onRefresh = () => {
    loadDashboardData();
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
  
  const renderFeaturedDeal = ({ item }) => (
    <TouchableOpacity 
      style={styles.featuredDealCard}
      onPress={() => navigateToVendorProfile(item.vendorId)}
    >
      <Image 
        source={{ uri: item.imageUrl }} 
        style={styles.dealImage}
        resizeMode="cover"
      />
      <View style={styles.dealOverlay}>
        <View style={styles.dealBadge}>
          <Text style={styles.dealBadgeText}>{item.discount}</Text>
        </View>
      </View>
      <View style={styles.dealCardContent}>
        <Text style={styles.dealTitle}>{item.title}</Text>
        <Text style={styles.dealVendor}>{item.vendorName}</Text>
        <Text style={styles.dealDescription}>{item.description}</Text>
      </View>
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
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Active Journey Card (if any) */}
        {activeJourney && (
          <Card containerStyle={styles.activeJourneyCard}>
            <View style={styles.journeyHeader}>
              <Text style={styles.journeyTitle}>Active Journey</Text>
              <Badge value={activeJourney.progress} status="success" />
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
        <View style={styles.sectionContainer}>
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
        </View>
        
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
});

export default Dashboard;