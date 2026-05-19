const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// In production, use environment variables
// For local development, you can use a service account key file
let firebaseApp;

if (process.env.FIREBASE_PROJECT_ID) {
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
} else {
  // For development/testing without Firebase
  console.warn('Firebase not configured - using in-memory storage');
  firebaseApp = null;
}

const db = firebaseApp ? admin.firestore() : null;

module.exports = { admin, db, firebaseApp };
