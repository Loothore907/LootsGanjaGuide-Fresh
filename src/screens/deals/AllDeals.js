// src/screens/deals/AllDeals.js
import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity 
} from 'react-native';
import { Text, Button, Card, Icon } from '@rneui/themed';
import { useAppState } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';

const AllDeals = ({ navigation }) => {
  const { state } = useAppState();
  
  const dealTypes = [
    {
      title: 'Birthday Deals',
      description: 'Special offers for your birthday month',
      icon: 'cake',
      route: 'BirthdayDeals',
      color: '#8E44AD'
    },
    {
      title: 'Daily Deals',
      description: 'Best deals available today',
      icon: 'local-offer',
      route: 'DailyDeals',
      color: '#2ECC71'
    },
    {
      title: 'Special Offers',
      description: 'Limited time promotions',
      icon: 'event',
      route: 'SpecialDeals',
      color: '#E74C3C'
    }
  ];
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text h4 style={styles.title}>All Deals</Text>
        <Text style={styles.subtitle}>
          Find the best cannabis deals in Anchorage
        </Text>
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.dealTypesContainer}>
          {dealTypes.map((dealType, index) => (
            <Card 
              key={index}
              containerStyle={[styles.dealTypeCard, { borderColor: dealType.color }]}
            >
              <View style={styles.cardContent}>
                <View style={[styles.iconContainer, { backgroundColor: dealType.color }]}>
                  <Icon name={dealType.icon} type="material" color="#FFFFFF" size={32} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.dealTypeTitle}>{dealType.title}</Text>
                  <Text style={styles.dealTypeDescription}>{dealType.description}</Text>
                </View>
              </View>
              <Button
                title="View Deals"
                onPress={() => navigation.navigate(dealType.route)}
                buttonStyle={[styles.viewButton, { backgroundColor: dealType.color }]}
              />
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  scrollView: {
    flex: 1,
  },
  dealTypesContainer: {
    padding: 10,
  },
  dealTypeCard: {
    borderRadius: 8,
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
    borderLeftWidth: 4,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  dealTypeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dealTypeDescription: {
    fontSize: 14,
    color: '#666666',
  },
  viewButton: {
    margin: 16,
    borderRadius: 8,
  },
});

export default AllDeals;