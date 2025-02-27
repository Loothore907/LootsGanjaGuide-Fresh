// src/components/AdLoadingScreen.js
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Image, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  Dimensions,
  Animated,
  TouchableOpacity,
  Linking
} from 'react-native';
import { Icon } from '@rneui/themed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from '../services/LoggingService';
import { tryCatch } from '../utils/ErrorHandler';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

/**
 * AdLoadingScreen Component
 * 
 * Displays a featured vendor advertisement during loading states
 * Can be configured with minimum display time and onFinish callback
 * 
 * @param {Object} props - Component props
 * @param {number} props.minDisplayTime - Minimum time to display the ad in ms (default: 2000)
 * @param {Function} props.onFinish - Callback when ad finishes displaying
 * @param {string} props.vendorId - Optional specific vendor ID to feature
 * @param {boolean} props.showSkip - Whether to show skip button (default: true)
 * @param {number} props.skipDelay - Delay before showing skip button in ms (default: 1000)
 */
const AdLoadingScreen = ({ 
  minDisplayTime = 2000, 
  onFinish,
  vendorId = null,
  showSkip = true,
  skipDelay = 1000
}) => {
  const [vendor, setVendor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canSkip, setCanSkip] = useState(!showSkip);
  const fadeAnim = useState(new Animated.Value(0))[0];
  
  // This would connect to our actual API service in production
  const getRandomFeaturedVendor = async (id = null) => {
    try {
      // If a specific vendor ID is provided, use that
      if (id) {
        // In a real app, this would use the VendorService
        // For now, simulate by returning fake data
        return {
          id,
          name: 'Green Horizon',
          logoUrl: 'https://via.placeholder.com/100x100/4CAF50/FFFFFF?text=GH',
          bannerUrl: 'https://via.placeholder.com/800x400/4CAF50/FFFFFF?text=Green+Horizon+Banner',
          featuredDeal: '20% off all edibles today!',
          address: '123 Pine St, Anchorage, AK 99501',
          isPartner: true,
          website: 'https://www.example.com'
        };
      }
      
      // Try to get from AsyncStorage first (we might have cached featured vendors)
      const cachedFeaturedVendors = await AsyncStorage.getItem('featured_vendors');
      if (cachedFeaturedVendors) {
        const vendors = JSON.parse(cachedFeaturedVendors);
        if (vendors && vendors.length > 0) {
          // Select a random vendor
          const randomIndex = Math.floor(Math.random() * vendors.length);
          return vendors[randomIndex];
        }
      }
      
      // Fallback to a default ad if no cached data
      return {
        id: 'default',
        name: 'Loot\'s Ganja Guide',
        logoUrl: 'https://via.placeholder.com/100x100/4CAF50/FFFFFF?text=LGG',
        bannerUrl: 'https://via.placeholder.com/800x400/4CAF50/FFFFFF?text=Loot\'s+Ganja+Guide',
        featuredDeal: 'Discover the best cannabis deals in Anchorage!',
        address: 'Anchorage, Alaska',
        isPartner: true,
        website: null
      };
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error getting featured vendor for ad', { error });
      return null;
    }
  };
  
  useEffect(() => {
    let isMounted = true;
    let timers = [];
    
    const loadVendor = async () => {
      await tryCatch(async () => {
        const featuredVendor = await getRandomFeaturedVendor(vendorId);
        
        if (isMounted) {
          setVendor(featuredVendor);
          setIsLoading(false);
          
          // Fade in the ad
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
          
          // Log impression for analytics
          Logger.info(LogCategory.GENERAL, 'Ad impression', { 
            vendorId: featuredVendor?.id,
            vendorName: featuredVendor?.name,
            isPartner: featuredVendor?.isPartner
          });
          
          // Set minimum display time
          const timer = setTimeout(() => {
            if (isMounted && onFinish && typeof onFinish === 'function') {
              onFinish();
            }
          }, minDisplayTime);
          
          timers.push(timer);
          
          // Enable skip button after delay
          if (showSkip) {
            const skipTimer = setTimeout(() => {
              if (isMounted) {
                setCanSkip(true);
              }
            }, skipDelay);
            
            timers.push(skipTimer);
          }
        }
      }, LogCategory.GENERAL, 'loading featured vendor for ad', false);
    };
    
    loadVendor();
    
    // Clean up on unmount
    return () => {
      isMounted = false;
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);
  
  const handleVendorPress = () => {
    if (vendor && vendor.website) {
      // Log click for analytics
      Logger.info(LogCategory.GENERAL, 'Ad click', { 
        vendorId: vendor.id,
        vendorName: vendor.name,
        isPartner: vendor.isPartner
      });
      
      // Open vendor website if available
      Linking.openURL(vendor.website).catch(err => {
        Logger.warn(LogCategory.GENERAL, 'Could not open vendor website', { error: err });
      });
    }
  };
  
  const handleSkip = () => {
    if (canSkip && onFinish && typeof onFinish === 'function') {
      onFinish();
    }
  };
  
  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <Animated.View style={[styles.adContainer, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.contentContainer}
            activeOpacity={0.9}
            onPress={handleVendorPress}
          >
            <Image 
              source={{ uri: vendor?.bannerUrl || 'https://via.placeholder.com/800x400/4CAF50/FFFFFF?text=Ad+Banner' }} 
              style={styles.banner}
              resizeMode="cover"
            />
            
            <View style={styles.infoContainer}>
              <Image 
                source={{ uri: vendor?.logoUrl || 'https://via.placeholder.com/100x100/4CAF50/FFFFFF?text=Logo' }} 
                style={styles.logo}
                resizeMode="cover"
              />
              
              <View style={styles.textContainer}>
                <Text style={styles.vendorName}>{vendor?.name || 'Featured Partner'}</Text>
                <Text style={styles.dealText}>{vendor?.featuredDeal || 'Check out our special deals!'}</Text>
                <Text style={styles.addressText}>{vendor?.address || ''}</Text>
              </View>
            </View>
            
            <Text style={styles.sponsoredText}>SPONSORED</Text>
            
            {vendor?.website && (
              <View style={styles.learnMoreContainer}>
                <Text style={styles.learnMoreText}>Learn More</Text>
                <Icon name="chevron-right" type="material" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          
          {showSkip && (
            <TouchableOpacity 
              style={[styles.skipButton, !canSkip && styles.skipButtonDisabled]}
              onPress={handleSkip}
              disabled={!canSkip}
            >
              <Text style={[styles.skipText, !canSkip && styles.skipTextDisabled]}>
                {canSkip ? 'Skip' : `Skip in ${Math.ceil(skipDelay / 1000)}s`}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  adContainer: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  banner: {
    width: width,
    height: height * 0.3,
  },
  infoContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  vendorName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333333',
  },
  dealText: {
    fontSize: 16,
    color: '#4CAF50',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#666666',
  },
  sponsoredText: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
  },
  learnMoreContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  learnMoreText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginRight: 5,
  },
  skipButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipButtonDisabled: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  skipText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  skipTextDisabled: {
    color: 'rgba(255,255,255,0.7)',
  },
});

export default AdLoadingScreen;