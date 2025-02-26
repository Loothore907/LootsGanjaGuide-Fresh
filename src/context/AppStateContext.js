// src/context/AppStateContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from '../services/LoggingService';
import { handleError, tryCatch } from '../utils/ErrorHandler';

// Initial state
const initialState = {
  user: {
    isAgeVerified: false,
    isTosAccepted: false,
    username: null,
    points: 0,
    favorites: [],
    recentVisits: []
  },
  journey: {
    isActive: false,
    dealType: null, // 'birthday', 'daily', or 'special'
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
  },
  dealFilters: {
    category: null,
    maxDistance: 25,
    showPartnersOnly: false
  },
  ui: {
    theme: 'light',
    notifications: true
  }
};

// Action types
const ActionTypes = {
  SET_AGE_VERIFICATION: 'SET_AGE_VERIFICATION',
  SET_TOS_ACCEPTED: 'SET_TOS_ACCEPTED',
  SET_USERNAME: 'SET_USERNAME',
  UPDATE_POINTS: 'UPDATE_POINTS',
  ADD_FAVORITE: 'ADD_FAVORITE',
  REMOVE_FAVORITE: 'REMOVE_FAVORITE',
  ADD_RECENT_VISIT: 'ADD_RECENT_VISIT',
  START_JOURNEY: 'START_JOURNEY',
  END_JOURNEY: 'END_JOURNEY',
  NEXT_VENDOR: 'NEXT_VENDOR',
  SKIP_VENDOR: 'SKIP_VENDOR',
  UPDATE_ROUTE: 'UPDATE_ROUTE',
  UPDATE_VENDOR_DATA: 'UPDATE_VENDOR_DATA',
  UPDATE_DEAL_FILTERS: 'UPDATE_DEAL_FILTERS',
  SET_THEME: 'SET_THEME',
  SET_NOTIFICATIONS: 'SET_NOTIFICATIONS'
};

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_AGE_VERIFICATION:
      return {
        ...state,
        user: {
          ...state.user,
          isAgeVerified: action.payload
        }
      };

    case ActionTypes.SET_TOS_ACCEPTED:
      return {
        ...state,
        user: {
          ...state.user,
          isTosAccepted: action.payload
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
          points: typeof action.payload === 'number' 
            ? action.payload 
            : state.user.points + action.payload
        }
      };

    case ActionTypes.ADD_FAVORITE:
      // Avoid duplicates
      if (state.user.favorites.includes(action.payload)) {
        return state;
      }
      return {
        ...state,
        user: {
          ...state.user,
          favorites: [...state.user.favorites, action.payload]
        }
      };

    case ActionTypes.REMOVE_FAVORITE:
      return {
        ...state,
        user: {
          ...state.user,
          favorites: state.user.favorites.filter(id => id !== action.payload)
        }
      };

    case ActionTypes.ADD_RECENT_VISIT:
      const newVisit = action.payload;
      const existingVisits = state.user.recentVisits.filter(
        visit => visit.vendorId !== newVisit.vendorId
      );
      
      return {
        ...state,
        user: {
          ...state.user,
          recentVisits: [newVisit, ...existingVisits].slice(0, 10) // Keep only 10 most recent
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

    case ActionTypes.UPDATE_DEAL_FILTERS:
      return {
        ...state,
        dealFilters: {
          ...state.dealFilters,
          ...action.payload
        }
      };
      
    case ActionTypes.SET_THEME:
      return {
        ...state,
        ui: {
          ...state.ui,
          theme: action.payload
        }
      };
      
    case ActionTypes.SET_NOTIFICATIONS:
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: action.payload
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
        await tryCatch(async () => {
          const [
            isAgeVerified,
            isTosAccepted,
            username,
            points,
            favoritesJson,
            recentVisitsJson,
            theme,
            notifications
          ] = await Promise.all([
            AsyncStorage.getItem('isAgeVerified'),
            AsyncStorage.getItem('tosAccepted'),
            AsyncStorage.getItem('username'),
            AsyncStorage.getItem('points'),
            AsyncStorage.getItem('favorites'),
            AsyncStorage.getItem('recentVisits'),
            AsyncStorage.getItem('theme'),
            AsyncStorage.getItem('notifications')
          ]);

          if (isAgeVerified === 'true') {
            dispatch({ type: ActionTypes.SET_AGE_VERIFICATION, payload: true });
          }
          
          if (isTosAccepted === 'true') {
            dispatch({ type: ActionTypes.SET_TOS_ACCEPTED, payload: true });
          }
          
          if (username) {
            dispatch({ type: ActionTypes.SET_USERNAME, payload: username });
          }
          
          if (points) {
            dispatch({ type: ActionTypes.UPDATE_POINTS, payload: parseInt(points) });
          }
          
          if (favoritesJson) {
            const favorites = JSON.parse(favoritesJson);
            for (const favoriteId of favorites) {
              dispatch({ type: ActionTypes.ADD_FAVORITE, payload: favoriteId });
            }
          }
          
          if (recentVisitsJson) {
            const recentVisits = JSON.parse(recentVisitsJson);
            for (const visit of recentVisits) {
              dispatch({ type: ActionTypes.ADD_RECENT_VISIT, payload: visit });
            }
          }
          
          if (theme) {
            dispatch({ type: ActionTypes.SET_THEME, payload: theme });
          }
          
          if (notifications) {
            dispatch({ type: ActionTypes.SET_NOTIFICATIONS, payload: notifications === 'true' });
          }
          
          Logger.info(LogCategory.STORAGE, 'Loaded persisted state data');
        }, LogCategory.STORAGE, 'loading persisted state', false);
      } catch (error) {
        // Error already logged by tryCatch
      }
    };

    loadPersistedData();
  }, []);

  // Persist state changes for specific items
  useEffect(() => {
    const persistStateChanges = async () => {
      try {
        await tryCatch(async () => {
          await AsyncStorage.setItem('points', state.user.points.toString());
          await AsyncStorage.setItem('favorites', JSON.stringify(state.user.favorites));
          await AsyncStorage.setItem('recentVisits', JSON.stringify(state.user.recentVisits));
          await AsyncStorage.setItem('theme', state.ui.theme);
          await AsyncStorage.setItem('notifications', state.ui.notifications.toString());
          
          Logger.debug(LogCategory.STORAGE, 'Persisted state changes');
        }, LogCategory.STORAGE, 'persisting state changes', false);
      } catch (error) {
        // Error already logged by tryCatch
      }
    };

    persistStateChanges();
  }, [state.user.points, state.user.favorites, state.user.recentVisits, state.ui.theme, state.ui.notifications]);

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
  setAgeVerification: (isVerified) => ({
    type: ActionTypes.SET_AGE_VERIFICATION,
    payload: isVerified
  }),
  
  setTosAccepted: (isAccepted) => ({
    type: ActionTypes.SET_TOS_ACCEPTED,
    payload: isAccepted
  }),
  
  setUsername: (username) => ({
    type: ActionTypes.SET_USERNAME,
    payload: username
  }),
  
  updatePoints: (points) => ({
    type: ActionTypes.UPDATE_POINTS,
    payload: points
  }),
  
  addFavorite: (vendorId) => ({
    type: ActionTypes.ADD_FAVORITE,
    payload: vendorId
  }),
  
  removeFavorite: (vendorId) => ({
    type: ActionTypes.REMOVE_FAVORITE,
    payload: vendorId
  }),
  
  addRecentVisit: (visit) => ({
    type: ActionTypes.ADD_RECENT_VISIT,
    payload: visit
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
  }),
  
  updateDealFilters: (filters) => ({
    type: ActionTypes.UPDATE_DEAL_FILTERS,
    payload: filters
  }),
  
  setTheme: (theme) => ({
    type: ActionTypes.SET_THEME,
    payload: theme
  }),
  
  setNotifications: (enabled) => ({
    type: ActionTypes.SET_NOTIFICATIONS,
    payload: enabled
  })
};