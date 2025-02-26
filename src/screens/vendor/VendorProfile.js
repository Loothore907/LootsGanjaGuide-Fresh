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
  Share
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
import { getVendorById } from '../../services/MockDataService';

const VendorProfile = ({ route, navigation }) => {
  const { vendorId } = route.params;
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(true);
  const [vendor, setVendor] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  
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
  
  const loadVendorData = async () => {
    setIsLoading(true);
    
    try {
      await tryCatch(async () => {
        const vendorData = await getVendorById(vendorId);
        setVendor(vendorData);
        
        // Add to recent visits
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
    if (!vendor) return;
    
    const { latitude, longitude } = vendor.location.coordinates;
    const label = encodeURIComponent(vendor.name);
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
    if (!vendor) return;
    
    const phoneNumber = vendor.contact.phone.replace(/[^\d]/g, '');
    const url = `tel:${phoneNumber}`;
    
    Linking.openURL(url).catch(err => {
      Logger.error(LogCategory.GENERAL, 'Error making phone call', { error: err });
      alert('Could not initiate call. Please try again.');
    });
  };
  
  const emailVendor = () => {
    if (!vendor) return;
    
    const url = `mailto:${vendor.contact.email}`;
    
    Linking.openURL(url).catch(err => {
      Logger.error(LogCategory.GENERAL, 'Error sending email', { error: err });
      alert('Could not open email client. Please try again.');
    });
  };
  
  const openInstagram = () => {
    if (!vendor || !vendor.contact.social.instagram) return;
    
    const url = `https://instagram.com/${vendor.contact.social.instagram}`;
    
    Linking.openURL(url).catch(err => {
      Logger.error(LogCategory.GENERAL, 'Error opening Instagram', { error: err });
      alert('Could not open Instagram. Please try again.');
    });
  };
  
  const openFacebook = () => {
    if (!vendor || !vendor.contact.social.facebook) return;
    
    const url = `https://facebook.com/${vendor.contact.social.facebook}`;
    
    Linking.openURL(url).catch(err => {
      Logger.error(LogCategory.GENERAL, 'Error opening Facebook', { error: err });
      alert('Could not open Facebook. Please try again.');
    });
  };
  
  const shareVendor = async () => {
    if (!vendor) return;
    
    try {
      await Share.share({
        message: `Check out ${vendor.name} on Loot's Ganja Guide! They have great deals: ${vendor.location.address}`,
        title: `${vendor.name} - Cannabis Dispensary`
      });
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error sharing vendor', { error });
    }
  };
  
  const getCurrentDayDeals = () => {
    if (!vendor) return [];
    
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
    if (!vendor || !vendor.hours[day]) return 'Closed';
    
    const { open, close } = vendor.hours[day];
    return `${open} - ${close}`;
  };
  
  // Get today's hours
  const getTodayHours = () => {
    const today = getDayOfWeek();
    return formatHours(today);
  };
  
  // Check if currently open
  const isCurrentlyOpen = () => {
    if (!vendor) return false;
    
    const today = getDayOfWeek();
    const hours = vendor.hours[today];
    
    if (!hours) return false;
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= hours.open && currentTime <= hours.close;
  };
  
  // Animation for header
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [200, 60],
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
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <Animated.Image
          source={{ uri: vendor.bannerUrl || 'https://via.placeholder.com/400x200/4CAF50/FFFFFF?text=No+Image' }}
          style={[styles.banner, { opacity: headerOpacity }]}
        />
        <View style={styles.logoContainer}>
          <Image
            source={{ uri: vendor.logoUrl || 'https://via.placeholder.com/100x100/4CAF50/FFFFFF?text=Logo' }}
            style={styles.logo}
          />
        </View>
        <Animated.View style={[styles.headerTitle, { opacity: headerTitleOpacity }]}>
          <Text style={styles.headerTitleText}>{vendor.name}</Text>
        </Animated.View>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" type="material" color="#FFFFFF" size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.favoriteButton} onPress={toggleFavorite}>
          <Icon
            name={isFavorite ? "favorite" : "favorite-border"}
            type="material"
            color={isFavorite ? "#F44336" : "#FFFFFF"}
            size={24}
          />
        </TouchableOpacity>
      </Animated.View>
      
      <Animated.ScrollView
        style={styles.scrollView}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.vendorInfo}>
          <Text style={styles.vendorName}>{vendor.name}</Text>
          <View style={styles.ratingContainer}>
            <Icon name="star" type="material" color="#FFD700" size={20} />
            <Text style={styles.ratingText}>{vendor.rating.toFixed(1)}</Text>
            {vendor.isPartner && (
              <View style={styles.partnerBadge}>
                <Text style={styles.partnerText}>PARTNER</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  logoContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  headerTitle: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 2,
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
  },
  scrollView: {
    flex: 1,
  },
  vendorInfo: {
    padding: 20,
  },
  vendorName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 18,
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
});

export default VendorProfile;