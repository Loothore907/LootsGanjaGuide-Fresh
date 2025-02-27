// App.js
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Icon } from '@rneui/themed';

// Initialize logging service
import { Logger, LogCategory } from './src/services/LoggingService';

// Screen Imports - Auth
import AgeVerification from './src/screens/auth/AgeVerification';
import ReturnUserVerification from './src/screens/auth/ReturnUserVerification';
import TermsOfService from './src/screens/auth/TermsOfService';
import UserSetup from './src/screens/auth/UserSetup';

// Screen Imports - Main Tabs
import Dashboard from './src/screens/home/Dashboard';
import DealSelection from './src/screens/deals/DealSelection';
import RoutePreview from './src/screens/navigation/RoutePreview';
import MapView from './src/screens/navigation/MapView';
import VendorCheckin from './src/screens/vendor/VendorCheckin';
import VendorProfile from './src/screens/vendor/VendorProfile';
import JourneyComplete from './src/screens/journey/JourneyComplete';

// Screen Imports - Deals
import BirthdayDeals from './src/screens/deals/BirthdayDeals';
import DailyDeals from './src/screens/deals/DailyDeals';
import SpecialDeals from './src/screens/deals/SpecialDeals';
import AllDeals from './src/screens/deals/AllDeals';

// Screen Imports - Profile & Settings
import UserProfile from './src/screens/profile/UserProfile';
import Settings from './src/screens/profile/Settings';
import Points from './src/screens/profile/Points';
import AllVendors from './src/screens/vendor/AllVendors';

// Context Provider for Global State
import { AppStateProvider } from './src/context/AppStateContext';
import { handleError, tryCatch } from './src/utils/ErrorHandler';

// Developer Tools (only loaded in development)
import DevTools from './src/components/DevTools';

// Create navigators
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Create the main tab navigator
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Deals') {
            iconName = focused ? 'local-offer' : 'local-offer';
          } else if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Icon name={iconName} type="material" size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
        headerShown: false
      })}
    >
      <Tab.Screen name="Home" component={Dashboard} />
      <Tab.Screen name="Deals" component={AllDeals} />
      <Tab.Screen name="Map" component={MapView} />
      <Tab.Screen name="Profile" component={UserProfile} />
    </Tab.Navigator>
  );
};

const AppContent = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [isTosAccepted, setIsTosAccepted] = useState(false);
  const [hasUsername, setHasUsername] = useState(false);
  const [username, setUsername] = useState(null);
  const [isReturningUser, setIsReturningUser] = useState(false);

  // Initialize logging and check for user status
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize logging service
        await Logger.initialize();
        Logger.info(LogCategory.GENERAL, 'App initializing');
        
        await tryCatch(async () => {
          // Check for existing user setup
          const [ageStatus, tosStatus, usernameValue] = await Promise.all([
            AsyncStorage.getItem('isAgeVerified'),
            AsyncStorage.getItem('tosAccepted'),
            AsyncStorage.getItem('username')
          ]);
          
          setIsAgeVerified(ageStatus === 'true');
          setIsTosAccepted(tosStatus === 'true');
          setHasUsername(!!usernameValue);
          
          // Store username for returning user verification
          if (usernameValue) {
            setUsername(usernameValue);
          }
          
          // Determine if user is returning (has verified age before)
          if (ageStatus === 'true' && tosStatus === 'true' && usernameValue) {
            setIsReturningUser(true);
          }
          
          Logger.info(LogCategory.AUTH, 'User status loaded', {
            isAgeVerified: ageStatus === 'true',
            isTosAccepted: tosStatus === 'true',
            hasUsername: !!usernameValue,
            isReturningUser: (ageStatus === 'true' && tosStatus === 'true' && !!usernameValue)
          });
        }, LogCategory.AUTH, 'loading user status', false);
      } catch (error) {
        // Error is already logged by tryCatch
        // We'll continue initialization with default values
      } finally {
        setIsInitialized(true);
      }
    };
    
    initializeApp();
  }, []);

  // Don't render anything until we've checked if the user is setup
  if (!isInitialized) {
    return null;
  }

  // Determine initial route name based on user status
  const getInitialRouteName = () => {
    if (isReturningUser) {
      return 'ReturnUserVerification';
    }
    
    if (!isAgeVerified) {
      return 'AgeVerification';
    }
    
    if (!isTosAccepted) {
      return 'TermsOfService';
    }
    
    if (!hasUsername) {
      return 'UserSetup';
    }
    
    return 'MainTabs';
  };

  return (
    <NavigationContainer>
      {/* Stack Navigator for all screens */}
      <Stack.Navigator 
        initialRouteName={getInitialRouteName()}
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: 'white' }
        }}
      >
        {/* Authentication Flow */}
        <Stack.Screen name="AgeVerification" component={AgeVerification} />
        <Stack.Screen 
          name="ReturnUserVerification" 
          component={ReturnUserVerification} 
          initialParams={{ username }}
        />
        <Stack.Screen name="TermsOfService" component={TermsOfService} />
        <Stack.Screen name="UserSetup" component={UserSetup} />

        {/* Main App */}
        <Stack.Screen name="MainTabs" component={MainTabs} />

        {/* Deal Screens */}
        <Stack.Screen 
          name="DealSelection" 
          component={DealSelection}
          options={{ headerShown: true, title: 'Select Deal Type' }}
        />
        <Stack.Screen 
          name="BirthdayDeals" 
          component={BirthdayDeals}
          options={{ headerShown: true, title: 'Birthday Deals' }}
        />
        <Stack.Screen 
          name="DailyDeals" 
          component={DailyDeals}
          options={{ headerShown: true, title: 'Daily Deals' }}
        />
        <Stack.Screen 
          name="SpecialDeals" 
          component={SpecialDeals}
          options={{ headerShown: true, title: 'Special Offers' }}
        />

        {/* Journey Screens */}
        <Stack.Screen 
          name="RoutePreview" 
          component={RoutePreview}
          options={{ headerShown: true, title: 'Your Journey' }}
        />
        <Stack.Screen 
          name="VendorCheckin" 
          component={VendorCheckin}
          options={{ headerShown: true, title: 'Check In' }}
        />
        <Stack.Screen 
          name="JourneyComplete" 
          component={JourneyComplete}
          options={{ headerShown: true, title: 'Journey Complete' }}
        />

        {/* Vendor Screens */}
        <Stack.Screen 
          name="VendorProfile" 
          component={VendorProfile}
          options={{ headerShown: true, title: 'Vendor Details' }}
        />
        <Stack.Screen 
          name="AllVendors" 
          component={AllVendors}
          options={{ headerShown: true, title: 'All Vendors' }}
        />

        {/* User Screens */}
        <Stack.Screen 
          name="Settings" 
          component={Settings}
          options={{ headerShown: true, title: 'Settings' }}
        />
        <Stack.Screen 
          name="Points" 
          component={Points}
          options={{ headerShown: true, title: 'Your Points' }}
        />
      </Stack.Navigator>
      
      {/* Developer Tools - only rendered in __DEV__ mode */}
      {/* Now inside NavigationContainer so it can access navigation */}
      {__DEV__ && <DevTools />}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}