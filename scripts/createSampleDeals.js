const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp
} = require('firebase/firestore');

// Import the Firebase configuration from a local file
// Create this file with your Firebase config
const firebaseConfig = require('./firebase-config.js');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('Firebase initialized with project:', firebaseConfig.projectId);

// Sample vendor IDs - replace with actual vendor IDs from your database
const vendorIds = [
  "10001", "10002", "10003", "10004", "10005", 
  "10006", "10007", "10008", "10009", "10010",
  "10037" // ARCTIC HERBERY from the logs
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

// Function to create a daily deal
const createDailyDeal = async (day, index) => {
  const deal = {
    title: dailyDealTitles[index],
    description: getRandomItem(dealDescriptions),
    dealType: 'daily',
    day: day.toLowerCase(),
    isActive: true,
    discount: Math.floor(Math.random() * 30) + 10, // Random discount between 10-40%
    vendorId: getRandomItem(vendorIds),
    createdAt: new Date(),
    updatedAt: new Date(),
    terms: "Cannot be combined with other offers. Valid ID required.",
    imageUrl: `https://example.com/images/deals/daily_${index + 1}.jpg`
  };

  try {
    const docRef = await addDoc(collection(db, "deals"), deal);
    console.log(`Daily deal for ${day} created with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("Error creating daily deal:", error);
    return null;
  }
};

// Function to create a birthday deal
const createBirthdayDeal = async (index) => {
  const deal = {
    title: birthdayDealTitles[index],
    description: getRandomItem(dealDescriptions),
    dealType: 'birthday',
    isActive: true,
    discount: Math.floor(Math.random() * 30) + 20, // Random discount between 20-50%
    vendorId: getRandomItem(vendorIds),
    createdAt: new Date(),
    updatedAt: new Date(),
    terms: "Valid during birthday month. Must show valid ID.",
    imageUrl: `https://example.com/images/deals/birthday_${index + 1}.jpg`
  };

  try {
    const docRef = await addDoc(collection(db, "deals"), deal);
    console.log(`Birthday deal created with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("Error creating birthday deal:", error);
    return null;
  }
};

// Function to create an everyday deal
const createEverydayDeal = async (index) => {
  const deal = {
    title: everydayDealTitles[index],
    description: getRandomItem(dealDescriptions),
    dealType: 'everyday',
    isActive: true,
    discount: Math.floor(Math.random() * 15) + 5, // Random discount between 5-20%
    vendorId: getRandomItem(vendorIds),
    createdAt: new Date(),
    updatedAt: new Date(),
    terms: "Available every day. Some restrictions may apply.",
    imageUrl: `https://example.com/images/deals/everyday_${index + 1}.jpg`
  };

  try {
    const docRef = await addDoc(collection(db, "deals"), deal);
    console.log(`Everyday deal created with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("Error creating everyday deal:", error);
    return null;
  }
};

// Function to create a special deal
const createSpecialDeal = async (index) => {
  // Random end date between 1 and 3 months from now
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + Math.floor(Math.random() * 3) + 1);

  const deal = {
    title: specialDealTitles[index],
    description: getRandomItem(dealDescriptions),
    dealType: 'special',
    isActive: true,
    discount: Math.floor(Math.random() * 25) + 15, // Random discount between 15-40%
    vendorId: getRandomItem(vendorIds),
    createdAt: new Date(),
    updatedAt: new Date(),
    startDate: new Date(),
    endDate: endDate,
    terms: "Limited time offer. While supplies last.",
    imageUrl: `https://example.com/images/deals/special_${index + 1}.jpg`
  };

  try {
    const docRef = await addDoc(collection(db, "deals"), deal);
    console.log(`Special deal created with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("Error creating special deal:", error);
    return null;
  }
};

// Function to clear existing deals (optional)
const clearExistingDeals = async () => {
  try {
    console.log("Clearing existing deals...");
    const dealsRef = collection(db, "deals");
    const snapshot = await getDocs(dealsRef);
    
    let deletedCount = 0;
    for (const doc of snapshot.docs) {
      await deleteDoc(doc.ref);
      deletedCount++;
    }
    
    console.log(`Deleted ${deletedCount} existing deals`);
  } catch (error) {
    console.error("Error clearing deals:", error);
  }
};

// Main function to create all sample deals
const createSampleDeals = async () => {
  try {
    // Uncomment the next line if you want to clear existing deals first
    // await clearExistingDeals();
    
    console.log("Creating sample deals...");
    
    // Create 7 daily deals (one for each day)
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for (let i = 0; i < days.length; i++) {
      await createDailyDeal(days[i], i);
    }
    
    // Create 6 birthday deals
    for (let i = 0; i < 6; i++) {
      await createBirthdayDeal(i);
    }
    
    // Create 4 everyday deals
    for (let i = 0; i < 4; i++) {
      await createEverydayDeal(i);
    }
    
    // Create 3 special deals
    for (let i = 0; i < 3; i++) {
      await createSpecialDeal(i);
    }
    
    console.log("Sample deals creation completed!");
  } catch (error) {
    console.error("Error creating sample deals:", error);
  }
};

// Run the script
createSampleDeals()
  .then(() => {
    console.log("Script execution completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script execution failed:", error);
    process.exit(1);
  }); 