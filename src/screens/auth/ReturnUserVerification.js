// src/screens/auth/ReturnUserVerification.js
import React, { useState } from 'react';
import { View, StyleSheet, Image, BackHandler, Platform, Alert } from 'react-native';
import { Text, Button } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from '../../services/LoggingService';
import { tryCatch } from '../../utils/ErrorHandler';
import firebaseAuthAdapter from '../../services/adapters/FirebaseAuthAdapter';

const ReturnUserVerification = ({ navigation, route }) => {
  const { dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  const { username } = route.params;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await tryCatch(async () => {
        // Authenticate with Firebase for returning user
        try {
          const authResult = await firebaseAuthAdapter.signInReturningUser(username);
          
          if (authResult.success) {
            Logger.info(LogCategory.AUTH, 'Firebase authentication successful for returning user', { 
              uid: authResult.user.uid,
              username
            });
          }
        } catch (fbError) {
          // Log the error but continue - we don't want to block the user
          // from using the app if Firebase auth fails
          Logger.error(LogCategory.AUTH, 'Firebase authentication failed for returning user, continuing with local auth', { 
            error: fbError,
            username
          });
        }
        
        // Log that the user confirmed age
        Logger.info(LogCategory.AUTH, 'Returning user confirmed age verification', { username });
        
        // Navigate to main dashboard
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }, LogCategory.AUTH, 'returning user verification', true);
    } catch (error) {
      // Error is already logged by tryCatch
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeny = () => {
    Alert.alert(
      'Age Restriction',
      'You must be 21 or older to use this application. Would you like to clear your data and start over?',
      [
        { 
          text: 'Cancel',
          style: 'cancel'
        },
        { 
          text: 'Clear & Restart', 
          style: 'destructive',
          onPress: async () => {
            // Sign out from Firebase if authenticated
            try {
              await firebaseAuthAdapter.signOut();
            } catch (error) {
              Logger.error(LogCategory.AUTH, 'Error signing out from Firebase', { error });
              // Continue with clearing local data regardless of Firebase sign out result
            }
            
            // Clear user data
            AsyncStorage.multiRemove([
              'isAgeVerified', 
              'tosAccepted', 
              'username',
              'ageVerificationDate',
              'tosAcceptedDate'
            ]).then(() => {
              Logger.info(LogCategory.AUTH, 'User session cleared due to age verification denial');
              
              // Navigate back to initial verification
              navigation.reset({
                index: 0,
                routes: [{ name: 'AgeVerification' }],
              });
            });
          }
        }
      ],
      { cancelable: true }
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
        
        <Text h3 style={styles.title}>Welcome Back!</Text>
        
        <Text style={styles.welcomeText}>
          Welcome back, <Text style={styles.username}>{username}</Text>
        </Text>
        
        <Text style={styles.question}>
          Please confirm you are still 21 years of age or older to continue.
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="Yes, I am 21+"
            onPress={handleConfirm}
            loading={isLoading}
            disabled={isLoading}
            containerStyle={styles.button}
            buttonStyle={styles.confirmButton}
          />
          
          <Button
            title="No, I am under 21 / Not me"
            onPress={handleDeny}
            disabled={isLoading}
            containerStyle={styles.button}
            buttonStyle={styles.denyButton}
            titleStyle={styles.denyButtonText}
            type="outline"
          />
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
    width: 150,
    height: 150,
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
    marginBottom: 16,
  },
  username: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  question: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
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
});

export default ReturnUserVerification;