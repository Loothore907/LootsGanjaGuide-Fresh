// src/components/DevTools.js
import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Button, TextInput, Modal } from 'react-native';
import { Icon } from '@rneui/themed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Logger, LogCategory } from '../services/LoggingService';
import { tryCatch } from '../utils/ErrorHandler';
import serviceProvider from '../services/ServiceProvider';
import appInitializer from '../utils/AppInitializer';
import redemptionService from '../services/RedemptionService';
import { hasValidFirebaseConfig } from '../config/firebase';
import cacheTest from '../utils/CacheTest';

/**
 * Developer tools component for testing and debugging
 * Only shown in development mode
 * Firebase-only version with no data modification capabilities
 */
const DevTools = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [userDataExists, setUserDataExists] = useState(false);
  const [activeTab, setActiveTab] = useState('Data');
  const [firebaseConfigValid, setFirebaseConfigValid] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configInput, setConfigInput] = useState('');
  const [cacheTestResults, setCacheTestResults] = useState(null);
  const [isCacheTesting, setIsCacheTesting] = useState(false);
  const [cachePerformanceResults, setCachePerformanceResults] = useState(null);
  const [isPerformanceTesting, setIsPerformanceTesting] = useState(false);
  const navigation = useNavigation();

  // Load initial state
  useEffect(() => {
    loadDevToolsState();
  }, []);

  // Check Firebase config on mount
  useEffect(() => {
    const checkFirebaseStatus = async () => {
      try {
        setFirebaseConfigValid(hasValidFirebaseConfig());
      } catch (error) {
        Logger.error(LogCategory.GENERAL, 'Error checking Firebase config', { error });
        setFirebaseConfigValid(false);
      }
    };
    
    checkFirebaseStatus();
    loadSavedFirebaseConfig();
  }, []);

  // Load saved Firebase config override
  const loadSavedFirebaseConfig = async () => {
    try {
      const savedConfig = await AsyncStorage.getItem('firebase_config_override');
      if (savedConfig) {
        const configObj = JSON.parse(savedConfig);
        global.ENV_OVERRIDE = configObj;
        Logger.info(LogCategory.GENERAL, 'Loaded saved Firebase config override');
      }
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error loading saved Firebase config', { error });
    }
  };
  
  // Load dev tools state
  const loadDevToolsState = async () => {
    await tryCatch(async () => {
      // Check for user data
      const ageVerified = await AsyncStorage.getItem('isAgeVerified');
      const tosAccepted = await AsyncStorage.getItem('tosAccepted');
      const username = await AsyncStorage.getItem('username');
      
      setUserDataExists(!!(ageVerified || tosAccepted || username));
    }, LogCategory.GENERAL, 'loading dev tools state', false);
  };
  
  // Check Firebase connection
  const checkFirebaseConnection = async () => {
    setConnectionStatus('connecting');
    try {
      const connected = await serviceProvider.verifyConnection();
      setConnectionStatus(connected ? 'connected' : 'failed');
      
      if (connected) {
        Alert.alert('Success', 'Successfully connected to Firebase!');
      } else {
        Alert.alert('Error', 'Failed to connect to Firebase. Check your configuration and network connection.');
      }
    } catch (error) {
      setConnectionStatus('failed');
      Logger.error(LogCategory.GENERAL, 'Error checking Firebase connection', { error });
      Alert.alert('Error', 'Error checking Firebase connection: ' + error.message);
    }
  };

  // Reset user data
  const resetUserData = async () => {
    try {
      await AsyncStorage.multiRemove([
        'isAgeVerified', 
        'tosAccepted', 
        'username',
        'points',
        'favorites',
        'recentVisits',
        'checkin_history',
        'current_journey',
        'current_route_data',
        'journey_history'
      ]);
      
      setUserDataExists(false);
      Logger.info(LogCategory.AUTH, 'User data reset by developer');
      
      // Navigate back to age verification
      navigation.reset({
        index: 0,
        routes: [{ name: 'AgeVerification' }],
      });
      
      Alert.alert('Success', 'User data reset complete');
    } catch (error) {
      Logger.error(LogCategory.STORAGE, 'Error resetting user data', { error });
      Alert.alert('Error', 'Failed to reset user data');
    }
  };

  // Clear all app data - updated to be safer
  const clearAllAppData = async () => {
    try {
      // Show confirmation alert
      Alert.alert(
        "Clear App Data",
        "This will clear all local AsyncStorage data. Your Firebase data will remain intact. The app will restart. Are you sure?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Clear Local Data",
            style: "destructive",
            onPress: async () => {
              try {
                // Clear redemption history locally
                await redemptionService.clearRedemptionHistory();
                
                // Get all keys from AsyncStorage
                const allKeys = await AsyncStorage.getAllKeys();
                
                // Remove all keys
                await AsyncStorage.multiRemove(allKeys);
                
                Logger.info(LogCategory.GENERAL, 'Local app data cleared by developer');
                
                // Navigate back to age verification
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'AgeVerification' }],
                });
                
                Alert.alert('Success', 'Local app data cleared successfully');
              } catch (error) {
                Logger.error(LogCategory.STORAGE, 'Error in clearAllAppData', { error });
                Alert.alert('Error', 'Failed to clear data: ' + error.message);
              }
            }
          }
        ]
      );
    } catch (error) {
      Logger.error(LogCategory.STORAGE, 'Error preparing clearAllAppData', { error });
      Alert.alert('Error', 'Failed to clear app data: ' + error.message);
    }
  };
  
  // Function to manually set Firebase config (for development)
  const setManualFirebaseConfig = async () => {
    // Show modal with text input instead of Alert.prompt (which is iOS only)
    setConfigModalVisible(true);
  };
  
  // Function to process the Firebase config input
  const processFirebaseConfig = async () => {
    try {
      // Parse the JSON
      const config = JSON.parse(configInput);
      
      // Validate required fields
      const requiredFields = [
        'apiKey', 'authDomain', 'projectId', 
        'storageBucket', 'messagingSenderId', 'appId'
      ];
      
      const missingFields = requiredFields.filter(field => !config[field]);
      
      if (missingFields.length > 0) {
        Alert.alert(
          'Invalid Config',
          `Missing required fields: ${missingFields.join(', ')}`
        );
        return;
      }
      
      // Set the global override
      global.ENV_OVERRIDE = {
        FIREBASE_API_KEY: config.apiKey,
        FIREBASE_AUTH_DOMAIN: config.authDomain,
        FIREBASE_PROJECT_ID: config.projectId,
        FIREBASE_STORAGE_BUCKET: config.storageBucket,
        FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
        FIREBASE_APP_ID: config.appId,
        FIREBASE_MEASUREMENT_ID: config.measurementId || ''
      };
      
      // Store in AsyncStorage for persistence
      await AsyncStorage.setItem(
        'firebase_config_override', 
        JSON.stringify(global.ENV_OVERRIDE)
      );
      
      // Close modal
      setConfigModalVisible(false);
      setConfigInput('');
      
      // Alert success
      Alert.alert(
        'Success',
        'Firebase config set successfully. Please restart the app for changes to take effect.'
      );
      
      // Recheck status
      checkFirebaseConnection();
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error setting manual Firebase config', { error });
      Alert.alert(
        'Error',
        'Failed to parse Firebase config. Make sure it\'s valid JSON.'
      );
    }
  };

  // Run cache system test
  const runCacheTest = async () => {
    setIsCacheTesting(true);
    setCacheTestResults(null);
    
    try {
      const results = await cacheTest.runFullTest();
      setCacheTestResults(results);
      
      if (results.success) {
        Alert.alert('Success', 'Cache system test completed successfully!');
      } else {
        Alert.alert('Warning', 'Some cache tests failed. Check the results for details.');
      }
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error running cache test', { error });
      Alert.alert('Error', 'Failed to run cache test: ' + error.message);
    } finally {
      setIsCacheTesting(false);
    }
  };

  // Run cache performance test
  const runPerformanceTest = async () => {
    setIsPerformanceTesting(true);
    setCachePerformanceResults(null);
    
    try {
      const results = await cacheTest.testPerformance();
      setCachePerformanceResults(results);
      
      if (results.success) {
        Alert.alert('Success', 'Cache performance test completed successfully!');
      } else {
        Alert.alert('Error', 'Performance test failed: ' + (results.error || 'Unknown error'));
      }
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error running performance test', { error });
      Alert.alert('Error', 'Failed to run performance test: ' + error.message);
    } finally {
      setIsPerformanceTesting(false);
    }
  };

  // Clear app cache
  const clearAppCache = async () => {
    try {
      // Show confirmation alert
      Alert.alert(
        "Clear App Cache",
        "This will clear all cached vendor and deal data. The app will need to reload data from the server. Continue?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Clear Cache",
            style: "destructive",
            onPress: async () => {
              try {
                const success = await appInitializer.clearCache();
                
                if (success) {
                  Alert.alert('Success', 'Cache cleared successfully. The app will reload data on next startup.');
                } else {
                  Alert.alert('Error', 'Failed to clear cache. Please try again.');
                }
              } catch (error) {
                Logger.error(LogCategory.GENERAL, 'Error clearing cache from DevTools', { error });
                Alert.alert('Error', 'An error occurred while clearing the cache: ' + error.message);
              }
            }
          }
        ]
      );
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error in clearAppCache', { error });
      Alert.alert('Error', 'Failed to clear cache: ' + error.message);
    }
  };

  if (!isVisible) {
    return (
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.fabIcon}>DEV</Text>
      </TouchableOpacity>
    );
  }

  // Render Data Source tab - updated to remove Firebase toggle
  const renderDataTab = () => (
    <>
      {/* Firebase Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Firebase Status</Text>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Configuration Valid:</Text>
          <View style={[
            styles.statusIndicator, 
            { backgroundColor: firebaseConfigValid ? '#4CAF50' : '#F44336' }
          ]}>
            <Text style={styles.statusText}>
              {firebaseConfigValid ? 'YES' : 'NO'}
            </Text>
          </View>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Connection:</Text>
          <View style={[
            styles.statusIndicator, 
            { 
              backgroundColor: 
                connectionStatus === 'connected' ? '#4CAF50' : 
                connectionStatus === 'connecting' ? '#FF9800' : '#F44336' 
            }
          ]}>
            <Text style={styles.statusText}>{connectionStatus}</Text>
          </View>
        </View>
        
        <Button
          title="Test Connection"
          onPress={checkFirebaseConnection}
          buttonStyle={styles.testConnectionButton}
          containerStyle={styles.buttonContainer}
          disabled={!firebaseConfigValid}
        />
        
        <Text style={styles.helpText}>
          {firebaseConfigValid 
            ? 'Firebase configuration is valid.' 
            : 'Firebase configuration is invalid. Please check your environment variables.'}
        </Text>
        
        <Button
          title="Set Manual Firebase Config"
          onPress={setManualFirebaseConfig}
          buttonStyle={styles.configButton}
          containerStyle={styles.buttonContainer}
        />
      </View>
      
      {/* Cache Testing Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Cache System</Text>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={runCacheTest}
            disabled={isCacheTesting}
          >
            <Text style={styles.buttonText}>
              {isCacheTesting ? 'Testing...' : 'Run Cache Test'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={runPerformanceTest}
            disabled={isPerformanceTesting}
          >
            <Text style={styles.buttonText}>
              {isPerformanceTesting ? 'Testing...' : 'Test Performance'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.dangerButton]} 
            onPress={clearAppCache}
          >
            <Text style={styles.buttonText}>Clear App Cache</Text>
          </TouchableOpacity>
        </View>
        
        {/* Cache Test Results */}
        {cacheTestResults && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsHeader}>
              Cache Test Results: {cacheTestResults.success ? 'SUCCESS' : 'FAILED'}
            </Text>
            
            {Object.entries(cacheTestResults.results).map(([key, value]) => (
              <View key={key} style={styles.resultRow}>
                <Text style={styles.resultLabel}>{key}:</Text>
                <Text style={[
                  styles.resultValue,
                  { color: value.success ? '#4CAF50' : '#F44336' }
                ]}>
                  {value.success ? 'PASS' : 'FAIL'} 
                  {value.count !== undefined ? ` (${value.count} items)` : ''}
                  {value.time !== undefined ? ` in ${value.time}ms` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Performance Test Results */}
        {cachePerformanceResults && cachePerformanceResults.success && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsHeader}>Performance Results</Text>
            
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionHeader}>Vendors</Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Cached:</Text>
                <Text style={styles.resultValue}>
                  {cachePerformanceResults.results.vendors.cached.time}ms 
                  ({cachePerformanceResults.results.vendors.cached.count} items)
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Uncached:</Text>
                <Text style={styles.resultValue}>
                  {cachePerformanceResults.results.vendors.uncached.time}ms
                  ({cachePerformanceResults.results.vendors.uncached.count} items)
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Speedup:</Text>
                <Text style={[
                  styles.resultValue,
                  { color: '#4CAF50', fontWeight: 'bold' }
                ]}>
                  {cachePerformanceResults.results.vendors.speedup}x
                </Text>
              </View>
            </View>
            
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionHeader}>Deals</Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Cached:</Text>
                <Text style={styles.resultValue}>
                  {cachePerformanceResults.results.deals.cached.time}ms
                  ({cachePerformanceResults.results.deals.cached.count} items)
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Uncached:</Text>
                <Text style={styles.resultValue}>
                  {cachePerformanceResults.results.deals.uncached.time}ms
                  ({cachePerformanceResults.results.deals.uncached.count} items)
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Speedup:</Text>
                <Text style={[
                  styles.resultValue,
                  { color: '#4CAF50', fontWeight: 'bold' }
                ]}>
                  {cachePerformanceResults.results.deals.speedup}x
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
      
      {/* Clear All App Data */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Clear Local App Data</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.dangerButton]} 
            onPress={clearAllAppData}
          >
            <Text style={styles.buttonText}>Clear Local App Data</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>
          Clears all local app data including AsyncStorage and redemptions. Firebase data remains intact.
        </Text>
      </View>
    </>
  );

  // Render User tab
  const renderUserTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>User Auth Status</Text>
      <Text style={styles.helpText}>
        {userDataExists ? 'User data exists' : 'No user data found'}
      </Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.button, styles.dangerButton]} 
          onPress={resetUserData}
        >
          <Text style={styles.buttonText}>Reset User Data</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render Journey tab
  const renderJourneyTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>Journey Tools</Text>
      <Text style={styles.helpText}>Journey debugging tools will be added here.</Text>
    </View>
  );

  // Render Logs tab
  const renderLogsTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>Logs</Text>
      <Text style={styles.helpText}>Log viewer will be added here.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Developer Tools</Text>
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={() => setIsVisible(false)}
        >
          <Icon name="close" type="material" color="#fff" size={24} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.tabBar}>
        {['Data', 'User', 'Journey', 'Logs'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.activeTab
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab && styles.activeTabText
            ]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <ScrollView style={styles.content}>
        {activeTab === 'Data' && renderDataTab()}
        {activeTab === 'User' && renderUserTab()}
        {activeTab === 'Journey' && renderJourneyTab()}
        {activeTab === 'Logs' && renderLogsTab()}
      </ScrollView>
      
      {/* Firebase Config Modal */}
      <Modal
        visible={configModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfigModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Firebase Config</Text>
            <Text style={styles.modalSubtitle}>
              Enter your Firebase config as a JSON object. This will override the environment variables.
            </Text>
            
            <TextInput
              style={styles.configInput}
              multiline={true}
              numberOfLines={8}
              placeholder='{"apiKey": "...", "authDomain": "...", ...}'
              value={configInput}
              onChangeText={setConfigInput}
            />
            
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setConfigModalVisible(false);
                  setConfigInput('');
                }}
                buttonStyle={styles.cancelButton}
                containerStyle={{ flex: 1, marginRight: 5 }}
              />
              <Button
                title="Save"
                onPress={processFirebaseConfig}
                buttonStyle={styles.confirmButton}
                containerStyle={{ flex: 1, marginLeft: 5 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#222',
    padding: 15,
    borderRadius: 5,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  button: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  secondaryButton: {
    backgroundColor: '#FF9800',
  },
  helpText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 5,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  tab: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    color: '#aaa',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusLabel: {
    color: '#fff',
    fontSize: 14,
  },
  statusIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonContainer: {
    marginVertical: 10,
  },
  testConnectionButton: {
    backgroundColor: '#4CAF50',
  },
  configButton: {
    backgroundColor: '#FF9800',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    zIndex: 9999,
  },
  fabIcon: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#333',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 15,
  },
  configInput: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 10,
    borderRadius: 5,
    height: 150,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  resultsContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#444',
  },
  resultsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#fff',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  resultLabel: {
    fontSize: 14,
    color: '#ccc',
  },
  resultValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  resultSection: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#222',
    borderRadius: 5,
  },
  resultSectionHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    paddingBottom: 5,
  },
});

export default DevTools;