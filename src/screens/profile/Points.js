// src/screens/profile/Points.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  FlatList
} from 'react-native';
import { 
  Text, 
  Button, 
  Card, 
  Icon, 
  ListItem, 
  Divider,
  Tab,
  TabView
} from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Points = ({ navigation }) => {
  const { state, dispatch } = useAppState();
  const [isLoading, setIsLoading] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [pointsHistory, setPointsHistory] = useState([]);
  const [rewards, setRewards] = useState([]);
  
  const points = state.user.points || 0;
  
  // Load points history and rewards
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      await tryCatch(async () => {
        // In a real app, fetch from an API
        // For now, use mock data
        
        // Mock points history
        setPointsHistory([
          {
            id: '1',
            vendorId: 'v1',
            vendorName: 'Green Horizon',
            type: 'check-in',
            points: 10,
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '2',
            vendorId: 'v3',
            vendorName: 'Northern Lights Cannabis',
            type: 'check-in',
            points: 10,
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '3',
            vendorId: 'v2',
            vendorName: 'Aurora Dispensary',
            type: 'journey-completion',
            points: 25,
            date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]);
        
        // Mock rewards
        setRewards([
          {
            id: '1',
            title: 'Free Pre-Roll',
            description: 'Redeem your points for a free pre-roll at participating vendors.',
            pointsCost: 100,
            image: 'https://example.com/images/pre-roll.jpg'
          },
          {
            id: '2',
            title: '10% Off Any Purchase',
            description: 'Get 10% off your next purchase at any participating vendor.',
            pointsCost: 150,
            image: 'https://example.com/images/discount.jpg'
          },
          {
            id: '3',
            title: 'Buy One Get One Free Edible',
            description: 'Buy any edible and get one of equal or lesser value free.',
            pointsCost: 200,
            image: 'https://example.com/images/edibles.jpg'
          },
          {
            id: '4',
            title: 'VIP Access to New Strains',
            description: 'Get early access to try new strains before they hit the shelves.',
            pointsCost: 300,
            image: 'https://example.com/images/vip.jpg'
          }
        ]);
        
        Logger.info(LogCategory.GENERAL, 'Loaded points data');
      }, LogCategory.GENERAL, 'loading points data', false);
    } catch (error) {
      // Error already logged by tryCatch
    } finally {
      setIsLoading(false);
    }
  };
  
  const redeemReward = (reward) => {
    if (points < reward.pointsCost) {
      alert('Not enough points to redeem this reward.');
      return;
    }
    
    alert(`You've redeemed ${reward.title}! This feature is currently in development. In the future, you'll be able to show this to participating vendors.`);
    
    // In a real app, make an API call to redeem the reward
    // and update the user's points
    // For now, just demonstrate the concept
    dispatch(AppActions.updatePoints(points - reward.pointsCost));
    
    Logger.info(LogCategory.GENERAL, 'User redeemed reward', {
      rewardId: reward.id,
      rewardTitle: reward.title,
      pointsCost: reward.pointsCost
    });
  };
  
  const renderRewardItem = ({ item }) => (
    <Card containerStyle={styles.rewardCard}>
      <View style={styles.rewardHeader}>
        <View style={styles.rewardTitleContainer}>
          <Text style={styles.rewardTitle}>{item.title}</Text>
          <View style={styles.pointsCostContainer}>
            <Icon name="loyalty" type="material" size={14} color="#FFFFFF" />
            <Text style={styles.pointsCost}>{item.pointsCost}</Text>
          </View>
        </View>
      </View>
      
      <Text style={styles.rewardDescription}>{item.description}</Text>
      
      <Button
        title="Redeem"
        onPress={() => redeemReward(item)}
        disabled={points < item.pointsCost}
        buttonStyle={[
          styles.redeemButton,
          points < item.pointsCost && styles.disabledButton
        ]}
        disabledStyle={styles.disabledButton}
      />
    </Card>
  );
  
  const renderHistoryItem = ({ item }) => (
    <ListItem bottomDivider>
      <Icon
        name={
          item.type === 'check-in'
            ? 'place'
            : item.type === 'journey-completion'
            ? 'route'
            : 'local-activity'
        }
        type="material"
        color="#4CAF50"
      />
      <ListItem.Content>
        <ListItem.Title>{item.vendorName}</ListItem.Title>
        <ListItem.Subtitle>
          {item.type === 'check-in'
            ? 'Check-in'
            : item.type === 'journey-completion'
            ? 'Journey Completion'
            : 'Activity'}
        </ListItem.Subtitle>
      </ListItem.Content>
      <View style={styles.historyPointsContainer}>
        <Text style={styles.historyPoints}>+{item.points}</Text>
        <Text style={styles.historyDate}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </View>
    </ListItem>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text h4 style={styles.title}>Your Points</Text>
        <View style={styles.pointsDisplay}>
          <Text style={styles.pointsValue}>{points}</Text>
          <Text style={styles.pointsLabel}>POINTS</Text>
        </View>
        <Text style={styles.pointsExplanation}>
          Earn points by checking in at dispensaries and completing journeys.
          Redeem your points for exclusive rewards!
        </Text>
      </View>
      
      <Tab
        value={tabIndex}
        onChange={setTabIndex}
        indicatorStyle={{ backgroundColor: '#4CAF50' }}
        variant="primary"
      >
        <Tab.Item
          title="Rewards"
          titleStyle={styles.tabTitle}
          icon={{ name: 'card-giftcard', type: 'material', color: tabIndex === 0 ? '#4CAF50' : '#666666' }}
        />
        <Tab.Item
          title="History"
          titleStyle={styles.tabTitle}
          icon={{ name: 'history', type: 'material', color: tabIndex === 1 ? '#4CAF50' : '#666666' }}
        />
      </Tab>
      
      <TabView value={tabIndex} onChange={setTabIndex} animationType="spring">
        {/* Rewards Tab */}
        <TabView.Item style={styles.tabContent}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Loading rewards...</Text>
            </View>
          ) : (
            <FlatList
              data={rewards}
              renderItem={renderRewardItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.rewardsList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No rewards available</Text>
              }
            />
          )}
        </TabView.Item>
        
        {/* History Tab */}
        <TabView.Item style={styles.tabContent}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : (
            <FlatList
              data={pointsHistory}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.historyList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No points history yet</Text>
              }
            />
          )}
        </TabView.Item>
      </TabView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    marginBottom: 16,
  },
  pointsDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  pointsValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  pointsLabel: {
    fontSize: 16,
    color: '#666666',
  },
  pointsExplanation: {
    textAlign: 'center',
    color: '#666666',
    marginHorizontal: 20,
    fontSize: 14,
  },
  tabTitle: {
    fontSize: 14,
  },
  tabContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  rewardsList: {
    padding: 10,
  },
  historyList: {
    backgroundColor: '#FFFFFF',
  },
  rewardCard: {
    borderRadius: 8,
    marginBottom: 10,
    padding: 0,
    overflow: 'hidden',
  },
  rewardHeader: {
    padding: 16,
  },
  rewardTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pointsCostContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pointsCost: {
    marginLeft: 4,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  rewardDescription: {
    marginHorizontal: 16,
    marginBottom: 16,
    color: '#666666',
  },
  redeemButton: {
    margin: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  historyPointsContainer: {
    alignItems: 'flex-end',
  },
  historyPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  historyDate: {
    fontSize: 12,
    color: '#666666',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#666666',
    fontStyle: 'italic',
  },
});

export default Points;