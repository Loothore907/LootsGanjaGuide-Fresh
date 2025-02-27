// src/screens/auth/UserSetup.js
import React, { useState } from 'react';
import { View, StyleSheet, Alert, Keyboard } from 'react-native';
import { Text, Button, Input } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from '../../services/LoggingService';
import { tryCatch } from '../../utils/ErrorHandler';

const UserSetup = ({ navigation }) => {
  const { dispatch } = useAppState();
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validateUsername = (name) => {
    if (name.length < 3) {
      return 'Username must be at least 3 characters long';
    }
    if (name.length > 20) {
      return 'Username must be less than 20 characters';
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }
    return '';
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await tryCatch(async () => {
        // Store username
        await AsyncStorage.setItem('username', username);
        
        // Initialize points
        await AsyncStorage.setItem('points', '0');
        
        // Update global state
        dispatch(AppActions.setUsername(username));
        
        // Log success
        Logger.info(LogCategory.AUTH, 'User setup completed', { username });
        
        // Navigate to main app dashboard
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }, LogCategory.AUTH, 'user setup', true);
    } catch (error) {
      // Error is already logged by tryCatch
      Alert.alert('Error', 'Failed to set up username. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <Text h3 style={styles.title}>Create Username</Text>
        <Text style={styles.subtitle}>
          Choose a username for your cannabis journey.
          This will be used to track your points and achievements.
        </Text>

        <View style={styles.inputContainer}>
          <Input
            placeholder="Enter username"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setError('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
            errorMessage={error}
            disabled={isLoading}
            leftIcon={{ type: 'font-awesome', name: 'user', size: 18 }}
          />
          
          <Text style={styles.requirements}>
            Username requirements:
          </Text>
          <Text style={styles.requirementItem}>
            • 3-20 characters long
          </Text>
          <Text style={styles.requirementItem}>
            • Letters, numbers, underscores, and hyphens only
          </Text>
        </View>

        <Button
          title="Continue"
          onPress={handleSubmit}
          loading={isLoading}
          disabled={isLoading || !username.trim()}
          containerStyle={styles.buttonContainer}
        />

        <View style={styles.noteContainer}>
          <Text style={styles.note}>
            Note: Your username will be visible to vendors when you check in.
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
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 30,
  },
  requirements: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    marginLeft: 10,
  },
  requirementItem: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    marginTop: 5,
  },
  buttonContainer: {
    marginTop: 20,
  },
  noteContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  note: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default UserSetup;