// src/screens/profile/UserProfile.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  Alert
} from 'react-native';
import { 
  Text, 
  Button, 
  Card, 
  Icon, 
  ListItem, 
  Divider,
  Avatar
} from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserProfile = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  
  const username = state.user.username || 'Cannasseur';
  const points = state.user.points || 0;
  const favorites = state.user.favorites || [];
  const recentVisits = state.user.recentVisits || [];
  
  const menuItems = [
    {
      title: 'Points & Rewards',
      icon: 'loyalty',
      iconColor: '#4CAF50',
      onPress: () => navigation.navigate('Points')
    },
    {
      title: 'Favorite Vendors',
      icon: 'favorite',
      iconColor: '#F44336',
      onPress: () => navigation.navigate('AllVendors', { filter: 'favorites' })
    },
    {
      title: 'Recent Visits',
      icon: 'history',
      iconColor: '#2196F3',
      onPress: () => navigation.navigate('AllVendors', { filter: 'recent' })
    },
    {
      title: 'Settings',
      icon: 'settings',
      iconColor: '#607D8B',
      onPress: () => navigation.navigate('Settings')
    }
  ];
  
  const handleLogout = async () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out? You will need to verify your age again next time.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await tryCatch(async () => {
                // Clear age verification flag
                await AsyncStorage.setItem('isAgeVerified', 'false');
                
                // Update app state
                dispatch(AppActions.setAgeVerification(false));
                
                // Log the event
                Logger.info(LogCategory.AUTH, 'User logged out');
                
                // Navigate to age verification
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'AgeVerification' }]
                });
              }, LogCategory.AUTH, 'logging out', true);
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
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Avatar
            size={100}
            rounded
            icon={{ name: 'person', type: 'material' }}
            containerStyle={styles.avatar}
          />
          <Text style={styles.username}>{username}</Text>
          <View style={styles.pointsContainer}>
            <Icon name="loyalty" type="material" size={20} color="#4CAF50" />
            <Text style={styles.pointsText}>{points} points</Text>
          </View>
        </View>
        
        <Card containerStyle={styles.statsCard}>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{favorites.length}</Text>
              <Text style={styles.statLabel}>Favorites</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{recentVisits.length}</Text>
              <Text style={styles.statLabel}>Visits</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Journeys</Text>
            </View>
          </View>
        </Card>
        
        <Card containerStyle={styles.menuCard}>
          {menuItems.map((item, index) => (
            <React.Fragment key={index}>
              <ListItem onPress={item.onPress} containerStyle={styles.menuItem}>
                <Icon name={item.icon} type="material" color={item.iconColor} />
                <ListItem.Content>
                  <ListItem.Title>{item.title}</ListItem.Title>
                </ListItem.Content>
                <ListItem.Chevron />
              </ListItem>
              {index < menuItems.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </Card>
        
        <Card containerStyle={styles.recentCard}>
          <Card.Title>Recent Activity</Card.Title>
          <Card.Divider />
          {recentVisits.length > 0 ? (
            recentVisits.slice(0, 3).map((visit, index) => (
              <ListItem
                key={index}
                bottomDivider={index < recentVisits.slice(0, 3).length - 1}
                onPress={() => navigation.navigate('VendorProfile', { vendorId: visit.vendorId })}
              >
                <Icon name="storefront" type="material" color="#4CAF50" />
                <ListItem.Content>
                  <ListItem.Title>{visit.vendorName}</ListItem.Title>
                  <ListItem.Subtitle>
                    Visited on {new Date(visit.lastVisit).toLocaleDateString()}
                  </ListItem.Subtitle>
                </ListItem.Content>
                <ListItem.Chevron />
              </ListItem>
            ))
          ) : (
            <Text style={styles.emptyText}>No recent activity</Text>
          )}
          
          {recentVisits.length > 3 && (
            <Button
              title="View All Activity"
              type="clear"
              onPress={() => navigation.navigate('AllVendors', { filter: 'recent' })}
              containerStyle={styles.viewAllButton}
            />
          )}
        </Card>
        
        <Button
          title="Log Out"
          type="outline"
          buttonStyle={styles.logoutButton}
          containerStyle={styles.logoutButtonContainer}
          titleStyle={styles.logoutButtonText}
          onPress={handleLogout}
          loading={isLoading}
        />
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
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    backgroundColor: '#4CAF50',
    marginBottom: 16,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pointsText: {
    marginLeft: 4,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statsCard: {
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: -20,
    padding: 0,
    overflow: 'hidden',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: '#EEEEEE',
    alignSelf: 'center',
  },
  menuCard: {
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 16,
  },
  recentCard: {
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#666666',
    fontStyle: 'italic',
  },
  viewAllButton: {
    marginTop: 8,
  },
  logoutButton: {
    borderColor: '#F44336',
    marginTop: 20,
    marginBottom: 30,
  },
  logoutButtonContainer: {
    marginHorizontal: 16,
  },
  logoutButtonText: {
    color: '#F44336',
  },
});

export default UserProfile;