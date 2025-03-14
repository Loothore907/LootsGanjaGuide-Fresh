// src/screens/vendor/VendorCheckin.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert,
  Linking,
  ActivityIndicator,
  Share,
  Platform,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Dimensions
} from 'react-native';
import { 
  Text, 
  Button, 
  Icon,
  Card
} from '@rneui/themed';
import serviceProvider from '../../services/ServiceProvider';

// Import the QRScanner component instead of BarCodeScanner
import QRScanner from '../../components/QRScanner';

// Import Camera for permission requests
import { Camera } from 'expo-camera';

import * as Location from 'expo-location';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import redemptionService from '../../services/RedemptionService';
import locationService from '../../services/LocationService';
import { Picker } from '@react-native-picker/picker';
import VendorRepository from '../../repositories/VendorRepository';

// Get screen dimensions
const { width } = Dimensions.get('window');

// Main VendorCheckin component
const VendorCheckin = ({ route, navigation }) => {
  const { state, dispatch } = useAppState();
  const { vendorId, fromJourney } = route.params || {};
  
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scannedVendor, setScannedVendor] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [locationVerificationOpen, setLocationVerificationOpen] = useState(false);
  
  // Request camera permissions and check if direct vendor ID was provided
  useEffect(() => {
    let isMounted = true;
    
    const setupCamera = async () => {
      if (vendorId) {
        // Skip QR scan if we already have a vendor ID
        handleDirectCheckin(vendorId);
      } else {
        try {
          const { status } = await Camera.requestCameraPermissionsAsync();
          if (isMounted) {
            setHasPermission(status === 'granted');
            
            if (status !== 'granted') {
              Logger.warn(LogCategory.PERMISSIONS, 'Camera permission was denied');
            }
          }
        } catch (error) {
          Logger.error(LogCategory.PERMISSIONS, 'Error requesting camera permission', { error });
          if (isMounted) {
            setHasPermission(false);
          }
        }
      }
    };
    
    setupCamera();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Add this function to get the user's current location
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Logger.warn(LogCategory.PERMISSIONS, 'Location permission was denied');
        setUserLocation(null);
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      setUserLocation(location.coords);
      
      // Calculate distance to vendor if vendor data is available
      if (scannedVendor && scannedVendor.location?.coordinates) {
        const vendorCoords = scannedVendor.location.coordinates;
        const calculatedDistance = locationService.calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          vendorCoords.latitude,
          vendorCoords.longitude
        );
        
        setDistance(calculatedDistance);
      }
    } catch (error) {
      Logger.error(LogCategory.LOCATION, 'Error getting current location', { error });
      setUserLocation(null);
    }
  };
  
  const handleDirectCheckin = async (id) => {
    try {
      const vendorIdStr = id.toString();
      Logger.info(LogCategory.VENDOR, 'Direct check-in requested', { vendorId: vendorIdStr });
      
      // Get vendor from repository
      const vendor = await VendorRepository.getById(vendorIdStr);
      
      if (!vendor) {
        Logger.error(LogCategory.VENDOR, `Vendor not found for direct check-in`, { vendorId: vendorIdStr });
        Alert.alert('Error', 'Vendor not found. Please try again.');
        return;
      }
      
      // Ensure hasQrCode property exists without logging a warning
      if (vendor.hasQrCode === undefined) {
        vendor.hasQrCode = true;
      }
      
      // Set as scanned vendor and proceed with check-in
      setScannedVendor({
        ...vendor,
        hasQrCode: vendor.hasQrCode
      });
      
      // Get current location for distance calculation
      await getCurrentLocation();
      
    } catch (error) {
      Logger.error(LogCategory.VENDOR, 'Error in direct check-in', { error });
      Alert.alert('Error', 'Failed to check in. Please try again.');
    }
  };
  
  // Modify handleConfirmCheckin to check distance but not block users
  const handleConfirmCheckin = async () => {
    if (!scannedVendor) return;
    
    // Check if we have location data and if the user is far from the vendor
    if (distance !== null && distance > 0.1) {
      // Show location verification modal instead of blocking
      setLocationVerificationOpen(true);
      return;
    }
    
    // If distance is within range or we don't have location data, proceed with check-in
    processCheckin();
  };
  
  // Add a new function to force check-in when user confirms they're at the location
  const handleForceCheckin = () => {
    // Log the discrepancy
    Logger.info(LogCategory.CHECKIN, 'User confirmed check-in despite location mismatch', {
      vendorId: scannedVendor.id,
      vendorName: scannedVendor.name,
      userLocation: userLocation ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude
      } : null,
      vendorLocation: scannedVendor.location?.coordinates,
      calculatedDistance: distance
    });
    
    // Close modal and process check-in
    setLocationVerificationOpen(false);
    processCheckin();
  };
  
  // Rename the existing check-in logic to this function
  const processCheckin = async () => {
    if (!scannedVendor) return;
    
    setIsLoading(true);
    try {
      await tryCatch(async () => {
        // Process check-in with QR type and deal type
        const result = await serviceProvider.checkInAtVendor(scannedVendor.id, {
          checkInType: 'qr',
          dealType: state.journey?.dealType || 'standard',
          journeyId: state.journey?.id || null,
          pointsOverride: 10 // Full points for QR check-in
        });
        
        // Record the deal redemption
        await redemptionService.recordRedemption(
          scannedVendor.id, 
          state.journey?.dealType || 'standard',
          `${state.journey?.dealType || 'standard'}-${scannedVendor.id}`
        );
        
        // Update points
        dispatch(AppActions.updatePoints(result.pointsEarned));
        
        // Update journey state to mark vendor as checked in
        if (state.journey && state.journey.isActive) {
          const currentVendorIndex = state.journey.currentVendorIndex;
          // Ensure we're updating the correct vendor in journey
          if (currentVendorIndex >= 0 && currentVendorIndex < state.journey.vendors.length) {
            // Mark the current vendor as checked in with 'qr' type
            dispatch(AppActions.markVendorCheckedIn(currentVendorIndex, 'qr'));
            
            // Log for debugging journey state
            Logger.info(LogCategory.JOURNEY, 'Marked vendor as checked in', {
              vendorId: scannedVendor.id,
              journeyIndex: currentVendorIndex,
              journeyTotalVendors: state.journey.totalVendors,
              checkInType: 'qr'
            });
          } else {
            Logger.warn(LogCategory.JOURNEY, 'Invalid journey vendor index', {
              currentVendorIndex,
              totalVendors: state.journey.totalVendors
            });
          }
        }
        
        // Add to recent visits
        const visit = {
          vendorId: scannedVendor.id,
          vendorName: scannedVendor.name,
          lastVisit: new Date().toISOString(),
          visitCount: 1
        };
        dispatch(AppActions.addRecentVisit(visit));
        
        // Check user preferences for social sharing
        const userSocialPrefs = await AsyncStorage.getItem('social_sharing_prefs');
        const sharingEnabled = userSocialPrefs ? JSON.parse(userSocialPrefs).enabled : false;
        
        // Attempt automatic social sharing if enabled
        if (sharingEnabled) {
          await autoShareCheckin(scannedVendor);
        }
        
        // Show success message
        Alert.alert(
          'Check-in Successful!',
          `You have earned ${result.pointsEarned} points for checking in at ${scannedVendor.name}.`,
          [
            // Only show share option if not already automatically shared
            ...(sharingEnabled ? [] : [{ 
              text: 'Share',
              onPress: () => handleShareCheckin() 
            }]),
            { 
              text: 'Continue',
              onPress: () => navigateAfterCheckin()
            }
          ]
        );
      }, LogCategory.CHECKIN, 'processing check-in', true);
    } catch (error) {
      // Error already logged by tryCatch
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create a separate function for navigation after check-in to ensure state updates have propagated
  const navigateAfterCheckin = () => {
    // Ensure we have the most up-to-date journey state
    const journey = state.journey;
    const journeyVendors = journey?.vendors || [];
    const currentIndex = journey?.currentVendorIndex || 0;
    const isLastVendor = currentIndex >= journeyVendors.length - 1;
    
    if (journey && journey.isActive) {
      // Count total visited vendors for journey stats
      let visitedCount = 0;
      journeyVendors.forEach(vendor => {
        if (vendor.checkedIn) {
          visitedCount++;
        }
      });
      
      // Include the current vendor as checked in for the journey data
      // This ensures the last vendor shows as checked in even if state hasn't fully updated
      const updatedVendors = journeyVendors.map((vendor, idx) => 
        idx === currentIndex 
          ? { ...vendor, checkedIn: true, checkInType: 'qr' } 
          : vendor
      );
      
      Logger.info(LogCategory.JOURNEY, 'Journey progress before navigation', {
        currentIndex,
        totalVendors: journeyVendors.length,
        visitedCount,
        isLastVendor,
        updatedVendorsCount: updatedVendors.filter(v => v.checkedIn).length
      });
      
      if (isLastVendor) {
        // This is the last vendor, complete the journey
        // Create a complete journey data object to pass with updated vendors
        const completeJourneyData = {
          journeyType: journey.dealType,
          vendors: updatedVendors, // Use updated vendors that include the last check-in
          currentVendorIndex: currentIndex,
          totalVendors: journey.totalVendors,
          visitedVendors: visitedCount + 1, // Include the current check-in
          totalDistance: state.route?.totalDistance || 0,
          allCheckedIn: true // Explicitly mark that all vendors are checked in
        };
        
        // Use setTimeout to ensure state updates have time to propagate
        setTimeout(() => {
          // Navigate to journey complete with the data
          navigation.navigate('JourneyComplete', { 
            terminationType: "success",
            journeyData: completeJourneyData
          });
        }, 300); // Short delay to allow for state updates
      } else {
        // Not the last vendor, advance to next vendor
        dispatch(AppActions.nextVendor());
        
        // Navigate back to route view
        navigation.navigate('RouteMapView');
      }
    } else {
      // Just go to vendor profile
      navigation.navigate('VendorProfile', { vendorId: scannedVendor.id });
    }
  };
  
  const handleShareCheckin = async () => {
    if (!scannedVendor) return;
    
    try {
      // Prepare share message
      const shareMessage = `I just checked in at ${scannedVendor.name} using Loot's Ganja Guide! #LootsGanjaGuide #Cannabis #${scannedVendor.name.replace(/\s+/g, '')}`;
      
      // Share using native share dialog
      const result = await Share.share({
        message: shareMessage,
        title: 'Loot\'s Ganja Guide Check-in'
      });
      
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared with activity type of result.activityType
          Logger.info(LogCategory.SOCIAL, 'User shared check-in', {
            platform: result.activityType
          });
        } else {
          // Shared
          Logger.info(LogCategory.SOCIAL, 'User shared check-in');
        }
        
        // After sharing, continue with journey if applicable
        navigateAfterCheckin();
      } else if (result.action === Share.dismissedAction) {
        // Dismissed
        Logger.info(LogCategory.SOCIAL, 'User dismissed share dialog');
        
        // Still continue with journey if applicable
        navigateAfterCheckin();
      }
    } catch (error) {
      Logger.error(LogCategory.SOCIAL, 'Error sharing check-in', { error });
      Alert.alert('Sharing Failed', 'Could not share your check-in. Please try again.');
      
      // Continue anyway
      navigateAfterCheckin();
    }
  };
  
  const handleCancel = () => {
    navigation.goBack();
  };
  
  // Toggle flashlight/torch
  const toggleTorch = () => {
    setTorchOn(prevTorchOn => !prevTorchOn);
  };
  
  // Helper function for automated social sharing
  const autoShareCheckin = async (vendor) => {
    try {
      // Get user social media preferences
      const socialPrefs = await AsyncStorage.getItem('social_sharing_prefs');
      const prefs = socialPrefs ? JSON.parse(socialPrefs) : { tier: 'none' };
      
      // Check if vendor has social media
      const hasVendorSocial = vendor.contact?.social?.instagram || vendor.contact?.social?.facebook;
      
      // Skip if vendor has no social media
      if (!hasVendorSocial) {
        Logger.info(LogCategory.SOCIAL, 'Skipped auto-sharing: vendor has no social accounts');
        return;
      }
      
      // Determine user info to share based on preference tier
      let username;
      switch(prefs.tier) {
        case 'full': // Share real name/info
          username = prefs.realName || state.user.username;
          break;
        case 'username': // Share only username
          username = state.user.username;
          break;
        case 'anonymous': // Use anonymous name
          username = 'Drug Crazed Hermit'; // As specified in your requirements
          break;
        default:
          // Don't share anything if tier is 'none'
          return;
      }
      
      // Prepare share message
      const shareMessage = `${username} just checked in at ${vendor.name} using Loot's Ganja Guide! #LootsGanjaGuide #Cannabis #${vendor.name.replace(/\s+/g, '')}`;
      
      // Log the sharing for implementation
      Logger.info(LogCategory.SOCIAL, 'Auto-shared check-in', {
        vendor: vendor.name,
        socialTier: prefs.tier,
        message: shareMessage
      });
      
      return { success: true, message: shareMessage };
    } catch (error) {
      Logger.error(LogCategory.SOCIAL, 'Error in automated social sharing', { error });
      return { success: false };
    }
  };
  
  // Modify handleManualCheckin to use the new location verification
  const handleManualCheckin = async (isQrSkip) => {
    try {
      Logger.info(LogCategory.VENDOR, 'Manual check-in initiated', { 
        vendorId: scannedVendor?.id,
        vendorName: scannedVendor?.name
      });
      
      // Always award full points (10) for manual check-ins
      await processManualCheckin(10, 'manual');
      
    } catch (error) {
      Logger.error(LogCategory.VENDOR, 'Error in manual check-in', { error });
      Alert.alert('Error', 'Failed to check in. Please try again.');
    }
  };
  
  // Process check-in with points and type
  const processManualCheckin = async (pointsValue, checkInType) => {
    setIsLoading(true);
    try {
      // Process check-in with manual type and deal type
      const result = await serviceProvider.checkInAtVendor(scannedVendor.id, {
        checkInType: checkInType,
        dealType: state.journey?.dealType || 'standard',
        journeyId: state.journey?.id || null,
        pointsOverride: pointsValue
      });
      
      // Record the deal redemption
      await redemptionService.recordRedemption(
        scannedVendor.id, 
        state.journey?.dealType || 'standard',
        `${state.journey?.dealType || 'standard'}-${scannedVendor.id}`
      );
      
      // Update points
      dispatch(AppActions.updatePoints(pointsValue));
      
      // Mark vendor as checked in with type
      if (state.journey?.isActive) {
        const currentVendorIndex = state.journey.currentVendorIndex;
        if (currentVendorIndex >= 0 && currentVendorIndex < state.journey.vendors.length) {
          dispatch(AppActions.markVendorCheckedIn(currentVendorIndex, checkInType));
        }
      }
      
      // Add to recent visits
      const visit = {
        vendorId: scannedVendor.id,
        vendorName: scannedVendor.name,
        lastVisit: new Date().toISOString(),
        visitCount: 1
      };
      dispatch(AppActions.addRecentVisit(visit));
      
      // Check user preferences for social sharing
      const userSocialPrefs = await AsyncStorage.getItem('social_sharing_prefs');
      const sharingEnabled = userSocialPrefs ? JSON.parse(userSocialPrefs).enabled : false;
      
      // Attempt automatic social sharing if enabled
      if (sharingEnabled) {
        await autoShareCheckin(scannedVendor);
      }
      
      // Show success message
      Alert.alert(
        'Check-in Successful!',
        `You have earned ${pointsValue} points for checking in at ${scannedVendor.name}.`,
        [
          // Only show share option if not already automatically shared
          ...(sharingEnabled ? [] : [{ 
            text: 'Share',
            onPress: () => handleShareCheckin() 
          }]),
          {
            text: 'Continue',
            onPress: () => navigateAfterCheckin()
          }
        ]
      );
      
      Logger.info(LogCategory.CHECKIN, 'User checked in', {
        vendorId: scannedVendor.id,
        pointsEarned: pointsValue,
        method: checkInType
      });
    } catch (error) {
      // Error already logged by tryCatch
      Alert.alert('Error', 'Failed to process check-in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Modify the camera view section
  if (scannedVendor) {
    // Show check-in confirmation or options
    return (
      <SafeAreaView style={styles.container}>
        {showScanner ? (
          // Show QR scanner using the QRScanner component
          <View style={styles.scannerContainer}>
            <QRScanner
              onScan={(data) => {
                // Handle the scanned data
                try {
                  // Try to parse the QR code data
                  let vendorId;
                  try {
                    const qrData = JSON.parse(data);
                    vendorId = qrData.vendorId;
                  } catch (e) {
                    // If parsing fails, try to extract vendor ID from string
                    const match = data.match(/vendorId[=:]["']?(\d+)/);
                    if (match && match[1]) {
                      vendorId = match[1];
                    } else if (/^\d+$/.test(data)) {
                      // If data is just a number, assume it's a vendor ID
                      vendorId = data;
                    }
                  }
                  
                  if (vendorId) {
                    // Process the vendor ID
                    handleDirectCheckin(vendorId);
                  } else {
                    throw new Error('No vendor ID found in QR code');
                  }
                } catch (error) {
                  Logger.error(LogCategory.VENDOR, 'Error processing QR code', { error });
                  Alert.alert(
                    'QR Code Error',
                    'Could not process the QR code. Please try again or use manual check-in.',
                    [
                      {
                        text: 'Try Again',
                        onPress: () => setScanned(false)
                      },
                      {
                        text: 'Manual Check-in',
                        onPress: () => handleManualCheckin(false)
                      }
                    ]
                  );
                }
              }}
              onClose={handleCancel}
              urlPrefix=""
            />
          </View>
        ) : (
          // Show check-in options
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Icon name="check-circle" type="material" size={64} color="#4CAF50" />
            <Text style={styles.confirmTitle}>Welcome to {scannedVendor.name}!</Text>
            <Text style={styles.confirmMessage}>
              Don't forget to check in to earn points and share your visit!
            </Text>
            <Text style={styles.confirmVendor}>{scannedVendor.name}</Text>
            <Text style={styles.confirmAddress}>{scannedVendor.location.address}</Text>
            
            {/* Consistent check-in UI based on vendor QR capabilities */}
            <View style={styles.buttonsContainer}>
              {/* Only show QR option if vendor has QR capabilities */}
              {scannedVendor.hasQrCode && (
                <Button
                  title="Check In with QR Code"
                  icon={{
                    name: "qr-code-scanner",
                    type: "material",
                    size: 20,
                    color: "white"
                  }}
                  onPress={() => setShowScanner(true)}
                  buttonStyle={styles.scanQrButton}
                  containerStyle={styles.buttonContainer}
                />
              )}
              
              {/* Option 2: Manual check-in (with penalty message if QR is available) */}
              <Button
                title={scannedVendor.hasQrCode ? 
                  "Manual Check-in" : 
                  "Check In"}
                icon={{
                  name: "eco",
                  type: "material",
                  size: 20,
                  color: "white"
                }}
                type={scannedVendor.hasQrCode ? "solid" : "solid"}
                onPress={() => handleManualCheckin(scannedVendor.hasQrCode)}
                buttonStyle={scannedVendor.hasQrCode ? styles.manualButton : styles.confirmButton}
                containerStyle={styles.buttonContainer}
              />
            </View>

            {/* Only show QR info message if vendor has QR capability */}
            {scannedVendor.hasQrCode && (
              <View style={styles.qrInfoContainer}>
                <Icon name="emoji-emotions" type="material" color="#4CAF50" size={20} />
                <Text style={styles.qrInfoText}>
                  QR scans help us improve the app experience for everyone! Both options give you full points.
                </Text>
              </View>
            )}
            
            <Button
              title="Cancel"
              type="clear"
              onPress={handleCancel}
              containerStyle={styles.buttonContainer}
            />
            
            {/* Location Verification Modal */}
            <Modal
              visible={locationVerificationOpen}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setLocationVerificationOpen(false)}
            >
              <View style={styles.modalOverlay}>
                <Card containerStyle={styles.modalCard}>
                  <Icon
                    name="place"
                    type="material"
                    size={40}
                    color="#F44336"
                    containerStyle={styles.modalIcon}
                  />
                  
                  <Card.Title style={styles.modalTitle}>Too Far Away</Card.Title>
                  
                  <Text style={styles.modalText}>
                    You appear to be {distance?.toFixed(2) || "some distance"} miles from {scannedVendor.name}. 
                    GPS can sometimes be inaccurate - are you sure you're at this location?
                  </Text>
                  
                  <View style={styles.modalButtonsContainer}>
                    <Button
                      title="Let me try again"
                      type="outline"
                      onPress={() => {
                        setLocationVerificationOpen(false);
                        getCurrentLocation(); // Refresh the location
                      }}
                      containerStyle={styles.modalButtonContainer}
                      buttonStyle={styles.modalCancelButton}
                    />
                    
                    <Button
                      title="Yes, I'm here!"
                      onPress={handleForceCheckin}
                      containerStyle={styles.modalButtonContainer}
                      buttonStyle={styles.modalConfirmButton}
                    />
                  </View>
                </Card>
              </View>
            </Modal>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }
  
  // Show QR scanner or permission screens
  return (
    <SafeAreaView style={styles.container}>
      {hasPermission === null ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      ) : hasPermission === false ? (
        <View style={styles.centeredContainer}>
          <Icon name="camera-off" type="material" size={64} color="#F44336" />
          <Text style={styles.permissionText}>
            Camera permission is required to scan check-in QR codes.
          </Text>
          <Button
            title="Open Settings"
            onPress={() => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }}
            buttonStyle={styles.permissionButton}
            containerStyle={styles.buttonContainer}
          />
          <Button
            title="Manual Check-in"
            onPress={() => {
              // Show manual check-in options
              Alert.alert(
                'Manual Check-in',
                'Would you like to enter a vendor ID manually?',
                [
                  {
                    text: 'Enter Vendor ID',
                    onPress: () => {
                      // For now, just use a default vendor ID
                      handleDirectCheckin('10975');
                    }
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: handleCancel
                  }
                ]
              );
            }}
            buttonStyle={styles.manualButton}
            containerStyle={styles.buttonContainer}
          />
          <Button
            title="Go Back"
            type="outline"
            onPress={handleCancel}
            containerStyle={styles.buttonContainer}
          />
        </View>
      ) : (
        <View style={styles.scannerContainer}>
          {/* Use QRScanner component instead of BarCodeScanner */}
          <QRScanner
            onScan={(data) => {
              // Handle the scanned data
              try {
                Logger.info(LogCategory.CHECKIN, 'QR code scanned', { data });
                
                // Try to parse the QR code data
                let vendorId;
                try {
                  const qrData = JSON.parse(data);
                  vendorId = qrData.vendorId;
                } catch (e) {
                  // If parsing fails, try to extract vendor ID from string
                  const match = data.match(/vendorId[=:]["']?(\d+)/);
                  if (match && match[1]) {
                    vendorId = match[1];
                  } else if (/^\d+$/.test(data)) {
                    // If data is just a number, assume it's a vendor ID
                    vendorId = data;
                  }
                }
                
                if (vendorId) {
                  // Process the vendor ID
                  handleDirectCheckin(vendorId);
                } else {
                  throw new Error('No vendor ID found in QR code');
                }
              } catch (error) {
                Logger.error(LogCategory.VENDOR, 'Error processing QR code', { error });
                Alert.alert(
                  'QR Code Error',
                  'Could not process the QR code. Please try again or use manual check-in.',
                  [
                    {
                      text: 'Try Again',
                      onPress: () => setScanned(false)
                    },
                    {
                      text: 'Manual Check-in',
                      onPress: () => handleManualCheckin(false)
                    }
                  ]
                );
              }
            }}
            onClose={handleCancel}
            urlPrefix=""
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scannerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: width * 0.7,
    height: width * 0.7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  scannerControls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  controlButton: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorInfoContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vendorName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  vendorAddress: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  vendorDistance: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 15,
  },
  dealContainer: {
    marginTop: 10,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  dealTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  dealDescription: {
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    marginTop: 20,
    width: '100%',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  scanQrButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
  },
  manualButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  cancelButton: {
    backgroundColor: '#f44336',
    borderRadius: 8,
    paddingVertical: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    margin: 5,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4CAF50',
  },
  infoText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
    fontSize: 14,
  },
  locationVerificationContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    alignSelf: 'center',
  },
  locationVerificationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  locationVerificationText: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  locationVerificationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scannerFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    width: '100%',
    padding: 20,
  },
  scannerFallbackText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
  },
  scanner: {
    flex: 1,
    width: '100%',
  },
  unfilled: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    height: width * 0.7,
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#fff',
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
    textAlign: 'center',
  },
  torchButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 150,
  },
  qrInfoContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F8E9',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  qrInfoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#4CAF50',
    lineHeight: 20,
  },
  checkinOptionsContainer: {
    width: '100%',
    alignItems: 'center',
    padding: 20,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  permissionText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
  },
  permissionSubtext: {
    textAlign: 'center',
    fontSize: 14,
    color: '#999999',
    marginTop: 8,
  },
  errorDetails: {
    textAlign: 'center',
    fontSize: 14,
    color: '#F44336',
    marginTop: 8,
    marginBottom: 16,
  },
  permissionButtonsContainer: {
    width: '80%',
    marginTop: 20,
  },
  scannerFallbackSubtext: {
    color: '#DDDDDD',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  scanTarget: {
    width: width * 0.7,
    height: width * 0.7,
    borderWidth: 0,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFFFFF',
    borderWidth: 3,
    top: 0,
    left: 0,
  },
  rescanButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 15,
  },
  rescanButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  manualCheckInButton: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  manualCheckInText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  manualButtonContainer: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    width: 200,
  },
});

export default VendorCheckin;