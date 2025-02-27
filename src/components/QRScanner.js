// src/components/QRScanner.js
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Alert,
  Dimensions,
  Platform,
  Linking
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';
import { Icon } from '@rneui/themed';
import { Logger, LogCategory } from '../services/LoggingService';
import { tryCatch } from '../utils/ErrorHandler';

const { width } = Dimensions.get('window');
const scannerSize = width * 0.7;

/**
 * QR Code Scanner Component
 * 
 * Provides a camera view with QR code scanning functionality
 * Designed specifically for vendor check-ins
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onScan - Callback for successful scans with scanned data
 * @param {Function} props.onClose - Callback when user closes the scanner
 * @param {string} props.urlPrefix - Expected URL prefix for valid QR codes
 * @param {boolean} props.vibrate - Whether to vibrate on scan (default: true)
 * @param {boolean} props.showGalleryOption - Whether to show option to scan from gallery
 */
const QRScanner = ({ 
  onScan, 
  onClose, 
  urlPrefix = 'lootsganja://',
  vibrate = true,
  showGalleryOption = false
}) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanning, setScanning] = useState(true);
  
  // Request camera permission on mount
  useEffect(() => {
    const requestPermissions = async () => {
      await tryCatch(async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
        
        Logger.info(LogCategory.PERMISSIONS, 'Camera permission request', {
          granted: status === 'granted'
        });
      }, LogCategory.PERMISSIONS, 'requesting camera permission', false);
    };
    
    requestPermissions();
    
    // Clean up on unmount
    return () => {
      setScanning(false);
    };
  }, []);
  
  // Handle barcode scanning
  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned || !scanning) return;
    
    // Set scanned to prevent multiple scans
    setScanned(true);
    
    // Vibrate device if enabled
    if (vibrate && Platform.OS !== 'web') {
      try {
        // This would normally use Haptics from expo, but we'll import dynamically to avoid
        // unnecessary dependencies in the example
        const Haptics = require('expo-haptics');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        // Ignore Haptics errors
      }
    }
    
    // Validate QR code format
    if (data.startsWith(urlPrefix)) {
      // Extract vendor ID or other data
      // For vendor check-ins, format might be: lootsganja://checkin/{vendorId}
      const payload = data.replace(urlPrefix, '');
      
      Logger.info(LogCategory.CHECKIN, 'Valid QR code scanned', {
        type,
        payload,
        hasPrefix: true
      });
      
      // Call onScan with the extracted data
      if (onScan) {
        onScan(payload);
      }
    } else {
      // Invalid QR code format
      Logger.warn(LogCategory.CHECKIN, 'Invalid QR code scanned', {
        type,
        data,
        expectedPrefix: urlPrefix
      });
      
      Alert.alert(
        'Invalid QR Code',
        'This doesn\'t appear to be a valid Loot\'s Ganja Guide check-in code.',
        [
          { 
            text: 'Try Again', 
            onPress: () => setScanned(false) 
          }
        ]
      );
    }
  };
  
  // Toggle flashlight/torch
  const toggleTorch = () => {
    setTorchOn(!torchOn);
  };
  
  // Reset scanner to scan again
  const handleScanAgain = () => {
    setScanned(false);
  };
  
  // Open settings if permission was denied
  const openSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error opening settings', { error });
      Alert.alert(
        'Error',
        'Could not open settings. Please manually open your device settings and grant camera permission.'
      );
    }
  };
  
  // Handle permission denied
  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Icon name="camera-off" type="material" size={64} color="#F44336" />
        <Text style={styles.permissionText}>
          Camera permission is required to scan check-in QR codes.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={openSettings}>
          <Text style={styles.permissionButtonText}>Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Handle loading/requesting permission
  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <Icon name="camera" type="material" size={64} color="#4CAF50" />
        <Text style={styles.permissionText}>
          Requesting camera permission...
        </Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Camera
        style={styles.camera}
        type={Camera.Constants.Type.back}
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        flashMode={
          torchOn 
            ? Camera.Constants.FlashMode.torch 
            : Camera.Constants.FlashMode.off
        }
      >
        <View style={styles.overlay}>
          {/* Dark overlay with transparent scanner area */}
          <View style={styles.overlayRow}>
            <View style={styles.overlaySection} />
            <View style={[styles.scannerOutline, { height: scannerSize, width: scannerSize }]}>
              {/* Scanner corners - top left */}
              <View style={[styles.scannerCorner, styles.topLeftCorner]} />
              {/* Scanner corners - top right */}
              <View style={[styles.scannerCorner, styles.topRightCorner]} />
              {/* Scanner corners - bottom left */}
              <View style={[styles.scannerCorner, styles.bottomLeftCorner]} />
              {/* Scanner corners - bottom right */}
              <View style={[styles.scannerCorner, styles.bottomRightCorner]} />
            </View>
            <View style={styles.overlaySection} />
          </View>
          
          <View style={styles.overlayRow}>
            <View style={styles.overlaySection} />
            <View style={{ width: scannerSize }} />
            <View style={styles.overlaySection} />
          </View>
          
          <View style={styles.overlayRow}>
            <View style={styles.overlaySection} />
            <View style={{ width: scannerSize }} />
            <View style={styles.overlaySection} />
          </View>
          
          {/* Scan instruction */}
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>
              Align QR code within the square
            </Text>
          </View>
          
          {/* Control buttons */}
          <View style={styles.controlsContainer}>
            {/* Torch toggle */}
            <TouchableOpacity style={styles.iconButton} onPress={toggleTorch}>
              <Icon
                name={torchOn ? 'flash-on' : 'flash-off'}
                type="material"
                color="#FFFFFF"
                size={28}
              />
            </TouchableOpacity>
            
            {/* Scan again button (when already scanned) */}
            {scanned && (
              <TouchableOpacity style={styles.scanAgainButton} onPress={handleScanAgain}>
                <Text style={styles.scanAgainText}>Tap to Scan Again</Text>
              </TouchableOpacity>
            )}
            
            {/* Gallery import option */}
            {showGalleryOption && (
              <TouchableOpacity style={styles.iconButton} onPress={() => {
                Alert.alert(
                  'Feature Coming Soon',
                  'Scanning QR codes from gallery images will be available in a future update.'
                );
              }}>
                <Icon
                  name="photo-library"
                  type="material"
                  color="#FFFFFF"
                  size={28}
                />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Close button */}
          <TouchableOpacity style={styles.closeContainer} onPress={onClose}>
            <Icon name="close" type="material" color="#FFFFFF" size={28} />
          </TouchableOpacity>
        </View>
      </Camera>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlayRow: {
    flex: 1,
    flexDirection: 'row',
  },
  overlaySection: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerOutline: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  scannerCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFFFFF',
  },
  topLeftCorner: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRightCorner: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeftCorner: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRightCorner: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 150,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 30,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanAgainButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scanAgainText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  closeContainer: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  closeButtonText: {
    color: '#FFFFFF',
  },
});

export default QRScanner;