// src/screens/auth/AgeVerification.js
import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import { Text, Button } from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AgeVerification = ({ navigation }) => {
  const { dispatch } = useAppState();
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [year, setYear] = useState(2000);
  const [isLoading, setIsLoading] = useState(false);

  const calculateAge = (birthMonth, birthDay, birthYear) => {
    const today = new Date();
    let age = today.getFullYear() - birthYear;
    const monthDiff = today.getMonth() + 1 - birthMonth;
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDay)) {
      age--;
    }
    
    return age;
  };

  const handleVerification = async () => {
    setIsLoading(true);
    try {
      const age = calculateAge(month, day, year);
      
      if (age < 21) {
        Alert.alert(
          'Age Restriction',
          'You must be 21 or older to use this application.',
          [{ text: 'OK' }]
        );
        return;
      }

      const birthdate = new Date(year, month - 1, day).toISOString();
      await AsyncStorage.setItem('isAgeVerified', 'true');
      await AsyncStorage.setItem('birthdate', birthdate);
      dispatch(AppActions.setAgeVerification(true));
    } catch (error) {
      console.error('Age verification error:', error);
      Alert.alert('Error', 'Failed to verify age. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const NumberSelector = ({ value, onChange, min, max, label }) => {
    const increment = () => {
      onChange(value < max ? value + 1 : value);
    };

    const decrement = () => {
      onChange(value > min ? value - 1 : value);
    };

    return (
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>{label}</Text>
        <View style={styles.selectorControls}>
          <Pressable onPress={decrement} style={styles.selectorButton}>
            <Text style={styles.selectorButtonText}>−</Text>
          </Pressable>
          <View style={styles.selectorValue}>
            <Text style={styles.selectorValueText}>{value}</Text>
          </View>
          <Pressable onPress={increment} style={styles.selectorButton}>
            <Text style={styles.selectorButtonText}>+</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text h3 style={styles.title}>Age Verification</Text>
        <Text style={styles.subtitle}>
          You must be 21 or older to use this application.
          Please verify your age to continue.
        </Text>

        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>Your Date of Birth:</Text>
          <View style={styles.selectors}>
            <NumberSelector
              value={month}
              onChange={setMonth}
              min={1}
              max={12}
              label="Month"
            />
            <NumberSelector
              value={day}
              onChange={setDay}
              min={1}
              max={31}
              label="Day"
            />
            <NumberSelector
              value={year}
              onChange={setYear}
              min={1900}
              max={new Date().getFullYear()}
              label="Year"
            />
          </View>
        </View>

        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimer}>
            By continuing, you confirm that you are of legal age to use cannabis
            products in your jurisdiction and agree to our Terms of Service.
          </Text>
        </View>

        <Button
          title="Verify Age"
          onPress={handleVerification}
          loading={isLoading}
          disabled={isLoading}
          containerStyle={styles.verifyButtonContainer}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 20,
    justifyContent: 'center',
    minHeight: '100%',
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
  dateContainer: {
    marginBottom: 30,
  },
  dateLabel: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
  },
  selectors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  selectorContainer: {
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  selectorLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  selectorControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  selectorButton: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
  },
  selectorButtonText: {
    fontSize: 18,
    color: '#333',
  },
  selectorValue: {
    paddingHorizontal: 10,
    minWidth: 40,
    alignItems: 'center',
  },
  selectorValueText: {
    fontSize: 16,
    color: '#333',
  },
  disclaimerContainer: {
    marginVertical: 20,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  disclaimer: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  verifyButtonContainer: {
    marginTop: 20,
  },
});

export default AgeVerification;