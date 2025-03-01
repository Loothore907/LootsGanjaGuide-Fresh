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
  TouchableOpacity
} from 'react-native';
import { 
  Text, 
  Button, 
  Icon
} from '@rneui/themed';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import { checkInAtVendor, getVendorById } from '../../services/MockDataService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import redemptionService from '../../services/RedemptionService';
import locationService from '../../services/LocationService';

const VendorCheckin = ({ route, navigation }) => {
  const { state, dispatch } = useAppState();
  const { vendorId, fromJourney } = route.params || {};
  
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scannedVendor, setScannedVendor] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  // Request camera permissions and check if direct vendor ID was provided
  useEffect(() => {
    let isMounted = true;
    
    const setupCamera = async () => {
      if (vendorId) {
        // Skip QR scan if we already have a vendor ID
        handleDirectCheckin(vendorId);
      } else {
        try {
          // Request camera permission
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
  
  const handleDirectCheckin = async (id) => {
    setIsLoading(true);
    try {
      await tryCatch(async () => {
        // Get vendor information
        const vendor = await getVendorById(id);
        setScannedVendor(vendor);
        
        // Process check-in (will happen when user confirms)
        Logger.info(LogCategory.CHECKIN, 'Direct check-in initiated', { vendorId: id });
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
  
  const handleConfirmCheckin = async () => {
    if (!scannedVendor) return;
    
    setIsLoading(true);
    try {
      await tryCatch(async () => {
        // Process check-in
        const result = await checkInAtVendor(scannedVendor.id);
        
        // Record the deal redemption
        await redemptionService.recordRedemption(
          scannedVendor.id, 
          state.journey.dealType,
          `${state.journey.dealType}-${scannedVendor.id}`
        );
        
        // Update points
        dispatch(AppActions.updatePoints(result.pointsEarned));
        
        // Update journey state to mark vendor as checked in
        if (state.journey && state.journey.isActive) {
          const currentVendorIndex = state.journey.currentVendorIndex;
          if (currentVendorIndex >= 0 && currentVendorIndex < state.journey.vendors.length) {
            // Mark the current vendor as checked in with 'qr' type
            dispatch(AppActions.markVendorCheckedIn(currentVendorIndex, 'qr'));
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
      
      if (isLastVendor) {
        // This is the last vendor, complete the journey
        // Create a complete journey data object to pass
        const completeJourneyData = {
          journeyType: state.journey.dealType,
          vendors: state.journey.vendors,
          currentVendorIndex: state.journey.currentVendorIndex,
          totalVendors: state.journey.totalVendors,
          totalDistance: state.route.totalDistance
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
                name: "cannabis",
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
                We use QR codes to collect valuable data that helps us improve the app! 
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

  // Handle manual check-in with parameter to indicate if it's a QR skip
  const handleManualCheckin = async (isQrSkip) => {
    // Verify user is at the location using GPS
    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      // Calculate distance to vendor
      const vendorCoords = scannedVendor.location.coordinates;
      const distance = locationService.calculateDistance(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        vendorCoords.latitude,
        vendorCoords.longitude
      );
      
      // If close enough (within 100 meters), allow check-in
      if (distance <= 0.062) { // ~100 meters in miles
        // Determine points based on check-in type
        let pointsValue = 10; // Default points for QR or non-QR vendor
        let checkInType = 'manual';
        
        if (scannedVendor.hasQrCode && isQrSkip) {
          pointsValue = 5; // Half points for skipping QR at a QR-enabled vendor
          checkInType = 'qr_skipped';
        }
        
        // Process the check-in
        await processCheckin(pointsValue, checkInType);
      } else {
        // Too far away
        Alert.alert(
          'Too Far Away',
          `You appear to be ${distance.toFixed(2)} miles from ${scannedVendor.name}. Please get closer to check in.`
        );
      }
    } catch (error) {
      Logger.error(LogCategory.LOCATION, 'Error getting location for manual check-in', { error });
      Alert.alert('Error', 'Could not verify your location. Please try again.');
    }
  };

  // Process check-in with points and type
  const processCheckin = async (pointsValue, checkInType) => {
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
            <Camera
              style={styles.scanner}
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              type={1}
              flashMode={torchOn ? 1 : 0}
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
            
            {/* Render check-in options based on vendor capabilities */}
            {renderCheckinOptions()}
            
            <Button
              title="Cancel"
              type="clear"
              onPress={handleCancel}
              containerStyle={styles.buttonContainer}
            />
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
    <Camera
      style={styles.scanner}
      onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
      type={1} // Use direct integer value instead of Constants
      flashMode={torchOn ? 1 : 0} // Use direct integer values
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
      
      {scanned && !isLoading && (
        <Button
          title="Tap to Scan Again"
          onPress={() => setScanned(false)}
          buttonStyle={styles.scanAgainButton}
          containerStyle={styles.scanAgainButtonContainer}
        />
      )}
      
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
      
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
    marginTop: 20,
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
    borderColor: '#9E9E9E',
    borderRadius: 8,
    paddingVertical: 12,
  },
  imHereButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  qrInfoContainer: {
    backgroundColor: '#F1F8E9',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  qrInfoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#4CAF50',
    lineHeight: 20,
  },
});

export default VendorCheckin;
