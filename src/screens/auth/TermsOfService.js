// src/screens/auth/TermsOfService.js
import React, { useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Text, Button, CheckBox } from '@rneui/themed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import { useAppState, AppActions } from '../../context/AppStateContext';

const TermsOfService = ({ navigation }) => {
  const { dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);
  const [acceptedDataCollection, setAcceptedDataCollection] = useState(false);
  const scrollViewRef = useRef(null);
  
  const handleAccept = async () => {
    if (!acceptedTerms || !acceptedPrivacyPolicy || !acceptedDataCollection) {
      Alert.alert(
        'Agreement Required',
        'Please accept all terms to continue using Loot\'s Ganja Guide.',
        [{ text: 'OK' }]
      );
      return;
    }
    
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
        
        Logger.info(LogCategory.AUTH, 'User accepted terms of service and privacy policy', {
          timestamp
        });
        
        // Continue to username setup
        navigation.navigate('UserSetup');
      }, LogCategory.AUTH, 'terms of service acceptance', true);
    } catch (error) {
      // Error is already logged by tryCatch
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDecline = () => {
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

  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };

  return (
    <View style={styles.container}>
      <Text h3 style={styles.title}>Terms of Service</Text>
      
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
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

        <Text style={styles.paragraph} onPress={scrollToBottom}>
          <Text style={[styles.link, styles.bold]}>Continue reading...</Text>
        </Text>
      </ScrollView>
      
      <View style={styles.checkboxContainer}>
        <CheckBox
          title="I accept the Terms of Service"
          checked={acceptedTerms}
          onPress={() => setAcceptedTerms(!acceptedTerms)}
          containerStyle={styles.checkbox}
        />
        
        <CheckBox
          title="I accept the Privacy Policy"
          checked={acceptedPrivacyPolicy}
          onPress={() => setAcceptedPrivacyPolicy(!acceptedPrivacyPolicy)}
          containerStyle={styles.checkbox}
        />
        
        <CheckBox
          title="I consent to the collection and use of my data as described"
          checked={acceptedDataCollection}
          onPress={() => setAcceptedDataCollection(!acceptedDataCollection)}
          containerStyle={styles.checkbox}
        />
      </View>
      
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
          disabled={isLoading || !acceptedTerms || !acceptedPrivacyPolicy || !acceptedDataCollection}
          containerStyle={styles.button}
        />
      </View>
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
    paddingBottom: 20,
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
  checkboxContainer: {
    marginBottom: 20,
  },
  checkbox: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    marginLeft: 0,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
});

export default TermsOfService;