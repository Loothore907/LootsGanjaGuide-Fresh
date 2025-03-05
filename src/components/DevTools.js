// src/components/DevTools.js
import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Icon } from '@rneui/themed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Logger, LogCategory } from '../services/LoggingService';
import { tryCatch } from '../utils/ErrorHandler';
import serviceProvider from '../services/ServiceProvider';
import appInitializer from '../utils/AppInitializer';
import firebaseMigration from '../utils/FirebaseMigration';
import redemptionService from '../services/RedemptionService';

/**
 * Developer tools component for testing and debugging
 * Only shown in development mode
 */
const DevTools = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [useFirebase, setUseFirebase] = useState(false);
  const [userDataExists, setUserDataExists] = useState(false);
  const [migrationCompleted, setMigrationCompleted] = useState(false);
  const [migrationInProgress, setMigrationInProgress] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const [forceMigration, setForceMigration] = useState(false);
  const [activeTab, setActiveTab] = useState('Data');
  const navigation = useNavigation();

  // Load initial state
  useEffect(() => {
    const loadDevToolsState = async () => {
      await tryCatch(async () => {
        // Load Firebase setting
        const firebaseSetting = await AsyncStorage.getItem('use_firebase');
        setUseFirebase(firebaseSetting === 'true');
        
        // Check if any user data exists
        const ageVerified = await AsyncStorage.getItem('isAgeVerified');
        const tosAccepted = await AsyncStorage.getItem('tosAccepted');
        const username = await AsyncStorage.getItem('username');
        
        setUserDataExists(!!(ageVerified || tosAccepted || username));
        
        // Check migration status
        const migrationStatus = await AsyncStorage.getItem('firebase_migration_completed');
        setMigrationCompleted(migrationStatus === 'true');
      }, LogCategory.GENERAL, 'loading dev tools state', false);
    };
    
    loadDevToolsState();
  }, []);

  // Toggle Firebase/Mock data
  const toggleFirebase = async (value) => {
    try {
      await appInitializer.toggleDataSource(value);
      setUseFirebase(value);
      Logger.info(LogCategory.GENERAL, `Toggled data source to ${value ? 'Firebase' : 'Mock data'}`);
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error toggling data source', { error });
    }
  };

  // Run Firebase migration
  const runMigration = async () => {
    setMigrationInProgress(true);
    setMigrationResult({ status: 'in_progress', message: 'Migration in progress...' });
    
    try {
      // Show an alert to let the user know migration has started
      Alert.alert(
        "Migration Started",
        "Data migration has started. This may take a moment...",
        [{ text: "OK" }]
      );
      
      const result = await firebaseMigration.migrateAllData({ force: forceMigration });
      
      if (result.skipped) {
        setMigrationResult({
          status: 'skipped',
          message: 'Migration skipped. Data already exists.',
          details: result
        });
        Alert.alert("Migration Skipped", "Data already exists in Firebase. Use Force Override option to replace it.");
      } else if (result.success) {
        setMigrationCompleted(true);
        setMigrationResult({
          status: 'success',
          message: 'Migration completed successfully!',
          details: result
        });
        Logger.info(LogCategory.DATABASE, 'Firebase migration completed successfully', { result });
        Alert.alert("Success", "Migration completed successfully!");
      } else {
        setMigrationResult({
          status: 'error',
          message: 'Migration completed with issues',
          details: result
        });
        Logger.warn(LogCategory.DATABASE, 'Firebase migration had issues', { result });
        Alert.alert("Warning", `Migration completed with issues. Check logs for details.`);
      }
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error during migration', { error });
      setMigrationResult({
        status: 'error',
        message: `Migration failed: ${error.message}`,
        error: error.message
      });
      Alert.alert("Error", `Migration failed: ${error.message}`);
    } finally {
      setMigrationInProgress(false);
    }
  };

  // Reset migration status
  const resetMigrationStatus = async () => {
    try {
      await AsyncStorage.removeItem('firebase_migration_completed');
      setMigrationCompleted(false);
      setMigrationResult(null);
      Logger.info(LogCategory.DATABASE, 'Migration status reset by developer');
      Alert.alert('Success', 'Migration status reset');
    } catch (error) {
      Logger.error(LogCategory.STORAGE, 'Error resetting migration status', { error });
      Alert.alert('Error', 'Failed to reset migration status');
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

  // Clear all app data
  const clearAllAppData = async () => {
    try {
      // Show confirmation alert
      Alert.alert(
        "Clear All App Data",
        "This will clear all app data including AsyncStorage and Firebase data (if connected). The app will restart. Are you sure?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Clear All Data",
            style: "destructive",
            onPress: async () => {
              try {
                // Clear redemption history
                await redemptionService.clearRedemptionHistory();
                
                // Get all keys from AsyncStorage
                const allKeys = await AsyncStorage.getAllKeys();
                
                // Remove all keys
                await AsyncStorage.multiRemove(allKeys);
                
                // If using Firebase, clear Firebase data too
                if (useFirebase) {
                  try {
                    await firebaseMigration.clearAllData();
                    Logger.info(LogCategory.DATABASE, 'Firebase data cleared by developer');
                  } catch (error) {
                    Logger.error(LogCategory.DATABASE, 'Error clearing Firebase data', { error });
                  }
                }
                
                Logger.info(LogCategory.GENERAL, 'All app data cleared by developer');
                
                // Navigate back to age verification
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'AgeVerification' }],
                });
                
                Alert.alert('Success', 'All app data cleared successfully');
              } catch (error) {
                Logger.error(LogCategory.STORAGE, 'Error in clearAllAppData', { error });
                Alert.alert('Error', 'Failed to clear all data: ' + error.message);
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

  // Render Data Source tab
  const renderDataTab = () => (
    <>
      {/* Data Source Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Data Source</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Use Firebase</Text>
          <Switch
            value={useFirebase}
            onValueChange={toggleFirebase}
            trackColor={{ false: "#767577", true: "#4CAF50" }}
          />
        </View>
        <Text style={styles.helpText}>
          {useFirebase ? 'Using Firebase data' : 'Using mock data'}
        </Text>
      </View>
      
      {/* Firebase Migration Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Firebase Migration</Text>
        
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Force Override Existing Data</Text>
          <Switch
            value={forceMigration}
            onValueChange={setForceMigration}
            disabled={migrationInProgress}
            trackColor={{ false: "#767577", true: "#F44336" }}
          />
        </View>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[
              styles.button, 
              migrationInProgress && styles.disabledButton
            ]} 
            onPress={runMigration}
            disabled={migrationInProgress}
          >
            <Text style={styles.buttonText}>
              {migrationInProgress ? 'Migrating...' : 'Migrate to Firebase'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.button, 
              (!migrationCompleted || migrationInProgress) && styles.disabledButton
            ]}
            onPress={resetMigrationStatus}
            disabled={!migrationCompleted || migrationInProgress}
          >
            <Text style={styles.buttonText}>Reset Status</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.helpText}>
          {migrationCompleted ? 'Migration completed' : 'Migration not yet run'}
        </Text>

        {/* Migration progress indicator */}
        {migrationInProgress && (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.progressText}>Migration in progress...</Text>
          </View>
        )}
        
        {/* Migration Result */}
        {migrationResult && !migrationInProgress && (
          <View style={styles.resultContainer}>
            <Text style={[
              styles.resultStatus,
              migrationResult.status === 'success' && styles.successText,
              migrationResult.status === 'error' && styles.errorText,
              migrationResult.status === 'skipped' && styles.warningText
            ]}>
              {migrationResult.status.toUpperCase()}: {migrationResult.message}
            </Text>
          </View>
        )}
      </View>
      
      {/* Clear All App Data */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Clear All App Data</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.dangerButton]} 
            onPress={clearAllAppData}
          >
            <Text style={styles.buttonText}>Clear All App Data</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>
          Clears all app data including AsyncStorage, redemptions, and Firebase data
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
      
      <TouchableOpacity 
        style={[styles.button, styles.warningButton, !userDataExists && styles.disabledButton]} 
        onPress={resetUserData}
        disabled={!userDataExists}
      >
        <Text style={styles.buttonText}>Reset User Data</Text>
      </TouchableOpacity>
    </View>
  );

  // Render Journey tab
  const renderJourneyTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>Journey Data</Text>
      <Text style={styles.helpText}>
        Journey management options will appear here
      </Text>
    </View>
  );

  // Render Logs tab
  const renderLogsTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>Recent Logs</Text>
      <Text style={styles.helpText}>
        Log viewing will be added in a future update
      </Text>
    </View>
  );

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Developer Tools</Text>
          <TouchableOpacity onPress={() => setIsVisible(false)}>
            <Icon name="close" type="material" size={24} />
          </TouchableOpacity>
        </View>
        
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'Data' && styles.activeTab]} 
            onPress={() => setActiveTab('Data')}
          >
            <Text style={[styles.tabText, activeTab === 'Data' && styles.activeTabText]}>Data</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'User' && styles.activeTab]} 
            onPress={() => setActiveTab('User')}
          >
            <Text style={[styles.tabText, activeTab === 'User' && styles.activeTabText]}>User</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'Journey' && styles.activeTab]} 
            onPress={() => setActiveTab('Journey')}
          >
            <Text style={[styles.tabText, activeTab === 'Journey' && styles.activeTabText]}>Journey</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'Logs' && styles.activeTab]} 
            onPress={() => setActiveTab('Logs')}
          >
            <Text style={[styles.tabText, activeTab === 'Logs' && styles.activeTabText]}>Logs</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.contentContainer}>
          {activeTab === 'Data' && renderDataTab()}
          {activeTab === 'User' && renderUserTab()}
          {activeTab === 'Journey' && renderJourneyTab()}
          {activeTab === 'Logs' && renderLogsTab()}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    elevation: 4,
    zIndex: 1000,
  },
  fabIcon: {
    color: 'white',
    fontWeight: 'bold',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  panel: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    color: '#757575',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  contentContainer: {
    padding: 15,
    maxHeight: 400,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  toggleLabel: {
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: 'white',
    fontWeight: '500',
  },
  resultContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 5,
    padding: 10,
    marginTop: 10,
  },
  resultStatus: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  successText: {
    color: '#4CAF50',
  },
  errorText: {
    color: '#F44336',
  },
  warningText: {
    color: '#FF9800',
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
  },
  progressText: {
    marginTop: 10,
    fontSize: 14,
    color: '#2196F3',
  }
});

export default DevTools;