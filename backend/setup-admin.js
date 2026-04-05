/**
 * setup-admin.js — ONE-TIME Super Admin Setup Script
 * ─────────────────────────────────────────────────────
 * Run this ONCE to create the first Super Admin account.
 *
 * Usage:
 *   cd backend
 *   node setup-admin.js
 *
 * After running, you can log in at /admin/login with the
 * email and password you set below.
 */

require('dotenv').config();

const admin   = require('firebase-admin');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path    = require('path');

// ──────────────────────────────────────────────────────────
// 🔧 EDIT THESE BEFORE RUNNING
// ──────────────────────────────────────────────────────────
const SUPER_ADMIN = {
  name:        'Principal Admin',          // Change to your name
  email:       'admin@dmice.edu',          // Change to your admin email
  password:    'Admin@2026!',             // Change to a strong password
  collegeName: 'DMICE',
};
// ──────────────────────────────────────────────────────────

async function createSuperAdmin() {
  console.log('\n🚀 Secure Hostel — Super Admin Setup\n');

  // 1. Init Firebase Admin SDK
  const serviceAccount = {
    type:                        'service_account',
    project_id:                  process.env.FIREBASE_PROJECT_ID,
    private_key_id:              process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key:                 process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email:                process.env.FIREBASE_CLIENT_EMAIL,
    client_id:                   process.env.FIREBASE_CLIENT_ID,
    auth_uri:                    'https://accounts.google.com/o/oauth2/auth',
    token_uri:                   'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url:        process.env.FIREBASE_CLIENT_CERT_URL,
  };

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  const firebaseAuth = admin.auth();

  // 2. Connect to SQLite
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver:   sqlite3.Database,
  });

  try {
    // 3. Create Firebase Auth user
    console.log(`📧 Creating Firebase account: ${SUPER_ADMIN.email} ...`);
    let fbUser;
    try {
      fbUser = await firebaseAuth.createUser({
        email:        SUPER_ADMIN.email,
        password:     SUPER_ADMIN.password,
        displayName:  SUPER_ADMIN.name,
        emailVerified: true,
      });
      console.log(`✅ Firebase user created: ${fbUser.uid}`);
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        console.log(`⚠️  Firebase: Email already exists — skipping Firebase creation.`);
        fbUser = await firebaseAuth.getUserByEmail(SUPER_ADMIN.email);
      } else {
        throw err;
      }
    }

    // 4. Save in SQLite as Role = 'Admin'
    console.log(`💾 Saving to SQLite database...`);
    const existing = await db.get('SELECT ID FROM Users WHERE Email = ?', [SUPER_ADMIN.email]);
    if (existing) {
      console.log(`⚠️  SQLite: User already exists (ID: ${existing.ID}) — skipping insert.`);
    } else {
      const result = await db.run(
        'INSERT INTO Users (Name, Email, Role, Department) VALUES (?, ?, ?, ?)',
        [SUPER_ADMIN.name, SUPER_ADMIN.email, 'Admin', null]
      );
      console.log(`✅ SQLite user saved: ID = ${result.lastID}`);
    }

    console.log('\n══════════════════════════════════════════════');
    console.log('🎉 Super Admin created successfully!');
    console.log('──────────────────────────────────────────────');
    console.log(`   Name     : ${SUPER_ADMIN.name}`);
    console.log(`   Email    : ${SUPER_ADMIN.email}`);
    console.log(`   Password : ${SUPER_ADMIN.password}`);
    console.log(`   Role     : Admin (Super Admin)`);
    console.log('──────────────────────────────────────────────');
    console.log('👉 Go to http://localhost:5173 → Admin Portal');
    console.log('   Sign in with the email and password above.');
    console.log('══════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ Error creating Super Admin:', err.message);
    if (err.code) console.error('   Code:', err.code);
  } finally {
    await db.close();
    console.log('Database connection closed.');
    process.exit(0);
  }
}

createSuperAdmin();
