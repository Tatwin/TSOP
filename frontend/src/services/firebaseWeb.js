/**
 * Firebase Web SDK Service
 * Used by the WEB DASHBOARD (not the desktop app) to read data from Firestore
 * 
 * This is READ-ONLY access to the cloud mirror.
 * All writes happen on the desktop app → sync service → Firestore
 * 
 * Setup:
 * 1. Create a Firebase project
 * 2. Enable Firestore
 * 3. Copy your web app config to VITE_FIREBASE_* env variables
 * 
 * Environment variables (set in .env or Vercel):
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_STORAGE_BUCKET
 *   VITE_FIREBASE_MESSAGING_SENDER_ID
 *   VITE_FIREBASE_APP_ID
 */

// Firebase Web SDK (v9+ modular)
let firebaseApp = null;
let firestoreDb = null;
let initialized = false;

/**
 * Dynamically initialize Firebase (only when needed, not on every page load)
 */
async function initializeFirebase() {
  if (initialized) return true;
  
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
  
  // If no config, Firebase is not set up
  if (!config.apiKey || !config.projectId) {
    console.log('[FirebaseWeb] No config found - web dashboard will use Express API');
    return false;
  }
  
  try {
    const { initializeApp } = await import('firebase/app');
    const { getFirestore } = await import('firebase/firestore');
    
    firebaseApp = initializeApp(config);
    firestoreDb = getFirestore(firebaseApp);
    initialized = true;
    
    console.log(`[FirebaseWeb] Connected to project: ${config.projectId}`);
    return true;
  } catch (err) {
    console.error('[FirebaseWeb] Init failed:', err.message);
    return false;
  }
}

/**
 * Check if Firebase web is available
 */
function isAvailable() {
  return initialized && firestoreDb !== null;
}

/**
 * Get a single document from Firestore
 */
async function getDoc(collectionName, docId) {
  if (!isAvailable()) return null;
  
  try {
    const { doc, getDoc: getDocument } = await import('firebase/firestore');
    const docRef = doc(firestoreDb, collectionName, docId);
    const docSnap = await getDocument(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (err) {
    console.error(`[FirebaseWeb] getDoc ${collectionName}/${docId}:`, err.message);
    return null;
  }
}

/**
 * Get multiple documents from a collection with optional ordering
 */
async function getCollection(collectionName, options = {}) {
  if (!isAvailable()) return [];
  
  try {
    const { collection, getDocs, query, orderBy, limit, where } = await import('firebase/firestore');
    
    let q = collection(firestoreDb, collectionName);
    const constraints = [];
    
    if (options.orderByField) {
      constraints.push(orderBy(options.orderByField, options.orderDirection || 'desc'));
    }
    if (options.limit) {
      constraints.push(limit(options.limit));
    }
    if (options.where) {
      constraints.push(where(options.where.field, options.where.op, options.where.value));
    }
    
    if (constraints.length > 0) {
      q = query(q, ...constraints);
    } else {
      q = query(q);
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error(`[FirebaseWeb] getCollection ${collectionName}:`, err.message);
    return [];
  }
}

/**
 * Get daily summaries for a date range (for analytics)
 */
async function getDailySummaries(startDate, endDate) {
  if (!isAvailable()) return [];
  
  try {
    const { collection, getDocs, query, where, orderBy } = await import('firebase/firestore');
    
    const q = query(
      collection(firestoreDb, 'dailySummaries'),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('[FirebaseWeb] getDailySummaries:', err.message);
    return [];
  }
}

/**
 * Get today's summary
 */
async function getTodaySummary() {
  const today = new Date().toISOString().split('T')[0];
  return getDoc('dailySummaries', today);
}

/**
 * Get daily entries for a specific date (full detail)
 */
async function getDailyEntry(date) {
  return getDoc('dailyEntries', date);
}

/**
 * Get denomination for a date
 */
async function getDenomination(date) {
  return getDoc('denominations', date);
}

/**
 * Get latest N daily summaries (for dashboard)
 */
async function getRecentSummaries(days = 30) {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  return getDailySummaries(startDate, endDate);
}

/**
 * Listen for real-time updates on a document (for live dashboard)
 * Returns an unsubscribe function
 */
async function onDocSnapshot(collectionName, docId, callback) {
  if (!isAvailable()) return () => {};
  
  try {
    const { doc, onSnapshot } = await import('firebase/firestore');
    const docRef = doc(firestoreDb, collectionName, docId);
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() });
      } else {
        callback(null);
      }
    });
  } catch (err) {
    console.error(`[FirebaseWeb] onDocSnapshot:`, err.message);
    return () => {};
  }
}

/**
 * Listen for real-time updates on a collection query
 */
async function onCollectionSnapshot(collectionName, options, callback) {
  if (!isAvailable()) return () => {};
  
  try {
    const { collection, query, orderBy, limit, onSnapshot } = await import('firebase/firestore');
    
    const constraints = [];
    if (options.orderByField) constraints.push(orderBy(options.orderByField, options.orderDirection || 'desc'));
    if (options.limit) constraints.push(limit(options.limit));
    
    const q = query(collection(firestoreDb, collectionName), ...constraints);
    
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(docs);
    });
  } catch (err) {
    console.error(`[FirebaseWeb] onCollectionSnapshot:`, err.message);
    return () => {};
  }
}

export default {
  initializeFirebase,
  isAvailable,
  getDoc,
  getCollection,
  getDailySummaries,
  getTodaySummary,
  getDailyEntry,
  getDenomination,
  getRecentSummaries,
  onDocSnapshot,
  onCollectionSnapshot
};
