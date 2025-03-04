// src/repositories/index.js
import { firestore, serverTimestamp, increment, auth } from '../config/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  startAt,
  endAt,
  addDoc
} from 'firebase/firestore';
import { Logger, LogCategory } from '../services/LoggingService';

/**
 * Base repository class for Firebase Firestore operations
 * Provides common CRUD operations for all repositories
 */
export class BaseRepository {
  /**
   * Constructor for the BaseRepository
   * @param {string} collectionName - The name of the Firestore collection
   */
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.collectionRef = collection(firestore, collectionName);
  }

  /**
   * Get a document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object|null>} - Document data or null if not found
   */
  async getById(id) {
    try {
      const docRef = doc(this.collectionRef, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        Logger.info(LogCategory.DATABASE, `No document found with ID: ${id} in ${this.collectionName}`);
        return null;
      }
    } catch (error) {
      Logger.error(LogCategory.DATABASE, `Error getting document with ID: ${id}`, { error });
      throw error;
    }
  }

  /**
   * Create a new document
   * @param {Object} data - Document data
   * @param {string} [id] - Optional document ID (will be auto-generated if not provided)
   * @returns {Promise<string>} - Document ID
   */
  async create(data, id = null) {
    try {
      // Add timestamps
      const dataWithTimestamp = {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      let docRef;
      
      if (id) {
        // Use provided ID
        docRef = doc(this.collectionRef, id);
        await setDoc(docRef, dataWithTimestamp);
      } else {
        // Auto-generate ID
        docRef = await addDoc(this.collectionRef, dataWithTimestamp);
      }
      
      Logger.info(LogCategory.DATABASE, `Created document in ${this.collectionName}`, { id: docRef.id });
      return docRef.id;
    } catch (error) {
      Logger.error(LogCategory.DATABASE, `Error creating document in ${this.collectionName}`, { error, data });
      throw error;
    }
  }

  /**
   * Update an existing document
   * @param {string} id - Document ID
   * @param {Object} data - Document data to update
   * @returns {Promise<void>}
   */
  async update(id, data) {
    try {
      const docRef = doc(this.collectionRef, id);
      
      // Add updated timestamp
      const dataWithTimestamp = {
        ...data,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(docRef, dataWithTimestamp);
      Logger.info(LogCategory.DATABASE, `Updated document in ${this.collectionName}`, { id });
      
      return id;
    } catch (error) {
      Logger.error(LogCategory.DATABASE, `Error updating document in ${this.collectionName}`, { error, id, data });
      throw error;
    }
  }

  /**
   * Delete a document
   * @param {string} id - Document ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    try {
      const docRef = doc(this.collectionRef, id);
      await deleteDoc(docRef);
      Logger.info(LogCategory.DATABASE, `Deleted document from ${this.collectionName}`, { id });
    } catch (error) {
      Logger.error(LogCategory.DATABASE, `Error deleting document from ${this.collectionName}`, { error, id });
      throw error;
    }
  }

  /**
   * Get all documents in the collection with optional filtering
   * @param {Object} options - Query options
   * @param {Array<Array<string,string,any>>} [options.filters] - Array of filter conditions [field, operator, value]
   * @param {Array<Array<string,string>>} [options.sorting] - Array of sorting conditions [field, direction]
   * @param {number} [options.limitCount] - Maximum number of documents to return
   * @param {Object} [options.startAfterDoc] - Document to start after (for pagination)
   * @returns {Promise<Array<Object>>} - Array of documents
   */
  async getAll(options = {}) {
    try {
      let q = this.collectionRef;
      
      // Apply filters if provided
      if (options.filters && options.filters.length > 0) {
        options.filters.forEach(filter => {
          const [field, operator, value] = filter;
          q = query(q, where(field, operator, value));
        });
      }
      
      // Apply sorting if provided
      if (options.sorting && options.sorting.length > 0) {
        options.sorting.forEach(sort => {
          const [field, direction] = sort;
          q = query(q, orderBy(field, direction));
        });
      }
      
      // Apply pagination if starting point provided
      if (options.startAfterDoc) {
        q = query(q, startAfter(options.startAfterDoc));
      }
      
      // Apply limit if provided
      if (options.limitCount && options.limitCount > 0) {
        q = query(q, limit(options.limitCount));
      }
      
      const querySnapshot = await getDocs(q);
      const documents = [];
      
      querySnapshot.forEach(doc => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      
      Logger.info(LogCategory.DATABASE, `Retrieved ${documents.length} documents from ${this.collectionName}`);
      return documents;
    } catch (error) {
      Logger.error(LogCategory.DATABASE, `Error getting documents from ${this.collectionName}`, { error, options });
      throw error;
    }
  }

  /**
   * Get the current user ID from Firebase Auth
   * @returns {string|null} - Current user ID or null if not authenticated
   */
  getCurrentUserId() {
    const currentUser = auth.currentUser;
    return currentUser ? currentUser.uid : null;
  }

  /**
   * Utility to convert Firestore timestamps to ISO strings for client consumption
   * @param {Object} document - Document with potential timestamp fields
   * @returns {Object} - Document with timestamps converted to ISO strings
   */
  normalizeTimestamps(document) {
    if (!document) return document;
    
    const normalized = { ...document };
    
    // Check common timestamp fields
    const timestampFields = ['createdAt', 'updatedAt', 'timestamp', 'lastUpdated', 'startDate', 'endDate'];
    
    for (const field of timestampFields) {
      if (normalized[field] && typeof normalized[field].toDate === 'function') {
        normalized[field] = normalized[field].toDate().toISOString();
      }
    }
    
    return normalized;
  }
}

// Export specific repositories
export { default as VendorRepository } from './VendorRepository';
export { default as DealRepository } from './DealRepository';
export { default as UserRepository } from './UserRepository';
export { default as JourneyRepository } from './JourneyRepository';