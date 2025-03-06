// src/screens/auth/TermsOfService.js
import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator, Platform, BackHandler, Dimensions, TouchableOpacity } from 'react-native';
import { Text, Button } from '@rneui/themed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import { useAppState, AppActions } from '../../context/AppStateContext';
import firebaseAuthAdapter from '../../services/adapters/FirebaseAuthAdapter';

const TermsOfService = ({ navigation, route }) => {
  const { dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollViewRef = useRef(null);
  
  // Check if we're viewing from settings (no need to proceed to next screen)
  const fromSettings = route.params?.fromSettings || false;
  
  // Add a scrollPosition state to track scroll position
  const [scrollPosition, setScrollPosition] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  
  // Detect when scroll reaches the bottom
  useEffect(() => {
    // Check if we've scrolled far enough to be at the bottom
    if (contentHeight > 0 && containerHeight > 0) {
      // Need to account for some padding at the bottom
      const isAtBottom = scrollPosition + containerHeight >= contentHeight - 20;
      
      if (isAtBottom && !hasScrolledToBottom) {
        setHasScrolledToBottom(true);
        Logger.debug(LogCategory.UI, 'User scrolled to bottom of Terms of Service');
      }
    }
  }, [scrollPosition, contentHeight, containerHeight, hasScrolledToBottom]);
  
  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await tryCatch(async () => {
        // Store acceptance in AsyncStorage
        const timestamp = new Date().toISOString();
        await AsyncStorage.setItem('tosAccepted', 'true');
        await AsyncStorage.setItem('tosAcceptedDate', timestamp);
        await AsyncStorage.setItem('privacyAccepted', 'true');
        await AsyncStorage.setItem('dataCollectionAccepted', 'true');
        
        // Update global state
        dispatch(AppActions.setTosAccepted(true));
        
        // Update ToS acceptance status in Firebase (if user exists)
        try {
          // Initialize Firebase auth adapter if not already
          if (!firebaseAuthAdapter.isInitialized()) {
            await firebaseAuthAdapter.initialize();
          }
          
          // Update ToS acceptance status (this is a no-op if no Firebase user yet)
          await firebaseAuthAdapter.setTosAccepted(true);
        } catch (fbError) {
          // Log but continue - we'll create the user later in the flow
          Logger.warn(LogCategory.AUTH, 'Firebase ToS acceptance update skipped (no user yet)', { 
            error: fbError 
          });
        }
        
        Logger.info(LogCategory.AUTH, 'User accepted terms of service and privacy policy', {
          timestamp
        });
        
        // If viewing from settings, just go back
        if (fromSettings) {
          navigation.goBack();
        } else {
          // Continue to username setup for new users
          navigation.navigate('UserSetup');
        }
      }, LogCategory.AUTH, 'terms of service acceptance', true);
    } catch (error) {
      // Error is already logged by tryCatch
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDecline = () => {
    // If viewing from settings, just go back
    if (fromSettings) {
      navigation.goBack();
      return;
    }
    
    Alert.alert(
      'Terms Declined',
      'You must accept the Terms of Service to use Loot\'s Ganja Guide. The app will now close.',
      [
        { 
          text: 'OK', 
          onPress: () => {
            if (Platform.OS === 'android') {
              BackHandler.exitApp();
            } else {
              Alert.alert(
                'Please close the app',
                'Please close the app as you have declined the Terms of Service.'
              );
            }
          }
        }
      ],
      { cancelable: false }
    );
  };

  // Handle scroll events
  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setScrollPosition(contentOffset.y);
    setContentHeight(contentSize.height);
    setContainerHeight(layoutMeasurement.height);
  };
  
  // Logging function for debugging
  const logScrollInfo = () => {
    console.log('Scroll info:', {
      position: scrollPosition,
      contentHeight,
      containerHeight,
      isAtBottom: scrollPosition + containerHeight >= contentHeight - 20,
      hasScrolledToBottom
    });
  };

  return (
    <View style={styles.container}>
      <Text h3 style={styles.title}>Terms of Service</Text>
      
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        onScroll={handleScroll}
        scrollEventThrottle={16} // More frequent updates
        onContentSizeChange={(width, height) => setContentHeight(height)}
        onLayout={(event) => setContainerHeight(event.nativeEvent.layout.height)}
      >
        <Text style={styles.sectionHeader}>Terms of Service</Text>
        <Text style={styles.paragraph}>
          Welcome to Loot's Ganja Guide. By using our app, you agree to be bound by the following terms and conditions.
        </Text>
        
        <Text style={styles.paragraph}>
          1. <Text style={styles.bold}>Age Restriction:</Text> You must be 21 years of age or older to use this application. By accepting these terms, you confirm that you are of legal age to use cannabis products in your jurisdiction.
        </Text>
        
        <Text style={styles.paragraph}>
          2. <Text style={styles.bold}>User Account:</Text> You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.
        </Text>
        
        <Text style={styles.paragraph}>
          3. <Text style={styles.bold}>Acceptable Use:</Text> You agree to use the app only for lawful purposes and in accordance with these Terms. You agree not to use the app:
          {'\n'}• In any way that violates any applicable federal, state, local, or international law or regulation
          {'\n'}• To impersonate or attempt to impersonate the Company, a Company employee, another user, or any other person or entity
          {'\n'}• To engage in any other conduct that restricts or inhibits anyone's use or enjoyment of the app
        </Text>
        
        <Text style={styles.paragraph}>
          4. <Text style={styles.bold}>Location Services:</Text> Our app collects and uses location data to provide functionalities such as finding nearby dispensaries and navigating to locations. You can disable location services through your device settings, but this may limit app functionality.
        </Text>

        <Text style={styles.sectionHeader}>Privacy Policy</Text>
        <Text style={styles.paragraph}>
          Our Privacy Policy describes how we collect, use, and share your personal information. By using Loot's Ganja Guide, you agree to our collection and use of information in accordance with this policy.
        </Text>
        
        <Text style={styles.paragraph}>
          We collect the following types of information:
          {'\n'}• User profile information (username, age verification)
          {'\n'}• Device information (device type, operating system)
          {'\n'}• Location data (when you use our app with location services enabled)
          {'\n'}• Usage information (interactions with dispensaries, deal preferences)
        </Text>
        
        <Text style={styles.paragraph}>
          We use this information to:
          {'\n'}• Provide, maintain, and improve our services
          {'\n'}• Develop new features and offerings
          {'\n'}• Understand user preferences and optimize user experience
          {'\n'}• Communicate with you about your account and our services
        </Text>
        
        <Text style={styles.paragraph}>
          We may share information with:
          {'\n'}• Dispensary partners (only when you check in or interact with them)
          {'\n'}• Service providers who perform services on our behalf
          {'\n'}• Law enforcement if required by law
        </Text>
        
        <Text style={styles.paragraph}>
          You have rights regarding your data, including:
          {'\n'}• Accessing your data
          {'\n'}• Correcting inaccurate data
          {'\n'}• Deleting your data
          {'\n'}• Restricting or objecting to certain processing
        </Text>

        <Text style={styles.paragraph}>
          By accepting these terms, you acknowledge that you have read and understood our Terms of Service and Privacy Policy, and you consent to the collection and use of your data as described.
        </Text>
        
        <Text style={styles.paragraph}>
          If you have any questions about our Terms of Service or Privacy Policy, please contact us.
        </Text>
        
        {/* Simple end marker - no interactive elements */}
        <View style={styles.endOfTerms}>
          <Text style={styles.endOfTermsText}>End of Terms</Text>
        </View>
      </ScrollView>
      
      <View style={styles.buttonsContainer}>
        <Button
          title="Decline"
          type="outline"
          onPress={handleDecline}
          containerStyle={styles.button}
        />
        
        <Button
          title="Accept"
          onPress={handleAccept}
          loading={isLoading}
          disabled={isLoading || (!fromSettings && !hasScrolledToBottom)}
          containerStyle={styles.button}
        />
      </View>
      
      {!hasScrolledToBottom && !fromSettings && (
        <Text style={styles.scrollHint}>
          Please scroll down to review the entire document
        </Text>
      )}
      
      {/* Debug button - remove in production */}
      {__DEV__ && (
        <TouchableOpacity 
          style={styles.debugButton} 
          onPress={logScrollInfo}
        >
          <Text style={styles.debugButtonText}>Debug Scroll</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
    marginBottom: 20,
  },
  scrollViewContent: {
    paddingBottom: 60, // Added extra padding to ensure there's room to scroll
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
  },
  link: {
    color: '#2089dc',
    textDecorationLine: 'underline',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
  scrollHint: {
    textAlign: 'center',
    color: '#888',
    fontSize: 12,
    marginBottom: 10,
  },
  endOfTerms: {
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  endOfTermsText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Debug styles - remove in production
  debugButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 5,
    borderRadius: 5,
  },
  debugButtonText: {
    color: 'white',
    fontSize: 10,
  }
});

export default TermsOfService;