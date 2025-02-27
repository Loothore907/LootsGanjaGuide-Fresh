// src/screens/auth/AgeVerification.js
import React, { useState } from 'react';
import { View, StyleSheet, Image, BackHandler, Platform, Alert } from 'react-native';
import { Text, Button } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';

const AgeVerification = ({ navigation }) => {
  const { dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);

  // Function to handle user confirming they are 21+
  const handleConfirmAge = async () => {
    setIsLoading(true);
    try {
      await tryCatch(async () => {
        // Store verification in AsyncStorage
        await AsyncStorage.setItem('isAgeVerified', 'true');
        
        // Set today's date as verification date
        const verificationDate = new Date().toISOString();
        await AsyncStorage.setItem('ageVerificationDate', verificationDate);
        
        // Update global state
        dispatch(AppActions.setAgeVerification(true));
        
        Logger.info(LogCategory.AUTH, 'User confirmed 21+ age verification');
        
        // Navigate to Terms of Service screen (add this)
        navigation.replace('TermsOfService');
      }, LogCategory.AUTH, 'age verification confirmation', true);
    } catch (error) {
      // Error is already logged by tryCatch
      // Just reset loading state
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle user denying they are 21+
  const handleDenyAge = () => {
    Logger.info(LogCategory.AUTH, 'User denied 21+ age verification, closing app');
    
    // Show message and exit app
    Alert.alert(
      'Age Restriction',
      'You must be 21 or older to use this application. The app will now close.',
      [
        { 
          text: 'OK', 
          onPress: () => {
            // Exit the app
            if (Platform.OS === 'android') {
              BackHandler.exitApp();
            } else {
              // On iOS we can't force close, so just show another message
              Alert.alert(
                'Please close the app',
                'This app is only for users 21 and older.'
              );
            }
          }
        }
      ],
      { cancelable: false }
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <Image 
          source={require('../../../assets/images/logo.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        
        <Text h3 style={styles.title}>Age Verification</Text>
        
        <Text style={styles.description}>
          Loot's Ganja Guide is only available to adults 21 years of age or older.
        </Text>
        
        <Text style={styles.question}>
          Are you 21 years of age or older?
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="Yes, I am 21+"
            onPress={handleConfirmAge}
            loading={isLoading}
            disabled={isLoading}
            containerStyle={styles.button}
            buttonStyle={styles.confirmButton}
          />
          
          <Button
            title="No, I am under 21"
            onPress={handleDenyAge}
            disabled={isLoading}
            containerStyle={styles.button}
            buttonStyle={styles.denyButton}
            titleStyle={styles.denyButtonText}
            type="outline"
          />
        </View>
        
        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimer}>
            By selecting "Yes", you confirm that you are of legal age to use cannabis
            products in your jurisdiction and agree to our Terms of Service.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  question: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  button: {
    width: '100%',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
  },
  denyButton: {
    borderColor: '#F44336',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 8,
  },
  denyButtonText: {
    color: '#F44336',
  },
  disclaimerContainer: {
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginTop: 16,
  },
  disclaimer: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default AgeVerification;