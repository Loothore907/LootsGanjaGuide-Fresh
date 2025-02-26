// src/screens/profile/Settings.js
import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Alert,
  Switch
} from 'react-native';
import { 
  Text, 
  ListItem, 
  Button,
  Icon,
  Divider
} from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Settings = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  
  // App settings
  const theme = state.ui.theme || 'light';
  const notifications = state.ui.notifications !== false; // Default to true if undefined
  const maxDistance = state.dealFilters.maxDistance || 25;
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    dispatch(AppActions.setTheme(newTheme));
    
    Logger.info(LogCategory.GENERAL, 'User changed theme', { 
      theme: newTheme 
    });
  };
  
  const toggleNotifications = () => {
    dispatch(AppActions.setNotifications(!notifications));
    
    Logger.info(LogCategory.GENERAL, 'User toggled notifications', { 
      enabled: !notifications 
    });
  };
  
  const clearAppData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to clear all app data? This will erase your favorites, recent visits, and preferences. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await tryCatch(async () => {
                // Clear all app data except for age verification and username
                const keysToPreserve = ['isAgeVerified', 'username', 'tosAccepted'];
                
                // Get all keys
                const allKeys = await AsyncStorage.getAllKeys();
                
                // Filter out keys to preserve
                const keysToRemove = allKeys.filter(key => !keysToPreserve.includes(key));
                
                // Remove keys
                if (keysToRemove.length > 0) {
                  await AsyncStorage.multiRemove(keysToRemove);
                }
                
                // Reset app state
                dispatch(AppActions.resetAppData());
                
                // Log the event
                Logger.info(LogCategory.GENERAL, 'User cleared all app data');
                
                // Notify the user
                Alert.alert(
                  'Data Cleared',
                  'All app data has been successfully cleared.',
                  [{ text: 'OK' }]
                );
              }, LogCategory.STORAGE, 'clearing app data', true);
            } catch (error) {
              // Error already logged by tryCatch
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };
  
  const viewLogs = () => {
    navigation.navigate('LogViewer');
  };
  
  const viewTerms = () => {
    navigation.navigate('TermsOfService', { fromSettings: true });
  };
  
  const showAbout = () => {
    Alert.alert(
      'About Loot\'s Ganja Guide',
      'Version 1.0.0\nCopyright © 2023 Loot\'s Ganja Guide\n\nA mobile app for discovering cannabis dispensary deals in Anchorage, Alaska.',
      [{ text: 'OK' }]
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text h4 style={styles.title}>Settings</Text>
        </View>
        
        {/* App Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Preferences</Text>
          <View style={styles.card}>
            <ListItem containerStyle={styles.listItem}>
              <Icon name="brightness-6" type="material" color="#4CAF50" />
              <ListItem.Content>
                <ListItem.Title>Dark Mode</ListItem.Title>
                <ListItem.Subtitle>Enable dark theme for the app</ListItem.Subtitle>
              </ListItem.Content>
              <Switch
                value={theme === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: '#767577', true: '#4CAF50' }}
                thumbColor="#f4f3f4"
              />
            </ListItem>
            <Divider />
            <ListItem containerStyle={styles.listItem}>
              <Icon name="notifications" type="material" color="#4CAF50" />
              <ListItem.Content>
                <ListItem.Title>Notifications</ListItem.Title>
                <ListItem.Subtitle>Receive deal alerts and updates</ListItem.Subtitle>
              </ListItem.Content>
              <Switch
                value={notifications}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#767577', true: '#4CAF50' }}
                thumbColor="#f4f3f4"
              />
            </ListItem>
          </View>
        </View>
        
        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <ListItem
              onPress={() => navigation.navigate('UserSetup', { isEdit: true })}
              containerStyle={styles.listItem}
            >
              <Icon name="edit" type="material" color="#4CAF50" />
              <ListItem.Content>
                <ListItem.Title>Change Username</ListItem.Title>
              </ListItem.Content>
              <ListItem.Chevron />
            </ListItem>
          </View>
        </View>
        
        {/* Legal & Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal & Support</Text>
          <View style={styles.card}>
            <ListItem onPress={viewTerms} containerStyle={styles.listItem}>
              <Icon name="description" type="material" color="#4CAF50" />
              <ListItem.Content>
                <ListItem.Title>Terms of Service</ListItem.Title>
              </ListItem.Content>
              <ListItem.Chevron />
            </ListItem>
            <Divider />
            <ListItem onPress={showAbout} containerStyle={styles.listItem}>
              <Icon name="info" type="material" color="#4CAF50" />
              <ListItem.Content>
                <ListItem.Title>About</ListItem.Title>
              </ListItem.Content>
              <ListItem.Chevron />
            </ListItem>
          </View>
        </View>
        
        {/* Advanced */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced</Text>
          <View style={styles.card}>
            <ListItem onPress={clearAppData} containerStyle={styles.listItem}>
              <Icon name="delete" type="material" color="#F44336" />
              <ListItem.Content>
                <ListItem.Title>Clear App Data</ListItem.Title>
                <ListItem.Subtitle>Delete all locally stored data</ListItem.Subtitle>
              </ListItem.Content>
              <ListItem.Chevron />
            </ListItem>
            <Divider />
            <ListItem onPress={viewLogs} containerStyle={styles.listItem}>
              <Icon name="list" type="material" color="#4CAF50" />
              <ListItem.Content>
                <ListItem.Title>View Logs</ListItem.Title>
                <ListItem.Subtitle>Debug information for support</ListItem.Subtitle>
              </ListItem.Content>
              <ListItem.Chevron />
            </ListItem>
          </View>
        </View>
        
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
  },
  title: {
    marginBottom: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666666',
    marginLeft: 20,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  listItem: {
    paddingVertical: 12,
  },
  versionText: {
    textAlign: 'center',
    padding: 20,
    color: '#999999',
    fontSize: 12,
  },
});

export default Settings;