// src/utils/firebaseTest.js
import { firestore } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

/**
 * Test function to verify Firebase connection
 * @returns {Promise<boolean>} True if connection is successful, false otherwise
 */
const testFirebaseConnection = async () => {
  try {
    // Try to fetch a non-existent collection just to test connection
    const querySnapshot = await getDocs(collection(firestore, 'test'));
    console.log('Firebase connection successful!');
    console.log(`Retrieved ${querySnapshot.size} documents from test collection`);
    return true;
  } catch (error) {
    console.error('Firebase connection error:', error);
    return false;
  }
};

export { testFirebaseConnection }; 