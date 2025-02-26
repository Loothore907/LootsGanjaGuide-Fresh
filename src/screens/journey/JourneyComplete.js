// src/screens/journey/JourneyComplete.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';

const JourneyComplete = ({ navigation }) => {
  const { dispatch } = useAppState();
  
  const handleNewJourney = () => {
    dispatch(AppActions.endJourney());
    navigation.navigate('DealSelection');
  };
  
  return (
    <View style={styles.container}>
      <Text h3 style={styles.title}>Journey Complete!</Text>
      <Text style={styles.subtitle}>
        Congratulations on completing your cannabis journey!
      </Text>
      
      <View style={styles.statsContainer}>
        <Text style={styles.statTitle}>Journey Stats:</Text>
        <Text style={styles.stat}>• Vendors visited: 3</Text>
        <Text style={styles.stat}>• Points earned: 150</Text>
        <Text style={styles.stat}>• Total distance: 4.2 miles</Text>
      </View>
      
      <Button
        title="Start New Journey"
        onPress={handleNewJourney}
        containerStyle={styles.button}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  statsContainer: {
    width: '100%',
    backgroundColor: '#f8f8f8',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
  },
  statTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  stat: {
    fontSize: 16,
    marginBottom: 5,
  },
  button: {
    width: '80%',
    marginTop: 20,
  },
});

export default JourneyComplete;