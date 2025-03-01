// src/screens/profile/Settings.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Alert,
  Switch,
  Modal,
  TouchableOpacity
} from 'react-native';
import { 
  Text, 
  ListItem, 
  Button,
  Icon,
  Divider,
  Input
} from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Custom RadioButton component
const RadioButton = ({ title, description, checked, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.radioButton}>
      <View style={styles.radioCircle}>
        {checked && <View style={styles.radioFill} />}
      </View>
      <View style={styles.radioTextContainer}>
        <Text style={styles.radioTitle}>{title}</Text>
        <Text style={styles.radioDescription}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
};

const Settings = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  const [socialSharingModalVisible, setSocialSharingModalVisible] = useState(false);
  const [socialTier, setSocialTier] = useState('none');
  const [realName, setRealName] = useState('');
  
  // App settings
  const theme = state.ui.theme || 'light';
  const notifications = state.ui.notifications !== false; // Default to true if undefined
  const maxDistance = state.dealFilters.maxDistance || 25;
  
  // Load social sharing preferences
  useEffect(() => {
    const loadSocialPreferences = async () => {
      try {
        const socialPrefs = await AsyncStorage.getItem('social_sharing_prefs');
        if (socialPrefs) {
          const prefs = JSON.parse(socialPrefs);
          setSocialTier(prefs.tier || 'none');
          setRealName(prefs.realName || '');
        }
      } catch (error) {
        Logger.error(LogCategory.STORAGE, 'Error loading social preferences', { error });
      }
    };
    
    loadSocialPreferences();
  }, []);
  
  const saveSocialPreferences = async () => {
    try {
      const prefs = {
        tier: socialTier,
        realName: socialTier === 'full' ? realName : '',
        enabled: socialTier !== 'none'
      };
      
      await AsyncStorage.setItem('social_sharing_prefs', JSON.stringify(prefs));
      
      Logger.info(LogCategory.STORAGE, 'Saved social sharing preferences', { 
        tier: socialTier,
        hasRealName: !!realName
      });
      
      Alert.alert(
        'Preferences Saved',
        'Your social sharing preferences have been updated.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Logger.error(LogCategory.STORAGE, 'Error saving social preferences', { error });
      Alert.alert(
        'Error',
        'Could not save your preferences. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };
  
  const getSocialSharingDescription = () => {
    switch (socialTier) {
      case 'full':
        return 'Sharing with your real name';
      case 'username':
        return 'Sharing with your username only';
      case 'anonymous':
        return 'Sharing anonymously';
      case 'none':
      default:
        return 'Not sharing check-ins';
    }
  };
  
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
        
        {/* Social Media */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social Media</Text>
          <View style={styles.card}>
            <ListItem
              onPress={() => setSocialSharingModalVisible(true)}
              containerStyle={styles.listItem}
            >
              <Icon name="share" type="material" color="#4CAF50" />
              <ListItem.Content>
                <ListItem.Title>Social Sharing Preferences</ListItem.Title>
                <ListItem.Subtitle>
                  {getSocialSharingDescription()}
                </ListItem.Subtitle>
              </ListItem.Content>
              <ListItem.Chevron />
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
      
      {/* Add modal for selecting social sharing preferences */}
      <Modal
        visible={socialSharingModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSocialSharingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Social Sharing Preferences</Text>
            
            <Text style={styles.modalSubtitle}>
              Choose how you want to share your check-ins on social media
            </Text>
            
            <RadioButton
              title="Share with my real name"
              description="We'll tag you using the real name you provide"
              checked={socialTier === 'full'}
              onPress={() => setSocialTier('full')}
            />
            
            <RadioButton
              title="Share with my username only"
              description="We'll tag you using only your app username"
              checked={socialTier === 'username'}
              onPress={() => setSocialTier('username')}
            />
            
            <RadioButton
              title="Share anonymously"
              description="We'll post about your check-in without revealing your identity"
              checked={socialTier === 'anonymous'}
              onPress={() => setSocialTier('anonymous')}
            />
            
            <RadioButton
              title="Don't share my check-ins"
              description="We won't post about your check-ins on social media"
              checked={socialTier === 'none'}
              onPress={() => setSocialTier('none')}
            />
            
            {socialTier === 'full' && (
              <Input
                placeholder="Your real name"
                value={realName}
                onChangeText={setRealName}
                leftIcon={{ type: 'material', name: 'person' }}
                containerStyle={styles.inputContainer}
              />
            )}
            
            <Button
              title="Save Preferences"
              onPress={() => {
                saveSocialPreferences();
                setSocialSharingModalVisible(false);
              }}
              buttonStyle={styles.saveButton}
              containerStyle={styles.buttonContainer}
            />
            
            <Button
              title="Cancel"
              type="clear"
              onPress={() => setSocialSharingModalVisible(false)}
              containerStyle={styles.buttonContainer}
            />
          </View>
        </View>
      </Modal>
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  // Radio button styles
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 5,
  },
  radioCircle: {
    height: 24,
    width: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioFill: {
    height: 12,
    width: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  radioTextContainer: {
    flex: 1,
  },
  radioTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  radioDescription: {
    fontSize: 14,
    color: '#666',
  },
  inputContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  buttonContainer: {
    marginTop: 10,
  },
});

export default Settings;