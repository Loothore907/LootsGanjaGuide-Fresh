// src/screens/auth/DeviceAuth.js
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button } from '@rneui/themed';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAppState, AppActions } from '../../context/AppStateContext';

const DeviceAuth = ({ navigation }) => {
  const { dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);

  const checkBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // If no biometrics, fall back to device passcode
        return authenticateWithFallback();
      }

      return authenticateWithBiometrics();
    } catch (error) {
      console.error('Biometrics check failed:', error);
      Alert.alert('Error', 'Unable to verify device authentication capabilities');
    }
  };

  const authenticateWithBiometrics = async () => {
    try {
      setIsLoading(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Loot',
        fallbackLabel: 'Use device passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        handleSuccessfulAuth();
      } else {
        Alert.alert('Authentication Failed', 'Please try again');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      Alert.alert('Error', 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const authenticateWithFallback = async () => {
    try {
      setIsLoading(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Please enter your device passcode',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        handleSuccessfulAuth();
      } else {
        Alert.alert('Authentication Failed', 'Please try again');
      }
    } catch (error) {
      console.error('Fallback authentication error:', error);
      Alert.alert('Error', 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessfulAuth = () => {
    dispatch(AppActions.setUserAuth(true));
    // Navigation will be handled by App.js based on auth state
  };

  useEffect(() => {
    checkBiometrics();
  }, []);

  return (
    <View style={styles.container}>
      <Text h3 style={styles.title}>Welcome to Loot</Text>
      <Text style={styles.subtitle}>Please authenticate to continue</Text>
      <Button
        title="Authenticate"
        onPress={checkBiometrics}
        loading={isLoading}
        disabled={isLoading}
        containerStyle={styles.buttonContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '80%',
    marginTop: 20,
  },
});

export default DeviceAuth;