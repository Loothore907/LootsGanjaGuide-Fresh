// src/components/DevTools.js
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Text } from 'react-native';
import { Button, Icon } from '@rneui/themed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Logger, LogCategory } from '../services/LoggingService';

/**
 * DevTools component - only rendered in __DEV__ mode
 * Provides quick navigation and testing shortcuts
 */
const DevTools = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const navigation = useNavigation();

  // Reset navigation to a specific screen
  const resetToScreen = (screenName) => {
    navigation.reset({
      index: 0,
      routes: [{ name: screenName }],
    });
    setModalVisible(false);
    Logger.debug(LogCategory.GENERAL, `DevTools: Reset to ${screenName}`);
  };

  // Clear all user authentication data
  const clearAuthData = async () => {
    try {
      await AsyncStorage.multiRemove([
        'isAgeVerified',
        'tosAccepted',
        'username',
        'ageVerificationDate',
        'tosAcceptedDate',
      ]);
      
      Logger.debug(LogCategory.GENERAL, 'DevTools: Cleared auth data');
      
      // Reset to initial screen
      resetToScreen('AgeVerification');
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  };

  // Clear all storage (more aggressive)
  const clearAllStorage = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
      
      Logger.debug(LogCategory.GENERAL, 'DevTools: Cleared all storage');
      
      // Reset to initial screen
      resetToScreen('AgeVerification');
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  };

  if (!__DEV__) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setModalVisible(true)}
      >
        <Icon name="developer-mode" type="material" color="#FFFFFF" size={24} />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Developer Tools</Text>
            
            <Text style={styles.sectionTitle}>Navigation</Text>
            <View style={styles.buttonGrid}>
              <Button
                title="Age Verification"
                onPress={() => resetToScreen('AgeVerification')}
                buttonStyle={styles.button}
                titleStyle={styles.buttonText}
              />
              <Button
                title="Terms of Service"
                onPress={() => resetToScreen('TermsOfService')}
                buttonStyle={styles.button}
                titleStyle={styles.buttonText}
              />
              <Button
                title="Username Setup"
                onPress={() => resetToScreen('UserSetup')}
                buttonStyle={styles.button}
                titleStyle={styles.buttonText}
              />
              <Button
                title="Return User Check"
                onPress={() => resetToScreen('ReturnUserVerification')}
                buttonStyle={styles.button}
                titleStyle={styles.buttonText}
              />
              <Button
                title="Dashboard"
                onPress={() => resetToScreen('MainTabs')}
                buttonStyle={styles.button}
                titleStyle={styles.buttonText}
              />
            </View>
            
            <Text style={styles.sectionTitle}>Storage</Text>
            <View style={styles.buttonRow}>
              <Button
                title="Clear Auth Data"
                onPress={clearAuthData}
                buttonStyle={[styles.button, styles.warningButton]}
                titleStyle={styles.buttonText}
              />
              <Button
                title="Clear All Storage"
                onPress={clearAllStorage}
                buttonStyle={[styles.button, styles.dangerButton]}
                titleStyle={styles.buttonText}
              />
            </View>

            <Button
              title="Close"
              onPress={() => setModalVisible(false)}
              buttonStyle={styles.closeButton}
              containerStyle={styles.closeButtonContainer}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    zIndex: 1000,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 8,
    margin: 5,
    minWidth: '45%',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    fontSize: 12,
  },
  closeButtonContainer: {
    marginTop: 10,
  },
  closeButton: {
    backgroundColor: '#2196F3',
  },
});

export default DevTools;