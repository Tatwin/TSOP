/**
 * Firebase Configuration for TASMAC POS
 * 
 * This module handles Firebase initialization for cloud sync.
 * The app works 100% offline - Firebase is OPTIONAL for web dashboard access.
 * 
 * Setup: Place your Firebase service account JSON at:
 *   electron/src/firebase/serviceAccount.json
 * 
 * Or set environment variable: FIREBASE_SERVICE_ACCOUNT_PATH
 */
const path = require('path');
const fs = require('fs');

let firebaseApp = null;
let firestoreDb = null;
let initialized = false;

/**
 * Initialize Firebase Admin SDK
 * Returns false if Firebase is not configured (app works without it)
 */
function initialize() {
  try {
    // Check for service account file
    const serviceAccountPaths = [
      path.join(__dirname, 'serviceAccount.json'),
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      path.join(process.cwd(), 'firebase-service-account.json')
    ].filter(Boolean);
    
    let serviceAccountPath = null;
    for (const p of serviceAccountPaths) {
      if (p && fs.existsSync(p)) {
        serviceAccountPath = p;
        break;
      }
    }
    
    if (!serviceAccountPath) {
      console.log('[Firebase] No service account found. Cloud sync disabled.');
      console.log('[Firebase] Place serviceAccount.json in electron/src/firebase/ to enable sync.');
      return false;
    }
    
    const admin = require('firebase-admin');
    const serviceAccount = require(serviceAccountPath);
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    
    firestoreDb = admin.firestore();
    initialized = true;
    
    console.log(`[Firebase] Initialized with project: ${serviceAccount.project_id}`);
    return true;
  } catch (err) {
    console.error('[Firebase] Initialization failed:', err.message);
    console.log('[Firebase] App will continue in offline-only mode.');
    return false;
  }
}

/**
 * Get Firestore instance
 */
function getFirestore() {
  if (!initialized || !firestoreDb) return null;
  return firestoreDb;
}

/**
 * Check if Firebase is available
 */
function isAvailable() {
  return initialized && firestoreDb !== null;
}

/**
 * Sync a document to Firestore
 */
async function syncDocument(collection, docId, data) {
  if (!isAvailable()) return false;
  
  try {
    await firestoreDb.collection(collection).doc(docId).set(data, { merge: true });
    return true;
  } catch (err) {
    console.error(`[Firebase] Sync failed for ${collection}/${docId}:`, err.message);
    return false;
  }
}

/**
 * Sync daily entry to Firestore (for web dashboard)
 */
async function syncDailyEntry(date, data) {
  return syncDocument('dailyEntries', date, {
    ...data,
    syncedAt: new Date().toISOString(),
    shopNo: '1745'
  });
}

/**
 * Sync denomination to Firestore
 */
async function syncDenomination(date, data) {
  return syncDocument('denominations', date, {
    ...data,
    syncedAt: new Date().toISOString()
  });
}

/**
 * Sync analytics summary (aggregated, not raw data)
 */
async function syncDailySummary(date, summary) {
  return syncDocument('dailySummaries', date, {
    ...summary,
    syncedAt: new Date().toISOString(),
    shopNo: '1745'
  });
}

/**
 * Get data from Firestore (for initial sync on web dashboard)
 */
async function getDocument(collection, docId) {
  if (!isAvailable()) return null;
  
  try {
    const doc = await firestoreDb.collection(collection).doc(docId).get();
    return doc.exists ? doc.data() : null;
  } catch (err) {
    console.error(`[Firebase] Get failed for ${collection}/${docId}:`, err.message);
    return null;
  }
}

module.exports = {
  initialize,
  getFirestore,
  isAvailable,
  syncDocument,
  syncDailyEntry,
  syncDenomination,
  syncDailySummary,
  getDocument
};
