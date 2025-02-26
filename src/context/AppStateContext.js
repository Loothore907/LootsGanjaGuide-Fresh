// src/context/AppStateContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Initial state
const initialState = {
  user: {
    isAuthenticated: false,
    isAgeVerified: false,
    username: null,
    points: 0,
  },
  journey: {
    isActive: false,
    dealType: null, // 'birthday' or 'daily'
    vendors: [],
    currentVendorIndex: -1,
    maxDistance: null,
    totalVendors: null,
  },
  route: {
    coordinates: [],
    totalDistance: 0,
    estimatedTime: 0,
  },
  vendorData: {
    list: [],
    lastUpdated: null,
  }
};

// Action types
const ActionTypes = {
  SET_USER_AUTH: 'SET_USER_AUTH',
  SET_AGE_VERIFICATION: 'SET_AGE_VERIFICATION',
  SET_USERNAME: 'SET_USERNAME',
  UPDATE_POINTS: 'UPDATE_POINTS',
  START_JOURNEY: 'START_JOURNEY',
  END_JOURNEY: 'END_JOURNEY',
  NEXT_VENDOR: 'NEXT_VENDOR',
  SKIP_VENDOR: 'SKIP_VENDOR',
  UPDATE_ROUTE: 'UPDATE_ROUTE',
  UPDATE_VENDOR_DATA: 'UPDATE_VENDOR_DATA',
};

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_USER_AUTH:
      return {
        ...state,
        user: {
          ...state.user,
          isAuthenticated: action.payload
        }
      };

    case ActionTypes.SET_AGE_VERIFICATION:
      return {
        ...state,
        user: {
          ...state.user,
          isAgeVerified: action.payload
        }
      };

    case ActionTypes.SET_USERNAME:
      return {
        ...state,
        user: {
          ...state.user,
          username: action.payload
        }
      };

    case ActionTypes.UPDATE_POINTS:
      return {
        ...state,
        user: {
          ...state.user,
          points: state.user.points + action.payload
        }
      };

    case ActionTypes.START_JOURNEY:
      return {
        ...state,
        journey: {
          ...state.journey,
          isActive: true,
          dealType: action.payload.dealType,
          vendors: action.payload.vendors,
          currentVendorIndex: 0,
          maxDistance: action.payload.maxDistance,
          totalVendors: action.payload.vendors.length,
        }
      };

    case ActionTypes.END_JOURNEY:
      return {
        ...state,
        journey: {
          ...initialState.journey
        },
        route: {
          ...initialState.route
        }
      };

    case ActionTypes.NEXT_VENDOR:
      return {
        ...state,
        journey: {
          ...state.journey,
          currentVendorIndex: state.journey.currentVendorIndex + 1
        }
      };

    case ActionTypes.SKIP_VENDOR:
      const updatedVendors = state.journey.vendors.filter(
        (_, index) => index !== state.journey.currentVendorIndex
      );
      return {
        ...state,
        journey: {
          ...state.journey,
          vendors: updatedVendors,
          totalVendors: updatedVendors.length
        }
      };

    case ActionTypes.UPDATE_ROUTE:
      return {
        ...state,
        route: {
          ...state.route,
          ...action.payload
        }
      };

    case ActionTypes.UPDATE_VENDOR_DATA:
      return {
        ...state,
        vendorData: {
          list: action.payload.vendors,
          lastUpdated: new Date().toISOString()
        }
      };

    default:
      return state;
  }
}

// Create context
const AppStateContext = createContext();

// Provider component
export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load persisted data on mount
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const [username, points, isAgeVerified] = await Promise.all([
          AsyncStorage.getItem('username'),
          AsyncStorage.getItem('points'),
          AsyncStorage.getItem('isAgeVerified'),
        ]);

        if (username) dispatch({ type: ActionTypes.SET_USERNAME, payload: username });
        if (points) dispatch({ type: ActionTypes.UPDATE_POINTS, payload: parseInt(points) });
        if (isAgeVerified) dispatch({ type: ActionTypes.SET_AGE_VERIFICATION, payload: isAgeVerified === 'true' });
      } catch (error) {
        console.error('Error loading persisted data:', error);
      }
    };

    loadPersistedData();
  }, []);

  // Persist certain state changes
  useEffect(() => {
    const persistData = async () => {
      try {
        await AsyncStorage.setItem('points', state.user.points.toString());
      } catch (error) {
        console.error('Error persisting data:', error);
      }
    };

    persistData();
  }, [state.user.points]);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
}

// Custom hook for using the context
export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}

// Action creators
export const AppActions = {
  setUserAuth: (isAuthenticated) => ({
    type: ActionTypes.SET_USER_AUTH,
    payload: isAuthenticated
  }),
  setAgeVerification: (isVerified) => ({
    type: ActionTypes.SET_AGE_VERIFICATION,
    payload: isVerified
  }),
  setUsername: (username) => ({
    type: ActionTypes.SET_USERNAME,
    payload: username
  }),
  updatePoints: (points) => ({
    type: ActionTypes.UPDATE_POINTS,
    payload: points
  }),
  startJourney: (journeyData) => ({
    type: ActionTypes.START_JOURNEY,
    payload: journeyData
  }),
  endJourney: () => ({
    type: ActionTypes.END_JOURNEY
  }),
  nextVendor: () => ({
    type: ActionTypes.NEXT_VENDOR
  }),
  skipVendor: () => ({
    type: ActionTypes.SKIP_VENDOR
  }),
  updateRoute: (routeData) => ({
    type: ActionTypes.UPDATE_ROUTE,
    payload: routeData
  }),
  updateVendorData: (vendors) => ({
    type: ActionTypes.UPDATE_VENDOR_DATA,
    payload: { vendors }
  })
};