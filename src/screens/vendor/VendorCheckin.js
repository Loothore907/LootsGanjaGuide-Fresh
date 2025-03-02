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
  Modal
} from 'react-native';
import { 
  Text, 
  Button, 
  Icon,
  Card
} from '@rneui/themed';

// Import the Camera conditionally to avoid crashes if it's not available
let Camera;
// Add default Camera Constants to prevent undefined errors
const CameraConstants = {
  Type: {
    back: 1,
    front: 0
  },
  FlashMode: {
    off: 0,
    on: 1,
    auto: 2,
    torch: 1
  }
};

try {
  Camera = require('expo-camera').Camera;
  // Only override our constants if the import succeeded
  if (Camera && Camera.Constants) {
    CameraConstants.Type = Camera.Constants.Type;
    CameraConstants.FlashMode = Camera.Constants.FlashMode;
  }
} catch (e) {
  console.warn('Camera import failed:', e);
  // Create a mock Camera component
  Camera = ({ children, style, type, flashMode, onBarCodeScanned }) => (
    <View style={[{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }, style]}>
      <Text style={{ color: 'white', marginBottom: 20 }}>Camera preview not available</Text>
      {children}
    </View>
  );
}

import * as Location from 'expo-location';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import { checkInAtVendor, getVendorById } from '../../services/MockDataService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import redemptionService from '../../services/RedemptionService';
import locationService from '../../services/LocationService';
import { Picker } from '@react-native-picker/picker';

// Add this component inside VendorCheckin.js file, before the main VendorCheckin component
const MockQRScanner = ({ onScan, onClose }) => {
  const [vendorId, setVendorId] = useState('v1'); // Default test vendor
  
  const handleMockScan = () => {
    // Simulate a QR code scan with the format "lootsganja://checkin/{vendorId}"
    onScan({
      type: 'QR',
      data: `lootsganja://checkin/${vendorId}`
    });
  };
  
  return (
    <View style={styles.mockScannerContainer}>
      <Text style={styles.mockTitle}>Mock QR Scanner (Dev Only)</Text>
      
      <View style={styles.mockInputContainer}>
        <Text>Select Vendor ID:</Text>
        <Picker
          selectedValue={vendorId}
          onValueChange={(itemValue) => setVendorId(itemValue)}
          style={styles.vendorPicker}
        >
          <Picker.Item label="Green Horizon (v1)" value="v1" />
          <Picker.Item label="Aurora Dispensary (v2)" value="v2" />
          <Picker.Item label="Northern Lights (v3)" value="v3" />
          <Picker.Item label="Denali Dispensary (v4)" value="v4" />
          <Picker.Item label="Arctic Buds (v5)" value="v5" />
        </Picker>
      </View>
      
      <Button
        title="Simulate QR Scan"
        onPress={handleMockScan}
        buttonStyle={styles.scanButton}
      />
      
      <Button
        title="Cancel"
        type="outline"
        onPress={onClose}
        buttonStyle={styles.cancelButton}
      />
      
      <Text style={styles.mockNote}>
        Mock QR data: lootsganja://checkin/{vendorId}
      </Text>
    </View>
  );
};

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
  const [showMockScanner, setShowMockScanner] = useState(false);
  
  // Request camera permissions and check if direct vendor ID was provided
  useEffect(() => {
    let isMounted = true;
    
    const setupCamera = async () => {
      if (vendorId) {
        // Skip QR scan if we already have a vendor ID
        handleDirectCheckin(vendorId);
      } else {
        try {
          // Only request camera permission if Camera is available
          if (Camera && Camera.requestCameraPermissionsAsync) {
            // Request camera permission
            const { status } = await Camera.requestCameraPermissionsAsync();
            if (isMounted) {
              setHasPermission(status === 'granted');
            
              if (status !== 'granted') {
                Logger.warn(LogCategory.PERMISSIONS, 'Camera permission was denied');
              }
            }
          } else {
            // Camera not available, set permission to false
            if (isMounted) {
              setHasPermission(false);
              Logger.warn(LogCategory.PERMISSIONS, 'Camera is not available on this device');
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
    setIsLoading(true);
    try {
      await tryCatch(async () => {
        // Get vendor information
        const vendor = await getVendorById(id);
        
        // Check if vendor exists
        if (!vendor) {
          throw new Error(`No vendor found with ID: ${id}`);
        }
        
        // Ensure hasQrCode property exists
        if (vendor.hasQrCode === undefined) {
          // Default to true for safety if not specified
          vendor.hasQrCode = true;
          Logger.warn(LogCategory.VENDOR, 'Vendor missing hasQrCode property, defaulting to true', {
            vendorId: id,
            vendorName: vendor.name
          });
        }
        
        setScannedVendor(vendor);
        
        // Get current location after setting vendor
        await getCurrentLocation();
        
        // Process check-in (will happen when user confirms)
        Logger.info(LogCategory.CHECKIN, 'Direct check-in initiated', { 
          vendorId: id,
          vendorName: vendor.name,
          hasQrCode: vendor.hasQrCode
        });
      }, LogCategory.CHECKIN, 'getting vendor for direct check-in', true);
    } catch (error) {
      // Error already logged by tryCatch
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned) return;
    
    setScanned(true);
    setIsLoading(true);
    
    try {
      // Verify QR code format
      // Expected format: lootsganja://checkin/{vendorId}
      if (data.startsWith('lootsganja://checkin/')) {
        const scannedVendorId = data.replace('lootsganja://checkin/', '');
        
        await tryCatch(async () => {
          // Get vendor information
          const vendor = await getVendorById(scannedVendorId);
          setScannedVendor(vendor);
          
          Logger.info(LogCategory.CHECKIN, 'Scanned check-in QR code', {
            vendorId: scannedVendorId
          });
        }, LogCategory.CHECKIN, 'processing scanned QR code', true);
      } else {
        // Invalid QR code
        Alert.alert(
          'Invalid QR Code',
          'This QR code is not a valid Loot\'s Ganja Guide check-in code. Please scan a code from a participating vendor.',
          [
            { 
              text: 'OK', 
              onPress: () => {
                setScanned(false);
                setIsLoading(false);
              }
            }
          ]
        );
      }
    } catch (error) {
      // Error already logged by tryCatch
      setScanned(false);
    } finally {
      setIsLoading(false);
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
        // Process check-in
        const result = await checkInAtVendor(scannedVendor.id);
        
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
              onPress: () => handleContinueJourney()
            }
          ]
        );
        
        Logger.info(LogCategory.CHECKIN, 'User checked in successfully', {
          vendorId: scannedVendor.id,
          pointsEarned: result.pointsEarned
        });
      }, LogCategory.CHECKIN, 'processing check-in', true);
    } catch (error) {
      // Error already logged by tryCatch
    } finally {
      setIsLoading(false);
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
        handleContinueJourney();
      } else if (result.action === Share.dismissedAction) {
        // Dismissed
        Logger.info(LogCategory.SOCIAL, 'User dismissed share dialog');
        
        // Still continue with journey if applicable
        handleContinueJourney();
      }
    } catch (error) {
      Logger.error(LogCategory.SOCIAL, 'Error sharing check-in', { error });
      Alert.alert('Sharing Failed', 'Could not share your check-in. Please try again.');
      
      // Continue anyway
      handleContinueJourney();
    }
  };
  
  const handleContinueJourney = () => {
    // Check if we're in a journey
    if (fromJourney) {
      // Get journey state
      const journeyVendors = state.journey?.vendors || [];
      const currentIndex = state.journey?.currentVendorIndex || 0;
      const isLastVendor = currentIndex === journeyVendors.length - 1;
      
      // Count total visited vendors for journey stats
      let visitedCount = 0;
      journeyVendors.forEach(vendor => {
        if (vendor.checkedIn) {
          visitedCount++;
        }
      });
      
      Logger.info(LogCategory.JOURNEY, 'Journey progress', {
        currentIndex,
        totalVendors: journeyVendors.length,
        visitedCount,
        isLastVendor
      });
      
      if (isLastVendor) {
        // This is the last vendor, complete the journey
        // Create a complete journey data object to pass
        const completeJourneyData = {
          journeyType: state.journey.dealType,
          vendors: state.journey.vendors,
          currentVendorIndex: state.journey.currentVendorIndex,
          totalVendors: state.journey.totalVendors,
          visitedVendors: visitedCount, // Make sure this is accurate
          totalDistance: state.route?.totalDistance || 0
        };
        
        // Navigate to journey complete with the data
        navigation.navigate('JourneyComplete', { 
          terminationType: "success",
          journeyData: completeJourneyData
        });
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
      
      // Log the sharing but don't actually perform sharing in this mock implementation
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
    // Get location if we don't have it yet
    if (!userLocation) {
      await getCurrentLocation();
    }
    
    // If we have location and distance data, check if user is far from vendor
    if (distance !== null && distance > 0.1) {
      // Show location verification modal
      setLocationVerificationOpen(true);
      return;
    }
    
    // Process the check-in with appropriate points
    let pointsValue = 10; // Default points for QR or non-QR vendor
    let checkInType = 'manual';
    
    if (scannedVendor.hasQrCode && isQrSkip) {
      pointsValue = 5; // Half points for skipping QR at a QR-enabled vendor
      checkInType = 'qr_skipped';
    }
    
    // Process check-in
    await processManualCheckin(pointsValue, checkInType);
  };
  
  // Process check-in with points and type
  const processManualCheckin = async (pointsValue, checkInType) => {
    setIsLoading(true);
    try {
      // Process check-in
      const result = await checkInAtVendor(scannedVendor.id);
      
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
            onPress: () => handleContinueJourney()
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
  
  // Determine what check-in options to show based on vendor status
  const renderCheckinOptions = () => {
    // Determine if vendor has QR code capability
    const hasQrOption = scannedVendor.hasQrCode === true;
    
    return (
      <View style={styles.checkinOptionsContainer}>
        {hasQrOption ? (
          // Vendor has QR code option
          <>
            <Button
              title="Scan QR Code"
              icon={{
                name: "qr-code-scanner",
                type: "material",
                size: 20,
                color: "white"
              }}
              onPress={activateScanner}
              buttonStyle={styles.scanQrButton}
              containerStyle={styles.buttonContainer}
            />
            
            <Button
              title="Skip QR Code (Half Points)"
              icon={{
                name: "eco",
                type: "material",
                size: 20,
                color: "#666"
              }}
              type="outline"
              onPress={() => handleManualCheckin(true)}
              buttonStyle={styles.skipQrButton}
              containerStyle={styles.buttonContainer}
            />
            
            {/* Humorous message about QR codes */}
            <View style={styles.qrInfoContainer}>
              <Icon name="emoji-emotions" type="material" color="#4CAF50" size={20} />
              <Text style={styles.qrInfoText}>
                We get it - sometimes QR codes can be a pain! But they help us collect valuable data 
                so we can build a better app. Plus, all those sweet rewards in the Points Shop? They're 
                much easier to earn with full QR points! 🌿
              </Text>
            </View>
            
            <View style={styles.infoBox}>
              <Icon name="info" type="material" size={20} color="#4CAF50" />
              <Text style={styles.infoText}>
                We use QR codes to collect valuable data that helps us improve the app experience for everyone! 
                Full points for QR scans, half points for skipping.
              </Text>
            </View>
          </>
        ) : (
          // Vendor without QR code option
          <Button
            title="I'm Here"
            icon={{
              name: "place",
              type: "material",
              size: 20,
              color: "white"
            }}
            onPress={() => handleManualCheckin(false)}
            buttonStyle={styles.imHereButton}
            containerStyle={styles.buttonContainer}
          />
        )}
      </View>
    );
  };

  // Activate the QR scanner
  const activateScanner = () => {
    setShowScanner(true);
  };
  
  if (hasPermission === null && !vendorId) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }
  
  if (hasPermission === false && !vendorId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContainer}>
          <Icon name="camera-off" type="material" size={64} color="#F44336" />
          <Text style={styles.permissionText}>
            Camera permission is required to scan check-in QR codes.
          </Text>
          <Button
            title="Grant Permission"
            onPress={() => Linking.openSettings()}
            buttonStyle={styles.permissionButton}
            containerStyle={styles.buttonContainer}
          />
          <Button
            title="Go Back"
            type="outline"
            onPress={handleCancel}
            containerStyle={styles.buttonContainer}
          />
        </View>
      </SafeAreaView>
    );
  }
  
  if (scannedVendor) {
    // Show check-in confirmation or options
    return (
      <SafeAreaView style={styles.container}>
        {showScanner ? (
          // Show QR scanner
          <View style={styles.scannerContainer}>
            {typeof Camera === 'function' ? (
              <Camera
                style={styles.scanner}
                onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                type={CameraConstants.Type.back}
                flashMode={torchOn ? CameraConstants.FlashMode.torch : CameraConstants.FlashMode.off}
              >
                <View style={styles.overlay}>
                  <View style={styles.unfilled} />
                  <View style={styles.row}>
                    <View style={styles.unfilled} />
                    <View style={styles.scanner} />
                    <View style={styles.unfilled} />
                  </View>
                  <View style={styles.unfilled} />
                </View>
                
                <View style={styles.instructionsContainer}>
                  <Text style={styles.instructionsText}>
                    Scan the QR code at {scannedVendor.name} to check in
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.torchButton}
                  onPress={toggleTorch}
                >
                  <Icon 
                    name={torchOn ? "flash-on" : "flash-off"} 
                    type="material" 
                    color="#FFFFFF" 
                    size={24} 
                  />
                </TouchableOpacity>
                
                <Button
                  title="Cancel"
                  onPress={() => setShowScanner(false)}
                  buttonStyle={styles.cancelButton}
                  containerStyle={styles.cancelButtonContainer}
                />
              </Camera>
            ) : (
              // Fallback when Camera is not a valid component
              <View style={styles.scanner}>
                <View style={styles.mockScannerContainer}>
                  <Text style={styles.mockTitle}>Camera Not Available</Text>
                  <Text style={styles.cameraPlaceholder}>
                    Camera functionality is not available on this device or in this environment.
                  </Text>
                  <Button
                    title="Cancel"
                    onPress={() => setShowScanner(false)}
                    buttonStyle={styles.cancelButton}
                    containerStyle={styles.buttonContainer}
                  />
                </View>
              </View>
            )}
          </View>
        ) : (
          // Show check-in options
          <View style={styles.confirmContainer}>
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
                  "Check In without QR (Half Points)" : 
                  "Check In"}
                icon={{
                  name: "eco",
                  type: "material",
                  size: 20,
                  color: scannedVendor.hasQrCode ? "#666" : "white"
                }}
                type={scannedVendor.hasQrCode ? "outline" : "solid"}
                onPress={() => handleManualCheckin(scannedVendor.hasQrCode)}
                buttonStyle={scannedVendor.hasQrCode ? styles.skipQrButton : styles.confirmButton}
                containerStyle={styles.buttonContainer}
                titleStyle={scannedVendor.hasQrCode ? { color: '#666' } : undefined}
              />
            </View>

            {/* Only show QR info message if vendor has QR capability */}
            {scannedVendor.hasQrCode && (
              <View style={styles.qrInfoContainer}>
                <Icon name="emoji-emotions" type="material" color="#4CAF50" size={20} />
                <Text style={styles.qrInfoText}>
                  Full points for scanning QR, half points for skipping it. QR scans help us improve the app experience for everyone!
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
          </View>
        )}
      </SafeAreaView>
    );
  }
  
  // Show QR scanner
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.scannerContainer}>
        {hasPermission && !scannedVendor && (
          <View style={styles.scannerContainer}>
            {__DEV__ || !Camera ? (
              // Development mockup or fallback if Camera is not available
              <View style={styles.mockScannerContainer}>
                <Text style={styles.mockTitle}>QR Scanner (Dev Mode)</Text>
                
                <Button
                  title="Simulate Scan for vendor 1"
                  onPress={() => handleBarCodeScanned({ 
                    type: 'QR', 
                    data: 'lootsganja://checkin/v1' 
                  })}
                  buttonStyle={styles.scanButton}
                  containerStyle={styles.buttonContainer}
                />
                
                <Button
                  title="Simulate Scan for vendor 2"
                  onPress={() => handleBarCodeScanned({ 
                    type: 'QR', 
                    data: 'lootsganja://checkin/v2' 
                  })}
                  buttonStyle={styles.scanButton}
                  containerStyle={styles.buttonContainer}
                />
                
                <Button
                  title="Cancel"
                  type="outline"
                  onPress={handleCancel}
                  containerStyle={styles.buttonContainer}
                />
              </View>
            ) : (
              // Production camera implementation using our safe CameraConstants
              <View style={styles.scanner}>
                {/* This is a safer way to render the Camera */}
                <Camera
                  style={StyleSheet.absoluteFill}
                  onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                  // Use our safe CameraConstants instead of direct Camera.Constants
                  type={CameraConstants.Type.back}
                  flashMode={torchOn ? CameraConstants.FlashMode.torch : CameraConstants.FlashMode.off}
                >
                  <View style={styles.overlay}>
                    <View style={styles.unfilled} />
                    <View style={styles.row}>
                      <View style={styles.unfilled} />
                      <View style={styles.scanner} />
                      <View style={styles.unfilled} />
                    </View>
                    <View style={styles.unfilled} />
                  </View>
                  
                  <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsText}>
                      Scan the QR code at the dispensary to check in
                    </Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.torchButton}
                    onPress={toggleTorch}
                  >
                    <Icon 
                      name={torchOn ? "flash-on" : "flash-off"} 
                      type="material" 
                      color="#FFFFFF" 
                      size={24} 
                    />
                  </TouchableOpacity>
                  
                  <Button
                    title="Cancel"
                    onPress={handleCancel}
                    buttonStyle={styles.cancelButton}
                    containerStyle={styles.cancelButtonContainer}
                  />
                </Camera>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
  permissionButton: {
    backgroundColor: '#4CAF50',
  },
  buttonContainer: {
    width: '80%',
    marginBottom: 20,
  },
  scannerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanner: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0)',
  },
  unfilled: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  row: {
    flexDirection: 'row',
    height: 300,
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 150,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  torchButton: {
    position: 'absolute',
    top: 80,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanAgainButton: {
    backgroundColor: '#4CAF50',
  },
  scanAgainButtonContainer: {
    position: 'absolute',
    bottom: 100,
  },
  cancelButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cancelButtonContainer: {
    position: 'absolute',
    bottom: 40,
    width: 120,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  confirmContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
    color: '#4CAF50',
  },
  confirmMessage: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 20,
  },
  confirmVendor: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmAddress: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 20,
  },
  rewardText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  shareButton: {
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  checkinOptionsContainer: {
    marginBottom: 20,
    width: '100%',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F1F8E9', 
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#4CAF50',
    lineHeight: 20,
  },
  scanQrButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  skipQrButton: {
    borderColor: '#666',
    borderRadius: 8,
    paddingVertical: 12,
  },
  imHereButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  qrInfoContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F8E9',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    width: '80%',
    alignItems: 'flex-start',
  },
  qrInfoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#4CAF50',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    borderRadius: 10,
    padding: 20,
    margin: 0,
  },
  modalIcon: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
    lineHeight: 22,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButtonContainer: {
    width: '48%',
  },
  modalCancelButton: {
    borderColor: '#999',
  },
  modalConfirmButton: {
    backgroundColor: '#4CAF50',
  },
  buttonsContainer: {
    width: '80%',
    marginTop: 20,
    marginBottom: 15,
    gap: 15, // Adds space between buttons
  },
  devModeButton: {
    position: 'absolute',
    top: 80,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockScannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mockTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 30,
  },
  scanButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 40,
  },
  cameraPlaceholder: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  simulateScanButton: {
    backgroundColor: '#4CAF50',
    marginBottom: 10,
  },
  mockInputContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    marginBottom: 20,
  },
  vendorPicker: {
    height: 50,
    width: '100%',
    color: 'white',
    marginTop: 10,
  },
  mockNote: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 20,
  },
});

export default VendorCheckin;