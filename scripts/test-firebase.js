// scripts/test-firebase.js
require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Test Firebase connection
const testFirebaseConnection = async () => {
  try {
    console.log('Attempting to connect to Firebase...');
    console.log('Using project ID:', process.env.FIREBASE_PROJECT_ID);
    
    // Initialize Firebase for this test
    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    
    // Try to fetch a test collection
    const querySnapshot = await getDocs(collection(firestore, 'test'));
    console.log('Firebase connection successful!');
    console.log(`Retrieved ${querySnapshot.size} documents from test collection`);
    return true;
  } catch (error) {
    console.error('Firebase connection error:', error);
    return false;
  }
};

// Run the test
const runTest = async () => {
  console.log('Testing Firebase connection...');
  
  try {
    const result = await testFirebaseConnection();
    
    if (result) {
      console.log('✅ Firebase connection test passed!');
      console.log('Your Firebase configuration is working correctly.');
    } else {
      console.log('❌ Firebase connection test failed!');
      console.log('Please check your Firebase configuration and credentials.');
    }
  } catch (error) {
    console.error('Error running test:', error);
  }
  
  // Exit the process after test completes
  process.exit(0);
};

// Execute the test
runTest(); 