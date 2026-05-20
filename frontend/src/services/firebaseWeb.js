/**
 * Firebase Web SDK Service (STUB)
 * 
 * This module provides a Firebase interface for the web dashboard.
 * When Firebase SDK is NOT installed, all methods return safe defaults.
 * 
 * To enable Firebase web features:
 *   cd frontend && npm install firebase
 * 
 * Then set env vars:
 *   VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, etc.
 * 
 * Without Firebase, the app works 100% normally via the Express API.
 * Firebase is ONLY needed for the read-only web dashboard deployment.
 */

let initialized = false;
let firebaseAvailable = false;

/**
 * Initialize Firebase (no-op if not installed or not configured)
 */
async function initializeFirebase() {
  if (initialized) return firebaseAvailable;
  initialized = true;
  
  // Check if Firebase config is provided via env vars
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.log('[FirebaseWeb] No VITE_FIREBASE_PROJECT_ID set - Firebase disabled');
    console.log('[FirebaseWeb] App will use Express API (normal mode)');
    return false;
  }
  
  try {
    // Dynamic import with @vite-ignore to prevent build-time resolution
    const firebaseApp = await import(/* @vite-ignore */ 'firebase/app');
    const firebaseFirestore = await import(/* @vite-ignore */ 'firebase/firestore');
    
    const config = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
    
    const app = firebaseApp.initializeApp(config);
    firebaseFirestore.getFirestore(app);
    firebaseAvailable = true;
    console.log(`[FirebaseWeb] Connected to project: ${projectId}`);
    return true;
  } catch (err) {
    console.log('[FirebaseWeb] Firebase SDK not available:', err.message);
    console.log('[FirebaseWeb] To enable: cd frontend && npm install firebase');
    return false;
  }
}

function isAvailable() {
  return firebaseAvailable;
}

// All methods return safe defaults when Firebase is not available
async function getDoc() { return null; }
async function getCollection() { return []; }
async function getDailySummaries() { return []; }
async function getTodaySummary() { return null; }
async function getDailyEntry() { return null; }
async function getDenomination() { return null; }
async function getRecentSummaries() { return []; }
async function onDocSnapshot() { return () => {}; }
async function onCollectionSnapshot() { return () => {}; }

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
