// src/components/DevTools.js
import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Icon } from '@rneui/themed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Logger, LogCategory } from '../services/LoggingService';
import { tryCatch } from '../utils/ErrorHandler';
import serviceProvider from '../services/ServiceProvider';
import appInitializer from '../utils/AppInitializer';
import firebaseMigration from '../utils/FirebaseMigration';

/**
 * Developer tools component for testing and debugging
 * Only shown in development mode
 */
const DevTools = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [useFirebase, setUseFirebase] = useState(false);
  const [userDataExists, setUserDataExists] = useState(false);
  const [migrationCompleted, setMigrationCompleted] = useState(false);
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
    } catch (error) {
      Logger.error(LogCategory.GENERAL, 'Error toggling data source', { error });
    }
  };

  // Run Firebase migration
  const runMigration = async () => {
    try {
      const result = await firebaseMigration.migrateAllData();
      if (result.success) {
        await AsyncStorage.setItem('firebase_migration_completed', 'true');
        setMigrationCompleted(true);
        Logger.info(LogCategory.DATABASE, 'Firebase migration completed', { result });
        alert('Migration completed successfully!');
      } else {
        Logger.warn(LogCategory.DATABASE, 'Firebase migration issues', { result });
        alert(`Migration completed with issues: ${result.vendors.message}`);
      }
    } catch (error) {
      Logger.error(LogCategory.DATABASE, 'Error running migration', { error });
      alert(`Migration failed: ${error.message}`);
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
      
      alert('User data reset complete');
    } catch (error) {
      Logger.error(LogCategory.STORAGE, 'Error resetting user data', { error });
      alert('Error resetting user data');
    }
  };

  // Reset migration status
  const resetMigrationStatus = async () => {
    try {
      await AsyncStorage.removeItem('firebase_migration_completed');
      setMigrationCompleted(false);
      Logger.info(LogCategory.DATABASE, 'Migration status reset by developer');
      alert('Migration status reset');
    } catch (error) {
      Logger.error(LogCategory.STORAGE, 'Error resetting migration status', { error });
      alert('Error resetting migration status');
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

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Developer Tools</Text>
          <TouchableOpacity onPress={() => setIsVisible(false)}>
            <Icon name="close" type="material" size={24} />
          </TouchableOpacity>
        </View>
        
        <ScrollView>
          {/* Data Source */}
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
          
          {/* Firebase Migration */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Firebase Migration</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, migrationCompleted && styles.disabledButton]} 
                onPress={runMigration}
                disabled={migrationCompleted}
              >
                <Text style={styles.buttonText}>Migrate Data</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, !migrationCompleted && styles.disabledButton]}
                onPress={resetMigrationStatus}
                disabled={!migrationCompleted}
              >
                <Text style={styles.buttonText}>Reset Status</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helpText}>
              {migrationCompleted ? 'Migration completed' : 'Migration not yet run'}
            </Text>
          </View>
          
          {/* User Data */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>User Data</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.warningButton, !userDataExists && styles.disabledButton]} 
                onPress={resetUserData}
                disabled={!userDataExists}
              >
                <Text style={styles.buttonText}>Reset User Data</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helpText}>
              {userDataExists ? 'User data exists' : 'No user data found'}
            </Text>
          </View>
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
    width: '80%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
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
    marginBottom: 5,
  },
  toggleLabel: {
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
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
    backgroundColor: '#F44336',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: 'white',
    fontWeight: '500',
  },
});

export default DevTools;