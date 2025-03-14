/**
 * Script to add deals to Firestore using admin credentials
 * 
 * This script temporarily references admin credentials from your admin project
 * to add deals to your Firestore database with proper permissions.
 * 
 * Run with: node addDealsScript.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Configuration options - adjust these to match your environment
const CONFIG = {
  // Path to your admin project's service account file
  serviceAccountPath: 'C:\\Dev2025\\loots-data-services\\config\\service-accounts\\service-account.json',
  
  // Alternative: Direct path to your admin project folder (fallback)
  adminProjectPath: 'C:\\Dev2025\\loots-data-services',
  
  // Firestore collection to add deals to
  dealsCollection: 'deals',
  
  // Database URL (optional - if your admin credentials don't already specify this)
  databaseURL: 'https://loots-ganja-guide.firebaseio.com'
};

// Real vendor IDs from the database
const vendorIds = [
  "10933", "10975", "11383", "11411", "11547", 
  "11614", "11638", "11731", "11966", "12316",
  "12437", "12768", "14083", "14359", "15016", 
  "15019", "16610", "17480", "18117", "18702",
  "20151", "20366", "20865", "20983", "21724"
];

// Sample deal titles
const dailyDealTitles = [
  "Monday Madness: 20% Off All Edibles",
  "Tuesday Tokes: Buy One Get One 50% Off",
  "Wednesday Wellness: 15% Off CBD Products",
  "Thursday Thrills: $5 Off Any Purchase",
  "Friday Frenzy: Free Pre-roll with $50 Purchase",
  "Saturday Special: 25% Off Concentrates",
  "Sunday Funday: 10% Off Storewide"
];

const birthdayDealTitles = [
  "Birthday Bliss: Free Pre-roll",
  "Birthday Bonanza: 30% Off Any Item",
  "Birthday Bash: Buy One Get One Free",
  "Birthday Blaze: Free Edible with Purchase",
  "Birthday Bundle: 25% Off Any Purchase",
  "Birthday Bonus: Double Points on Purchase"
];

const everydayDealTitles = [
  "Daily Delight: 10% Off for First-Time Customers",
  "Everyday Essential: 15% Off for Veterans",
  "Regular Reward: 5% Off for Loyalty Members",
  "Constant Combo: Buy 3 Get 1 Free"
];

const specialDealTitles = [
  "Summer Sizzle: 20% Off Outdoor Accessories",
  "4/20 Celebration: Special Bundle Deals",
  "Holiday High: Festive Discounts on Selected Items"
];

// Sample deal descriptions
const dealDescriptions = [
  "Limited time offer! Don't miss out on these amazing savings.",
  "Exclusive deal for our valued customers. Show this offer at checkout.",
  "One of our most popular promotions. Restrictions may apply.",
  "A customer favorite! Available while supplies last.",
  "The perfect opportunity to try something new at a great price.",
  "Our way of saying thank you for your continued support."
];

// Function to get a random item from an array
const getRandomItem = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

/**
 * Initialize Firebase Admin SDK with the service account credentials
 * This function tries multiple approaches to find and use your admin credentials
 */
function initializeAdminSDK() {
  let serviceAccount;
  
  try {
    // Approach 1: Try direct path to service account file
    if (fs.existsSync(CONFIG.serviceAccountPath)) {
      console.log(`Using service account from: ${CONFIG.serviceAccountPath}`);
      serviceAccount = require(path.resolve(CONFIG.serviceAccountPath));
    }
    // Approach 2: Try to find service account file in admin project
    else if (fs.existsSync(CONFIG.adminProjectPath)) {
      // Common filenames for service account credentials
      const possibleCredentialFiles = [
        'serviceAccountKey.json',
        'service-account.json',
        'firebase-adminsdk.json'
      ];
      
      for (const filename of possibleCredentialFiles) {
        const filePath = path.join(CONFIG.adminProjectPath, filename);
        if (fs.existsSync(filePath)) {
          console.log(`Found credentials at: ${filePath}`);
          serviceAccount = require(path.resolve(filePath));
          break;
        }
      }
    }
    
    // Initialize Firebase Admin with the service account
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: CONFIG.databaseURL
      });
      console.log('Firebase Admin SDK initialized successfully');
      return true;
    } else {
      console.error('Could not find service account credentials');
      console.log('Please update CONFIG.serviceAccountPath in the script');
      return false;
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    return false;
  }
}

/**
 * Create a daily deal for a specific day
 * @param {string} day - Day of the week
 * @param {number} index - Index for title selection
 * @returns {Object} - Deal object
 */
function createDailyDeal(day, index) {
  // Use modulo to cycle through vendor IDs
  const vendorIndex = index % vendorIds.length;
  // Ensure we have a valid discount value
  const discountValue = Math.max(Math.floor(Math.random() * 30) + 10, 10); // Minimum 10% discount
  
  return {
    title: dailyDealTitles[index],
    description: getRandomItem(dealDescriptions),
    dealType: 'daily',
    day: day.toLowerCase(),
    isActive: true,
    discount: `${discountValue}%`, // Format as string with percentage
    vendorId: vendorIds[vendorIndex],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    terms: "Cannot be combined with other offers. Valid ID required.",
    imageUrl: `https://example.com/images/deals/daily_${index + 1}.jpg`
  };
}

/**
 * Create a birthday deal
 * @param {number} index - Index for title selection
 * @returns {Object} - Deal object
 */
function createBirthdayDeal(index) {
  // Use modulo to cycle through vendor IDs, offset by 7 to use different vendors than daily deals
  const vendorIndex = (index + 7) % vendorIds.length;
  // Ensure we have a valid discount value
  const discountValue = Math.max(Math.floor(Math.random() * 30) + 20, 15); // Minimum 15% discount
  
  return {
    title: birthdayDealTitles[index],
    description: getRandomItem(dealDescriptions),
    dealType: 'birthday',
    isActive: true,
    discount: `${discountValue}%`, // Format as string with percentage
    vendorId: vendorIds[vendorIndex],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    terms: "Valid during birthday month. Must show valid ID.",
    imageUrl: `https://example.com/images/deals/birthday_${index + 1}.jpg`
  };
}

/**
 * Create an everyday deal
 * @param {number} index - Index for title selection
 * @returns {Object} - Deal object
 */
function createEverydayDeal(index) {
  // Use modulo to cycle through vendor IDs, offset by 13 to use different vendors
  const vendorIndex = (index + 13) % vendorIds.length;
  // Ensure we have a valid discount value
  const discountValue = Math.max(Math.floor(Math.random() * 15) + 5, 5); // Minimum 5% discount
  
  return {
    title: everydayDealTitles[index],
    description: getRandomItem(dealDescriptions),
    dealType: 'everyday',
    isActive: true,
    discount: `${discountValue}%`, // Format as string with percentage
    vendorId: vendorIds[vendorIndex],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    terms: "Available every day. Some restrictions may apply.",
    imageUrl: `https://example.com/images/deals/everyday_${index + 1}.jpg`
  };
}

/**
 * Create a special deal
 * @param {number} index - Index for title selection
 * @returns {Object} - Deal object
 */
function createSpecialDeal(index) {
  // Random end date between 1 and 3 months from now
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + Math.floor(Math.random() * 3) + 1);

  // Use modulo to cycle through vendor IDs, offset by 17 to use different vendors
  const vendorIndex = (index + 17) % vendorIds.length;
  // Ensure we have a valid discount value
  const discountValue = Math.max(Math.floor(Math.random() * 25) + 15, 15); // Minimum 15% discount
  
  return {
    title: specialDealTitles[index],
    description: getRandomItem(dealDescriptions),
    dealType: 'special',
    isActive: true,
    discount: `${discountValue}%`, // Format as string with percentage
    vendorId: vendorIds[vendorIndex],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startDate: new Date().toISOString(),
    endDate: endDate.toISOString(),
    terms: "Limited time offer. While supplies last.",
    imageUrl: `https://example.com/images/deals/special_${index + 1}.jpg`
  };
}

/**
 * Create a multi-day deal
 * @param {number} index - Index for identification
 * @param {string[]} days - Array of days this deal is active
 * @returns {Object} - Deal object
 */
function createMultiDayDeal(index, days) {
  // Use a different set of vendors for multi-day deals
  const vendorIndex = (index + 5) % vendorIds.length;
  
  // Ensure discount is never undefined - use a default of 10 if calculation results in 0
  const discountValue = Math.max(index * 5, 10);
  
  return {
    title: `Multi-day Deal #${index}`,
    description: `This deal is valid on ${days.join(' and ')}`,
    dealType: 'multi_day',
    activeDays: days,
    isActive: true,
    discount: `${discountValue}%`, // Format as string with percentage
    redemptionFrequency: 'once_per_day',
    restrictions: index % 2 === 0 ? ['Limit one per customer'] : [],
    vendorId: vendorIds[vendorIndex],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    terms: "Valid only on specified days. Cannot be combined with other offers.",
    imageUrl: `https://example.com/images/deals/multi_day_${index}.jpg`
  };
}

/**
 * Add all sample deals to Firestore
 */
async function addSampleDeals() {
  const db = admin.firestore();
  const batch = db.batch();
  let dealCount = 0;
  
  // Get current day and tomorrow
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const today = new Date();
  const currentDay = days[today.getDay()];
  const tomorrowDay = days[(today.getDay() + 1) % 7];
  
  console.log(`\n=== Creating Deals for ${currentDay} and ${tomorrowDay} ===`);
  console.log("Using Vendor IDs:", vendorIds.join(", ").substring(0, 100) + "...");
  console.log("=================================================\n");
  
  // Create 1 birthday deal
  const birthdayDeal = createBirthdayDeal(0);
  batch.set(db.collection(CONFIG.dealsCollection).doc(), birthdayDeal);
  console.log(`Added birthday deal "${birthdayDeal.title}" (Vendor ID: ${birthdayDeal.vendorId})`);
  dealCount++;
  
  // Create 1 everyday deal
  const everydayDeal = createEverydayDeal(0);
  batch.set(db.collection(CONFIG.dealsCollection).doc(), everydayDeal);
  console.log(`Added everyday deal "${everydayDeal.title}" (Vendor ID: ${everydayDeal.vendorId})`);
  dealCount++;
  
  // Create 1 special deal
  const specialDeal = createSpecialDeal(0);
  batch.set(db.collection(CONFIG.dealsCollection).doc(), specialDeal);
  console.log(`Added special deal "${specialDeal.title}" (Vendor ID: ${specialDeal.vendorId})`);
  dealCount++;
  
  // Create 10 daily deals for today
  console.log(`\nCreating 10 daily deals for ${currentDay}:`);
  for (let i = 0; i < 10; i++) {
    const deal = createDailyDeal(currentDay, i % 7); // Use modulo to cycle through titles
    const dealRef = db.collection(CONFIG.dealsCollection).doc();
    batch.set(dealRef, deal);
    console.log(`  Added daily deal "${deal.title}" (Vendor ID: ${deal.vendorId})`);
    dealCount++;
  }
  
  // Create 10 multi-day deals for today and tomorrow
  console.log(`\nCreating 10 multi-day deals for ${currentDay} and ${tomorrowDay}:`);
  for (let i = 1; i <= 10; i++) {
    const deal = createMultiDayDeal(i, [currentDay, tomorrowDay]);
    const dealRef = db.collection(CONFIG.dealsCollection).doc();
    batch.set(dealRef, deal);
    console.log(`  Added multi-day deal "${deal.title}" (Vendor ID: ${deal.vendorId})`);
    dealCount++;
  }
  
  // Commit the batch
  try {
    await batch.commit();
    console.log(`\nSuccessfully added ${dealCount} deals to Firestore`);
  } catch (error) {
    console.error('Error adding deals:', error);
  }
}

/**
 * Function to clear existing deals (optional)
 */
async function clearExistingDeals() {
  try {
    console.log("Clearing existing deals...");
    const db = admin.firestore();
    const dealsRef = db.collection(CONFIG.dealsCollection);
    const snapshot = await dealsRef.get();
    
    if (snapshot.empty) {
      console.log("No existing deals to delete");
      return;
    }
    
    let deletedCount = 0;
    const batchSize = 500; // Firestore batch size limit
    let batch = db.batch();
    let currentBatchSize = 0;
    
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      deletedCount++;
      currentBatchSize++;
      
      // If we reach batch size limit, commit and create a new batch
      if (currentBatchSize >= batchSize) {
        await batch.commit();
        console.log(`Deleted ${currentBatchSize} deals in batch`);
        batch = db.batch();
        currentBatchSize = 0;
      }
    }
    
    // Commit any remaining deletes
    if (currentBatchSize > 0) {
      await batch.commit();
      console.log(`Deleted ${currentBatchSize} deals in final batch`);
    }
    
    console.log(`Deleted ${deletedCount} existing deals`);
  } catch (error) {
    console.error("Error clearing deals:", error);
  }
}

// Initialize Firebase Admin SDK
let app;
try {
  // Try to load the service account file
  const serviceAccount = require(CONFIG.serviceAccountPath);
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: CONFIG.databaseURL
  });
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
  process.exit(1);
}

const db = admin.firestore();
const dealsCollection = db.collection(CONFIG.dealsCollection);

// Function to delete all existing deals
async function deleteAllDeals() {
  console.log('\n=== Deleting all existing deals ===');
  
  try {
    // Get all deals
    const snapshot = await dealsCollection.get();
    
    if (snapshot.empty) {
      console.log('No existing deals found to delete.');
      return;
    }
    
    console.log(`Found ${snapshot.size} existing deals to delete.`);
    
    // Log some information about the deals being deleted
    let dealsByVendor = {};
    let dealsByType = {
      'daily': 0,
      'birthday': 0,
      'everyday': 0,
      'special': 0,
      'other': 0
    };
    
    snapshot.forEach(doc => {
      const deal = doc.data();
      
      // Count by vendor
      if (deal.vendorId) {
        dealsByVendor[deal.vendorId] = (dealsByVendor[deal.vendorId] || 0) + 1;
      }
      
      // Count by type
      if (deal.dealType && dealsByType.hasOwnProperty(deal.dealType)) {
        dealsByType[deal.dealType]++;
      } else {
        dealsByType.other++;
      }
    });
    
    // Log vendor summary
    console.log('\nDeals by vendor:');
    Object.keys(dealsByVendor).forEach(vendorId => {
      console.log(`  Vendor ${vendorId}: ${dealsByVendor[vendorId]} deals`);
    });
    
    // Log type summary
    console.log('\nDeals by type:');
    Object.keys(dealsByType).forEach(type => {
      if (dealsByType[type] > 0) {
        console.log(`  ${type}: ${dealsByType[type]} deals`);
      }
    });
    
    // Delete each deal
    const deletePromises = [];
    snapshot.forEach(doc => {
      deletePromises.push(dealsCollection.doc(doc.id).delete());
    });
    
    await Promise.all(deletePromises);
    console.log(`\nSuccessfully deleted ${deletePromises.length} existing deals.`);
    console.log('=== Deletion complete ===\n');
  } catch (error) {
    console.error('Error deleting deals:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log("Starting deal creation process...");
    
    // First delete all existing deals - ensure this runs every time
    console.log("Clearing existing deals database...");
    await deleteAllDeals();
    
    // Then add new deals with correct vendor IDs
    await addSampleDeals();
    
    console.log('Script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main(); 