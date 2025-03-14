// src/screens/vendor/VendorProfile.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Linking,
  Image,
  Animated,
  Share,
  Platform,
  Alert
} from 'react-native';
import { 
  Text, 
  Button, 
  Card, 
  Icon, 
  Tab, 
  TabView, 
  Divider,
  ListItem,
  SocialIcon
} from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import serviceProvider from '../../services/ServiceProvider';
import { dealCacheService } from '../../services/DealCacheService';

const VendorProfile = ({ route, navigation }) => {
  const { vendorId } = route.params;
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(true);
  const [vendor, setVendor] = useState(null);
  const [vendorDeals, setVendorDeals] = useState({
    today: [],
    everyday: [],
    birthday: []
  });
  const [tabIndex, setTabIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isCreatingJourney, setIsCreatingJourney] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Hide the default React Navigation header
  useEffect(() => {
    navigation.setOptions({
      headerShown: false
    });
  }, [navigation]);
  
  // Check if we're viewing this vendor profile during an active journey
  const isInActiveJourney = state.journey && state.journey.isActive;
  
  // Check if vendor is in favorites
  useEffect(() => {
    if (state.user.favorites.includes(vendorId)) {
      setIsFavorite(true);
    }
  }, [state.user.favorites, vendorId]);
  
  // Load vendor data
  useEffect(() => {
    loadVendorData();
  }, [vendorId]);

  // New effect to load deals from cache if not available directly on vendor
  useEffect(() => {
    if (vendor && vendor.id) {
      loadDealsForVendor();
    }
  }, [vendor]);
  
  const loadDealsForVendor = async () => {
    // First check if deals are available directly on the vendor object
    const directDeals = {
      today: getCurrentDayDeals() || [],
      everyday: vendor.deals?.everyday ? 
        (Array.isArray(vendor.deals.everyday) ? vendor.deals.everyday : [vendor.deals.everyday]) : [],
      birthday: vendor.deals?.birthday ? 
        (Array.isArray(vendor.deals.birthday) ? vendor.deals.birthday : [vendor.deals.birthday]) : []
    };
    
    // If we already have deals, use them
    if (directDeals.today.length || directDeals.everyday.length || directDeals.birthday.length) {
      console.log('Using direct deals from vendor object:', {
        today: directDeals.today.length,
        everyday: directDeals.everyday.length,
        birthday: directDeals.birthday.length
      });
      setVendorDeals(directDeals);
      return;
    }
    
    // Otherwise try to get deals from the cache service
    try {
      if (dealCacheService) {
        const today = getDayOfWeek();
        const cachedDeals = {
          today: dealCacheService.getDailyDealsForVendor(vendor, today) || [],
          everyday: dealCacheService.getEverydayDealsForVendor(vendor) || [],
          birthday: dealCacheService.getBirthdayDealsForVendor(vendor) || []
        };
        
        console.log('Deals from cache service:', {
          today: cachedDeals.today.length,
          everyday: cachedDeals.everyday.length,
          birthday: cachedDeals.birthday.length
        });
        
        setVendorDeals(cachedDeals);
      }
    } catch (error) {
      console.log('Error loading deals from cache:', error);
    }
  };
  
  const loadVendorData = async () => {
    setIsLoading(true);
    
    try {
      await tryCatch(async () => {
        // Use serviceProvider instead of direct calls
        const vendorData = await serviceProvider.getVendorById(vendorId);
        
        if (!vendorData) {
          throw new Error(`Vendor with ID ${vendorId} not found`);
        }
        
        // Add debug logging to identify other potential null values
        console.log('VendorProfile - loaded vendor data:', {
          id: vendorData.id,
          name: vendorData.name,
          hasRating: vendorData.rating !== undefined && vendorData.rating !== null,
          rating: vendorData.rating,
          hasDistance: vendorData.distance !== undefined && vendorData.distance !== null,
          distance: vendorData.distance,
          hasLocation: !!vendorData.location,
          locationKeys: vendorData.location ? Object.keys(vendorData.location) : [],
          hasCoordinates: vendorData.location && vendorData.location.coordinates,
          coordinateTypes: vendorData.location && vendorData.location.coordinates ? 
            `lat: ${typeof vendorData.location.coordinates.latitude}, lng: ${typeof vendorData.location.coordinates.longitude}` : 'N/A',
          hasDeals: !!vendorData.deals,
          dealTypes: vendorData.deals ? Object.keys(vendorData.deals) : []
        });
        
        setVendor(vendorData);
        
        // Add to recent visits - only if we have a valid vendor
        const visit = {
          vendorId: vendorData.id,
          vendorName: vendorData.name,
          lastVisit: new Date().toISOString(),
          visitCount: 1
        };
        dispatch(AppActions.addRecentVisit(visit));
        
        Logger.info(LogCategory.VENDORS, 'Loaded vendor profile', {
          vendorId,
          vendorName: vendorData.name
        });
      }, LogCategory.VENDORS, 'loading vendor profile', true);
    } catch (error) {
      // Error already logged by tryCatch
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleFavorite = () => {
    if (isFavorite) {
      dispatch(AppActions.removeFavorite(vendorId));
      setIsFavorite(false);
      Logger.info(LogCategory.VENDORS, 'Removed vendor from favorites', { vendorId });
    } else {
      dispatch(AppActions.addFavorite(vendorId));
      setIsFavorite(true);
      Logger.info(LogCategory.VENDORS, 'Added vendor to favorites', { vendorId });
    }
  };
  
  const openMaps = () => {
    if (!vendor || !vendor.location || !vendor.location.coordinates) {
      Logger.warn(LogCategory.NAVIGATION, 'Cannot open maps - missing vendor coordinates', { vendorId });
      alert('Location coordinates not available for this vendor.');
      return;
    }
    
    const { latitude, longitude } = vendor.location.coordinates;
    
    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      Logger.warn(LogCategory.NAVIGATION, 'Invalid coordinates for vendor', { 
        vendorId, 
        coordinates: vendor.location.coordinates 
      });
      alert('Invalid location coordinates for this vendor.');
      return;
    }
    
    const label = encodeURIComponent(vendor.name || 'Vendor');
    const scheme = Platform.select({
      ios: 'maps:0,0?q=',
      android: 'geo:0,0?q='
    });
    const latLng = `${latitude},${longitude}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    
    Linking.openURL(url).catch(err => {
      Logger.error(LogCategory.NAVIGATION, 'Error opening maps', { error: err });
      alert('Could not open maps. Please try again.');
    });
  };
  
  const callVendor = () => {
    if (!vendor || !vendor.contact || !vendor.contact.phone) {
      Logger.warn(LogCategory.GENERAL, 'Cannot call vendor - missing phone number', { vendorId });
      alert('Phone number not available for this vendor.');
      return;
    }
    
    const phoneNumber = vendor.contact.phone.replace(/[^\d]/g, '');
    if (!phoneNumber) {
      Logger.warn(LogCategory.GENERAL, 'Invalid phone number for vendor', { vendorId });
      alert('Invalid phone number for this vendor.');
      return;
    }
    
    const url = `tel:${phoneNumber}`;
    
    Linking.openURL(url).catch(err => {
      Logger.error(LogCategory.GENERAL, 'Error making phone call', { error: err });
      alert('Could not initiate call. Please try again.');
    });
  };
  
  const emailVendor = () => {
    if (!vendor || !vendor.contact || !vendor.contact.email) {
      Logger.warn(LogCategory.GENERAL, 'Cannot email vendor - missing email address', { vendorId });
      alert('Email address not available for this vendor.');
      return;
    }
    
    const url = `mailto:${vendor.contact.email}`;
    
    Linking.openURL(url).catch(err => {
      Logger.error(LogCategory.GENERAL, 'Error sending email', { error: err });
      alert('Could not open email client. Please try again.');
    });
  };
  
  const openInstagram = () => {
    if (!vendor || !vendor.contact || !vendor.contact.social || !vendor.contact.social.instagram) {
      Logger.warn(LogCategory.GENERAL, 'Cannot open Instagram - missing handle', { vendorId });
      alert('Instagram handle not available for this vendor.');
      return;
    }
    
    const url = `https://instagram.com/${vendor.contact.social.instagram}`;
    
    Linking.openURL(url).catch(err => {
      Logger.error(LogCategory.GENERAL, 'Error opening Instagram', { error: err });
      alert('Could not open Instagram. Please try again.');
    });
  };
  
  const openFacebook = () => {
    if (!vendor || !vendor.contact || !vendor.contact.social || !vendor.contact.social.facebook) {
      Logger.warn(LogCategory.GENERAL, 'Cannot open Facebook - missing page ID', { vendorId });
      alert('Facebook page not available for this vendor.');
      return;
    }
    
    const url = `https://facebook.com/${vendor.contact.social.facebook}`;
    
    Linking.openURL(url).catch(err => {
      Logger.error(LogCategory.GENERAL, 'Error opening Facebook', { error: err });
      alert('Could not open Facebook. Please try again.');
    });
  };
  
  const shareVendor = async () => {
    if (!vendor) {
      Logger.warn(LogCategory.GENERAL, 'Cannot share vendor - missing vendor data', { vendorId });
      alert('Vendor information not available to share.');
      return;
    }
    
    try {
      const result = await Share.share({
        message: `Check out ${vendor.name} on Loot's Ganja Guide! ${vendor.location?.address || ''}`,
        title: `${vendor.name} on Loot's Ganja Guide`
      });
      
      if (result.action === Share.sharedAction) {
        Logger.info(LogCategory.GENERAL, 'Vendor shared successfully', { vendorId });
      }
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error sharing vendor', { error });
      alert('Could not share vendor information. Please try again.');
    }
  };
  
  const getCurrentDayDeals = () => {
    if (!vendor || !vendor.deals || !vendor.deals.daily) {
      return [];
    }
    
    const today = getDayOfWeek();
    return vendor.deals.daily[today] || [];
  };
  
  // Helper function to get current day of week
  function getDayOfWeek() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay();
    return days[today];
  }
  
  // Format opening hours
  const formatHours = (day) => {
    if (!vendor || !vendor.hours || !vendor.hours[day]) return 'Closed';
    
    const { open, close } = vendor.hours[day];
    if (!open || !close) return 'Hours not available';
    
    return `${open} - ${close}`;
  };
  
  // Get today's hours
  const getTodayHours = () => {
    const today = getDayOfWeek();
    return formatHours(today);
  };
  
  // Check if currently open
  const isCurrentlyOpen = () => {
    if (!vendor || !vendor.hours) return false;
    
    const today = getDayOfWeek();
    const hours = vendor.hours[today];
    
    if (!hours || !hours.open || !hours.close) return false;
    
    try {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      return currentTime >= hours.open && currentTime <= hours.close;
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error checking if vendor is open', { error, vendorId });
      return false;
    }
  };
  
  // Animation for header
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [120, 60],
    extrapolate: 'clamp'
  });
  
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60, 100],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp'
  });
  
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [60, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });
  
  // Helper function to find a vendor by ID from various sources
  const findVendorById = (id) => {
    if (!id) return null;
    
    // If vendor is already loaded in state, return it
    if (vendor && vendor.id === id) {
      return vendor;
    }
    
    // Otherwise, use the cached vendors from state if available
    if (state.vendorData && state.vendorData.list && Array.isArray(state.vendorData.list)) {
      const cachedVendor = state.vendorData.list.find(v => v.id === id);
      if (cachedVendor) return cachedVendor;
    }
    
    // For journey vendors
    if (state.journey && state.journey.vendors && Array.isArray(state.journey.vendors)) {
      const journeyVendor = state.journey.vendors.find(v => v.id === id);
      if (journeyVendor) return journeyVendor;
    }
    
    // If we reach here, we'll have to load the vendor via API
    // This should be done asynchronously in loadVendorData
    return null;
  };
  
  // New function to handle starting a journey with a specific deal
  const handleStartJourneyWithDeal = async (deal, dealType) => {
    setIsCreatingJourney(true);
    
    try {
      // If there's an active journey, confirm that the user wants to replace it
      if (isInActiveJourney) {
        Alert.alert(
          'Replace Active Journey?',
          'You have an active journey in progress. Starting a new journey will replace it. Continue?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setIsCreatingJourney(false) },
            { text: 'Continue', onPress: () => createNewJourney(deal, dealType) }
          ]
        );
      } else {
        // No active journey, create a new one directly
        await createNewJourney(deal, dealType);
      }
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error starting journey from vendor profile', { error, vendorId });
      Alert.alert('Error', 'Failed to create journey. Please try again.');
      setIsCreatingJourney(false);
    }
  };
  
  // Helper function to create a new journey
  const createNewJourney = async (deal, dealType) => {
    try {
      // End any existing journey
      if (isInActiveJourney) {
        dispatch(AppActions.endJourney());
      }
      
      // Create an optimized route with just this vendor
      const route = await serviceProvider.createOptimizedRoute([vendor.id], {
        startLocation: state.user.location || {
          latitude: 61.217381, // Default to Anchorage if no user location
          longitude: -149.863129
        },
        dealType: dealType
      });
      
      if (!route || !route.vendors || route.vendors.length === 0) {
        throw new Error('Failed to create route with vendor');
      }
      
      // Start journey in app state
      dispatch(AppActions.startJourney({
        dealType: dealType,
        vendors: route.vendors,
        maxDistance: state.dealFilters.maxDistance || 25,
        totalVendors: route.vendors.length
      }));
      
      // Update route information
      dispatch(AppActions.updateRoute({
        coordinates: route.vendors.map(v => v.location.coordinates),
        totalDistance: route.totalDistance,
        estimatedTime: route.estimatedTime
      }));
      
      // Navigate to the route preview screen
      navigation.reset({
        index: 0,
        routes: [
          { name: 'MainTabs' },
          { name: 'RoutePreview' }
        ],
      });
      
      Logger.info(LogCategory.JOURNEY, 'Started journey from vendor profile', { 
        vendorId, 
        dealType,
        vendorCount: route.vendors.length 
      });
    } catch (error) {
      Logger.error(LogCategory.JOURNEY, 'Error creating journey', { error, vendorId });
      Alert.alert('Error', 'Failed to create journey. Please try again.');
    } finally {
      setIsCreatingJourney(false);
    }
  };
  
  // Updated render functions for deal cards with journey buttons
  
  // Render a deal card with journey button
  const renderDealCard = (deal, index, dealType, keyPrefix) => {
    const dealTitle = typeof deal === 'string' ? deal : (deal.title || 'Deal Available');
    const dealDescription = typeof deal !== 'string' && deal.description ? deal.description : null;
    const dealDiscount = typeof deal !== 'string' && deal.discount ? deal.discount : null;
    
    return (
      <View key={`${keyPrefix}-${index}`} style={styles.dealCard}>
        {dealType === 'birthday' && (
          <View style={styles.dealHeader}>
            <View style={styles.birthdayBadge}>
              <Icon name="cake" type="material" color="#fff" size={14} />
              <Text style={styles.birthdayBadgeText}>Birthday</Text>
            </View>
          </View>
        )}
        
        <Text style={styles.dealTitle}>{dealTitle}</Text>
        
        {dealDescription && (
          <Text style={styles.dealDescription}>{dealDescription}</Text>
        )}
        
        <View style={styles.dealFooter}>
          {dealDiscount && (
            <View style={[styles.discountBadge, dealType === 'birthday' ? {backgroundColor: '#FF4081'} : {}]}>
              <Text style={styles.discountText}>
                {typeof dealDiscount === 'number' ? `${dealDiscount}%` : dealDiscount}
              </Text>
            </View>
          )}
          
          <Button
            title={isInActiveJourney ? "Switch to This Deal" : "Start Journey"}
            icon={{ name: 'navigation', type: 'material', color: 'white', size: 14 }}
            buttonStyle={[styles.journeyButton, dealType === 'birthday' ? {backgroundColor: '#FF4081'} : {}]}
            titleStyle={styles.journeyButtonText}
            onPress={() => handleStartJourneyWithDeal(deal, dealType)}
            loading={isCreatingJourney}
            disabled={isCreatingJourney}
          />
        </View>
      </View>
    );
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading vendor profile...</Text>
      </View>
    );
  }
  
  if (!vendor) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" type="material" size={64} color="#F44336" />
        <Text style={styles.errorText}>Failed to load vendor information.</Text>
        <Button
          title="Go Back"
          onPress={() => navigation.goBack()}
          buttonStyle={styles.errorButton}
        />
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.fixedHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" type="material" color="#FFFFFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendor Details</Text>
        <TouchableOpacity style={styles.favoriteButton} onPress={toggleFavorite}>
          <Icon
            name={isFavorite ? "favorite" : "favorite-border"}
            type="material"
            color={isFavorite ? "#F44336" : "#FFFFFF"}
            size={24}
          />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.vendorInfo}>
          <Text style={styles.vendorName}>{vendor.name}</Text>
          <View style={styles.ratingContainer}>
            <Icon name="star" type="material" color="#FFD700" size={20} />
            <Text style={styles.ratingText}>
              {vendor.rating ? vendor.rating.toFixed(1) : 'No Rating'}
            </Text>
            {vendor.isPartner && (
              <View style={styles.partnerBadge}>
                <Text style={styles.partnerText}>PARTNER</Text>
              </View>
            )}
          </View>
          
          {/* Location Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.locationContainer}>
              <Icon name="place" type="material" color="#4CAF50" size={20} />
              <Text style={styles.locationText}>
                {vendor.location?.address || 'Address not available'}
              </Text>
            </View>
            
            {vendor.distance !== undefined && vendor.distance !== null && (
              <Text style={styles.distanceText}>
                {vendor.distance.toFixed(1)} miles away
              </Text>
            )}
            
            <Button
              title={isInActiveJourney ? "Continue Journey" : "Directions"}
              icon={{ name: 'directions', type: 'material', color: 'white', size: 18 }}
              buttonStyle={styles.actionButton}
              onPress={isInActiveJourney ? () => navigation.navigate('RouteMapView') : openMaps}
              containerStyle={styles.buttonContainer}
            />
          </View>
          
          {/* Today's Deals - Improved formatting */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Deals</Text>
            
            {vendorDeals.today.length > 0 ? (
              vendorDeals.today.map((deal, index) => 
                renderDealCard(deal, index, 'daily', 'today')
              )
            ) : (
              <Text style={styles.noDealsText}>No deals available today</Text>
            )}
          </View>
          
          {/* Debug button - hidden in production */}
          {!vendorDeals.today.length && vendor.id && __DEV__ && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Deals from Cache</Text>
              {console.log('Checking for deals in cache for vendor ID:', vendor.id)}
              <Button
                title="Find All Deals"
                icon={{ name: 'search', type: 'material', color: 'white', size: 18 }}
                buttonStyle={styles.actionButton}
                onPress={() => {
                  try {
                    // This is just a debug button to check what deals are available
                    if (typeof dealCacheService !== 'undefined') {
                      console.log('Deal cache loaded:', dealCacheService.isCacheLoaded());
                      const todayDeals = dealCacheService.getDailyDealsForVendor(vendor, getDayOfWeek());
                      const everydayDeals = dealCacheService.getEverydayDealsForVendor(vendor);
                      const birthdayDeals = dealCacheService.getBirthdayDealsForVendor(vendor);
                      console.log('Cache deals found:', {
                        today: todayDeals.length,
                        everyday: everydayDeals.length,
                        birthday: birthdayDeals.length
                      });
                    } else {
                      console.log('Deal cache service not available');
                    }
                  } catch (error) {
                    console.log('Error checking deals:', error);
                  }
                }}
                containerStyle={styles.buttonContainer}
              />
            </View>
          )}
          
          {/* Hours Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hours</Text>
            <View style={styles.hoursContainer}>
              <View style={styles.statusBadge}>
                <Text style={[styles.statusText, { color: isCurrentlyOpen() ? '#4CAF50' : '#F44336' }]}>
                  {isCurrentlyOpen() ? 'Open Now' : 'Closed Now'}
                </Text>
              </View>
              <Text style={styles.todayHours}>Today: {getTodayHours()}</Text>
            </View>
            
            {/* Display full week hours */}
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
              <View key={day} style={styles.hourRow}>
                <Text style={styles.dayName}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                <Text style={styles.hourTime}>{formatHours(day)}</Text>
              </View>
            ))}
          </View>
          
          {/* Contact Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <View style={styles.contactActions}>
              {vendor.contact?.phone && (
                <Button
                  title="Call"
                  icon={{ name: 'phone', type: 'material', color: 'white', size: 18 }}
                  buttonStyle={styles.actionButton}
                  onPress={callVendor}
                  containerStyle={styles.buttonContainer}
                />
              )}
              
              {vendor.contact?.email && (
                <Button
                  title="Email"
                  icon={{ name: 'email', type: 'material', color: 'white', size: 18 }}
                  buttonStyle={styles.actionButton}
                  onPress={emailVendor}
                  containerStyle={styles.buttonContainer}
                />
              )}
              
              <Button
                title="Share"
                icon={{ name: 'share', type: 'material', color: 'white', size: 18 }}
                buttonStyle={styles.actionButton}
                onPress={shareVendor}
                containerStyle={styles.buttonContainer}
              />
            </View>
            
            {/* Social Media */}
            {(vendor.contact?.social?.instagram || vendor.contact?.social?.facebook) && (
              <View style={styles.socialContainer}>
                {vendor.contact?.social?.instagram && (
                  <TouchableOpacity style={styles.socialButton} onPress={openInstagram}>
                    <SocialIcon type="instagram" light raised={false} />
                    <Text style={styles.socialText}>Instagram</Text>
                  </TouchableOpacity>
                )}
                
                {vendor.contact?.social?.facebook && (
                  <TouchableOpacity style={styles.socialButton} onPress={openFacebook}>
                    <SocialIcon type="facebook" light raised={false} />
                    <Text style={styles.socialText}>Facebook</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          
          {/* Everyday Deals - Updated styling */}
          {vendorDeals.everyday.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Everyday Deals</Text>
              {vendorDeals.everyday.map((deal, index) => 
                renderDealCard(deal, index, 'everyday', 'everyday')
              )}
            </View>
          )}
          
          {/* Birthday Deals - Updated styling */}
          {vendorDeals.birthday.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Birthday Deals</Text>
              <Text style={styles.birthdayDisclaimer}>
                * Birthday deals are only available during your birthday month with valid ID
              </Text>
              {vendorDeals.birthday.map((deal, index) => 
                renderDealCard(deal, index, 'birthday', 'birthday')
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fixedHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  favoriteButton: {
    padding: 8,
    borderRadius: 20,
  },
  scrollView: {
    flex: 1,
    paddingTop: 15,
  },
  vendorInfo: {
    padding: 15,
  },
  vendorName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  partnerBadge: {
    backgroundColor: '#4CAF50',
    padding: 5,
    borderRadius: 5,
    marginLeft: 10,
  },
  partnerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    marginTop: 15,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 5,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationText: {
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
    flexWrap: 'wrap',
  },
  distanceText: {
    fontSize: 16,
    marginTop: 5,
    marginBottom: 15,
    color: '#4CAF50',
    fontWeight: '500',
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusBadge: {
    padding: 5,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  todayHours: {
    fontSize: 16,
    marginLeft: 10,
    fontWeight: '500',
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 5,
  },
  dayName: {
    fontSize: 15,
    width: 100,
  },
  hourTime: {
    fontSize: 15,
    color: '#555',
  },
  contactActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  buttonContainer: {
    margin: 5,
  },
  socialContainer: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'center',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  socialText: {
    fontSize: 14,
  },
  dealCard: {
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  dealDescription: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
    lineHeight: 20,
  },
  dealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  discountBadge: {
    backgroundColor: '#4CAF50',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  discountText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  noDealsText: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#777',
    padding: 20,
  },
  birthdayDisclaimer: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: '#4CAF50',
  },
  dealHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 8,
  },
  birthdayBadge: {
    backgroundColor: '#FF4081',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  birthdayBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 4,
  },
  journeyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginTop: 8,
  },
  journeyButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default VendorProfile;