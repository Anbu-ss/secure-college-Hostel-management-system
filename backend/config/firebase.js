// backend/config/firebase.js
// Firebase Admin SDK initialisation
// -------------------------------------------------
// HOW TO SET UP:
//   1. Go to Firebase Console → Project Settings → Service Accounts
//   2. Click "Generate new private key" and download the JSON file.
//   3. Add the values from that JSON to your .env file using the
//      variable names below (never commit the raw JSON to git).
// -------------------------------------------------

const admin  = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Build the service-account credential object from individual env vars
const serviceAccount = {
  type: 'service_account',
  project_id:                  process.env.FIREBASE_PROJECT_ID,
  private_key_id:              process.env.FIREBASE_PRIVATE_KEY_ID,
  // Stored as a single-line string in .env; replace() restores real newlines
  private_key:                 process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email:                process.env.FIREBASE_CLIENT_EMAIL,
  client_id:                   process.env.FIREBASE_CLIENT_ID,
  auth_uri:                    'https://accounts.google.com/o/oauth2/auth',
  token_uri:                   'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url:        process.env.FIREBASE_CLIENT_CERT_URL,
};

// Initialise only once (guard against hot-reload double-init in dev)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // storageBucket: process.env.FIREBASE_STORAGE_BUCKET,  // uncomment if needed
  });
  console.log('✅  Firebase Admin SDK initialised');
}

const firebaseAuth = admin.auth();
const firestore    = admin.firestore();
// const firebaseStorage = admin.storage();  // uncomment if needed

module.exports = { firebaseAuth, firestore, admin };
