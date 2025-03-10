// src/context/AppStateContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, LogCategory } from '../services/LoggingService';
import { handleError, tryCatch } from '../utils/ErrorHandler';
import { vendorCacheService } from '../services/VendorCacheService';

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
    isCacheInitialized: false,
    cacheStatus: 'uninitialized' // 'uninitialized' | 'initializing' | 'ready' | 'error'
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
  UPDATE_VENDOR_CACHE_STATUS: 'UPDATE_VENDOR_CACHE_STATUS',
  UPDATE_DEAL_FILTERS: 'UPDATE_DEAL_FILTERS',
  SET_THEME: 'SET_THEME',
  SET_NOTIFICATIONS: 'SET_NOTIFICATIONS',
  MARK_VENDOR_CHECKED_IN: 'MARK_VENDOR_CHECKED_IN',
  SET_CURRENT_VENDOR_INDEX: 'SET_CURRENT_VENDOR_INDEX',
  UPDATE_USER_LOCATION: 'UPDATE_USER_LOCATION'
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

    case ActionTypes.SET_CURRENT_VENDOR_INDEX:
      return {
        ...state,
        journey: {
          ...state.journey,
          currentVendorIndex: action.payload
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

    case ActionTypes.UPDATE_VENDOR_CACHE_STATUS:
      return {
        ...state,
        vendorData: {
          ...state.vendorData,
          cacheStatus: action.payload
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

    case ActionTypes.MARK_VENDOR_CHECKED_IN:
      return {
        ...state,
        journey: {
          ...state.journey,
          vendors: state.journey.vendors.map((vendor, index) => 
            index === action.payload.index 
              ? { 
                  ...vendor, 
                  checkedIn: true,
                  checkInType: action.payload.checkInType 
                } 
              : vendor
          )
        }
      };

    case ActionTypes.UPDATE_USER_LOCATION:
      return {
        ...state,
        user: {
          ...state.user,
          location: action.payload
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
        // Load persisted state from AsyncStorage
        const persistedState = await AsyncStorage.getItem('appState');
        if (persistedState) {
          const parsedState = JSON.parse(persistedState);
          Object.keys(parsedState).forEach(key => {
            if (key === 'user') {
              dispatch({ type: ActionTypes.SET_AGE_VERIFICATION, payload: parsedState.user.isAgeVerified });
              dispatch({ type: ActionTypes.SET_TOS_ACCEPTED, payload: parsedState.user.isTosAccepted });
              dispatch({ type: ActionTypes.SET_USERNAME, payload: parsedState.user.username });
              dispatch({ type: ActionTypes.UPDATE_POINTS, payload: parsedState.user.points });
              parsedState.user.favorites.forEach(favorite => 
                dispatch({ type: ActionTypes.ADD_FAVORITE, payload: favorite }));
              parsedState.user.recentVisits.forEach(visit => 
                dispatch({ type: ActionTypes.ADD_RECENT_VISIT, payload: visit }));
            }
            // Add other state restoration as needed
          });
        }

        // Initialize vendor cache
        dispatch({ type: ActionTypes.UPDATE_VENDOR_CACHE_STATUS, payload: 'initializing' });
        
        try {
          await vendorCacheService.initialize();
          
          // Update vendor data from cache
          if (vendorCacheService.isCacheLoaded()) {
            const cachedVendors = vendorCacheService.getAllVendors();
            if (cachedVendors && cachedVendors.length > 0) {
              dispatch({ 
                type: ActionTypes.UPDATE_VENDOR_DATA, 
                payload: { 
                  vendors: cachedVendors,
                  lastUpdated: Date.now()
                }
              });
              dispatch({ type: ActionTypes.UPDATE_VENDOR_CACHE_STATUS, payload: 'ready' });
            }
          }
        } catch (cacheError) {
          Logger.error(LogCategory.VENDORS, 'Error initializing vendor cache', { error: cacheError });
          dispatch({ type: ActionTypes.UPDATE_VENDOR_CACHE_STATUS, payload: 'error' });
        }

      } catch (error) {
        Logger.error(LogCategory.GENERAL, 'Error loading persisted data', { error });
        dispatch({ type: ActionTypes.UPDATE_VENDOR_CACHE_STATUS, payload: 'error' });
      }
    };

    loadPersistedData();
  }, []);

  // Subscribe to vendor cache updates
  useEffect(() => {
    let unsubscribe = () => {};

    const setupSubscription = async () => {
      try {
        // Wait for vendor cache service to be available
        if (!vendorCacheService) {
          Logger.warn(LogCategory.VENDORS, 'Vendor cache service not available');
          return;
        }

        unsubscribe = vendorCacheService.subscribe(async (event) => {
          if (event.type === 'update' || event.type === 'init') {
            const cachedVendors = vendorCacheService.getAllVendors();
            if (cachedVendors && cachedVendors.length > 0) {
              dispatch({ 
                type: ActionTypes.UPDATE_VENDOR_DATA, 
                payload: { 
                  vendors: cachedVendors,
                  lastUpdated: Date.now()
                }
              });
            }
          }
        });
      } catch (error) {
        Logger.error(LogCategory.VENDORS, 'Error setting up vendor cache subscription', { error });
      }
    };

    setupSubscription();

    return () => {
      try {
        unsubscribe();
      } catch (error) {
        Logger.error(LogCategory.VENDORS, 'Error unsubscribing from vendor cache', { error });
      }
    };
  }, []);

  // Persist state changes
  useEffect(() => {
    const persistStateChanges = async () => {
      try {
        const stateToStore = {
          user: {
            isAgeVerified: state.user.isAgeVerified,
            isTosAccepted: state.user.isTosAccepted,
            username: state.user.username,
            points: state.user.points,
            favorites: state.user.favorites,
            recentVisits: state.user.recentVisits
          },
          ui: {
            theme: state.ui.theme,
            notifications: state.ui.notifications
          },
          dealFilters: state.dealFilters,
          vendorData: {
            lastUpdated: state.vendorData.lastUpdated,
            isCacheInitialized: state.vendorData.isCacheInitialized,
            cacheStatus: state.vendorData.cacheStatus
          }
        };

        await AsyncStorage.setItem('appState', JSON.stringify(stateToStore));
        Logger.info(LogCategory.STORAGE, 'Persisted state changes');
      } catch (error) {
        Logger.error(LogCategory.STORAGE, 'Error persisting state changes', { error });
      }
    };

    persistStateChanges();
  }, [
    state.user.isAgeVerified,
    state.user.isTosAccepted,
    state.user.username,
    state.user.points,
    state.user.favorites,
    state.user.recentVisits,
    state.ui.theme,
    state.ui.notifications,
    state.dealFilters,
    state.vendorData.lastUpdated,
    state.vendorData.isCacheInitialized,
    state.vendorData.cacheStatus
  ]);

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

  setCurrentVendorIndex: (index) => ({
    type: ActionTypes.SET_CURRENT_VENDOR_INDEX,
    payload: index
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
  
  updateUserLocation: (location) => ({
    type: ActionTypes.UPDATE_USER_LOCATION,
    payload: location
  }),
  
  startJourney: (journeyData) => ({
    type: ActionTypes.START_JOURNEY,
    payload: journeyData
  }),
  
  endJourney: () => {
    // Clear journey data from storage when the action is dispatched
    AsyncStorage.multiRemove([
      'current_journey', 
      'current_route_data'
    ]).catch(error => {
      Logger.error(LogCategory.STORAGE, 'Failed to clear journey data from storage', { error });
    });
    
    return { type: ActionTypes.END_JOURNEY };
  },
  
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
  
  updateVendorCacheStatus: (status) => ({
    type: ActionTypes.UPDATE_VENDOR_CACHE_STATUS,
    payload: status
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
  }),
  
  markVendorCheckedIn: (vendorIndex, checkInType = 'qr') => ({
    type: ActionTypes.MARK_VENDOR_CHECKED_IN,
    payload: {
      index: vendorIndex,
      checkInType: checkInType
    }
  })
};