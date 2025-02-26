// App.js
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

// Screen Imports
import DeviceAuth from './src/screens/auth/DeviceAuth';
import AgeVerification from './src/screens/auth/AgeVerification';
import UserSetup from './src/screens/auth/UserSetup';
import DealSelection from './src/screens/deals/DealSelection';
import RoutePreview from './src/screens/navigation/RoutePreview';
import MapView from './src/screens/navigation/MapView';
import VendorCheckin from './src/screens/vendor/VendorCheckin';
import JourneyComplete from './src/screens/journey/JourneyComplete';

// Context Provider for Global State
import { AppStateProvider } from './src/context/AppStateContext';

const Stack = createStackNavigator();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [hasUsername, setHasUsername] = useState(false);

  useEffect(() => {
    checkInitialSetup();
  }, []);

  const checkInitialSetup = async () => {
    try {
      // Check device authentication
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Loot',
        fallbackLabel: 'Use passcode'
      });

      if (authResult.success) {
        setIsAuthenticated(true);
        
        // Check age verification and username
        const [ageStatus, username] = await Promise.all([
          AsyncStorage.getItem('isAgeVerified'),
          AsyncStorage.getItem('username')
        ]);

        setIsAgeVerified(ageStatus === 'true');
        setHasUsername(!!username);
      }
    } catch (error) {
      console.error('Setup check failed:', error);
    }
  };

  const getInitialRouteName = () => {
    if (!isAuthenticated) return 'DeviceAuth';
    if (!isAgeVerified) return 'AgeVerification';
    if (!hasUsername) return 'UserSetup';
    return 'DealSelection';
  };

  return (
    <AppStateProvider>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName={getInitialRouteName()}
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: 'white' }
          }}
        >
          {/* Authentication Flow */}
          <Stack.Screen name="DeviceAuth" component={DeviceAuth} />
          <Stack.Screen name="AgeVerification" component={AgeVerification} />
          <Stack.Screen name="UserSetup" component={UserSetup} />

          {/* Main App Flow */}
          <Stack.Screen name="DealSelection" component={DealSelection} />
          <Stack.Screen name="RoutePreview" component={RoutePreview} />
          <Stack.Screen name="MapView" component={MapView} />
          <Stack.Screen name="VendorCheckin" component={VendorCheckin} />
          <Stack.Screen name="JourneyComplete" component={JourneyComplete} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppStateProvider>
  );
}