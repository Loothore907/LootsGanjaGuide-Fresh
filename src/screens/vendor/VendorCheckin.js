// src/screens/vendor/VendorCheckin.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert,
  Linking,
  ActivityIndicator
} from 'react-native';
import { 
  Text, 
  Button, 
  Icon
} from '@rneui/themed';
import * as ExpoBarCodeScanner from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import { checkInAtVendor, getVendorById } from '../../services/MockDataService';

const VendorCheckin = ({ route, navigation }) => {
  const { state, dispatch } = useAppState();
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scannedVendor, setScannedVendor] = useState(null);
  
  // Get vendorId from route params if exists (for direct check-in)
  const vendorId = route.params?.vendorId;
  
  // Request camera permissions and check if direct vendor ID was provided
  useEffect(() => {
    (async () => {
      if (vendorId) {
        // Skip QR scan if we already have a vendor ID
        handleDirectCheckin(vendorId);
      } else {
        // Request camera permission
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
        
        if (status !== 'granted') {
          Logger.warn(LogCategory.PERMISSIONS, 'Camera permission was denied');
        }
      }
    })();
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
        
        // Update points
        dispatch(AppActions.updatePoints(result.pointsEarned));
        
        // Add to recent visits
        const visit = {
          vendorId: scannedVendor.id,
          vendorName: scannedVendor.name,
          lastVisit: new Date().toISOString(),
          visitCount: 1
        };
        dispatch(AppActions.addRecentVisit(visit));
        
        // Show success message
        Alert.alert(
          'Check-in Successful!',
          `You have earned ${result.pointsEarned} points for checking in at ${scannedVendor.name}.`,
          [
            { 
              text: 'Share',
              onPress: () => handleShareCheckin() 
            },
            {
              text: 'OK',
              onPress: () => navigation.navigate('VendorProfile', { vendorId: scannedVendor.id })
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
  
  const handleShareCheckin = () => {
    // In a real app, this would integrate with social media
    Alert.alert(
      'Social Share',
      'This feature will allow you to share your check-in on social media. It is currently under development.'
    );
  };
  
  const handleCancel = () => {
    navigation.goBack();
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
    // Show check-in confirmation
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.confirmContainer}>
          <Icon name="check-circle" type="material" size={64} color="#4CAF50" />
          <Text style={styles.confirmTitle}>Ready to Check In</Text>
          <Text style={styles.confirmVendor}>{scannedVendor.name}</Text>
          <Text style={styles.confirmAddress}>{scannedVendor.location.address}</Text>
          
          <View style={styles.rewardContainer}>
            <Icon name="loyalty" type="material" size={24} color="#4CAF50" />
            <Text style={styles.rewardText}>You will earn 10 points</Text>
          </View>
          
          <Button
            title="Confirm Check In"
            onPress={handleConfirmCheckin}
            loading={isLoading}
            buttonStyle={styles.confirmButton}
            containerStyle={styles.buttonContainer}
            icon={{
              name: "place",
              type: "material",
              size: 20,
              color: "white"
            }}
          />
          
          <Button
            title="Cancel"
            type="outline"
            onPress={handleCancel}
            containerStyle={styles.buttonContainer}
          />
        </View>
      </SafeAreaView>
    );
  }
  
  // Show QR scanner
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.scannerContainer}>
        <ExpoBarCodeScanner.BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={styles.scanner}
        />
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
    height: 300,
    width: 300,
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
    top: 150,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
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
  },
  confirmVendor: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
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
  },
});

export default VendorCheckin;