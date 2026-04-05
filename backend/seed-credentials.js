/**
 * seed-credentials.js — Create All Admin Credentials
 * ─────────────────────────────────────────────────────
 * Generates accounts for:
 *   ✅ 1 Warden
 *   ✅ 1 Security Officer
 *   ✅ 8 HODs (one per department)
 *   ✅ 8 Staff Tutors (one per department)
 *
 * Usage:
 *   cd backend
 *   node seed-credentials.js
 *
 * Output: credentials.txt (save this file securely!)
 */

require('dotenv').config();

const admin    = require('firebase-admin');
const sqlite3  = require('sqlite3').verbose();
const { open } = require('sqlite');
const path     = require('path');
const fs       = require('fs');

// ─── College Config ───────────────────────────────────────
const COLLEGE   = 'dmice';   // used in email domain
const DOMAIN    = 'edu';     // email will be name.role@dmice.edu
const DEPARTMENTS = ['IT', 'CSE', 'ECE', 'EEE', 'MECH', 'AIML', 'AIDS', 'CIVIL'];

// ─── Admin Users to Create ────────────────────────────────
const ADMINS = [
  // Warden and Security — no department
  { name: 'Hostel Warden',        role: 'Warden',   department: null },
  { name: 'Gate Security Officer', role: 'Security', department: null },

  // HODs — one per department
  ...DEPARTMENTS.map(dept => ({
    name:       `HOD ${dept}`,
    role:       'HOD',
    department: dept,
  })),

  // Staff Tutors — one per department
  ...DEPARTMENTS.map(dept => ({
    name:       `Staff ${dept}`,
    role:       'Staff',
    department: dept,
  })),
];

// ─── Helpers ──────────────────────────────────────────────
const clean     = (s) => s.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
const makeEmail = ({ name, role, department }) => {
  const roleTag = role.toLowerCase();
  const deptTag = department ? clean(department) : '';
  // e.g. hod.cse@dmice.edu | staff.ece@dmice.edu | hostel.warden@dmice.edu | gate.security@dmice.edu
  if (department) return `${roleTag}.${deptTag}@${COLLEGE}.${DOMAIN}`;
  // Warden / Security: use first word of name
  const firstWord = clean(name.split(' ')[0]);
  return `${firstWord}.${roleTag}@${COLLEGE}.${DOMAIN}`;
};

const makePassword = (name, role) => {
  const special  = ['@', '#', '!', '$', '%'];
  const seed     = name.charAt(0).toUpperCase();
  const roleTag  = role.slice(0, 3).toUpperCase();
  const num      = Math.floor(Math.random() * 90 + 10); // 10–99
  const sp       = special[Math.floor(Math.random() * special.length)];
  const tail     = Math.random().toString(36).slice(2, 6); // 4 random alphanum
  return `${seed}${roleTag}${sp}${num}${tail}`;
};

// ─── Main ─────────────────────────────────────────────────
async function seedCredentials() {
  console.log('\n🚀 Secure Hostel — Seeding All Admin Credentials\n');

  // Init Firebase Admin SDK
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

  // Open SQLite
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver:   sqlite3.Database,
  });

  const results   = [];
  const skipped   = [];
  const failed    = [];

  for (const adminUser of ADMINS) {
    const email    = makeEmail(adminUser);
    const password = makePassword(adminUser.name, adminUser.role);

    try {
      // Check SQLite first
      const existing = await db.get('SELECT ID FROM Users WHERE Email = ?', [email]);
      if (existing) {
        console.log(`⏭️  Skipping (already exists): ${email}`);
        skipped.push({ ...adminUser, email, reason: 'Already exists in DB' });
        continue;
      }

      // Create in Firebase
      try {
        await firebaseAuth.createUser({
          email,
          password,
          displayName:   adminUser.name,
          emailVerified: false,
        });
      } catch (fbErr) {
        if (fbErr.code !== 'auth/email-already-exists') throw fbErr;
        console.log(`⚠️  Firebase duplicate: ${email} — adding to SQLite only`);
      }

      // Save in SQLite
      await db.run(
        'INSERT INTO Users (Name, Email, Role, Department) VALUES (?, ?, ?, ?)',
        [adminUser.name, email, adminUser.role, adminUser.department]
      );

      console.log(`✅ Created: [${adminUser.role}] ${adminUser.department || 'ALL'} — ${email}`);
      results.push({ ...adminUser, email, password });

    } catch (err) {
      console.error(`❌ Failed: ${email} — ${err.message}`);
      failed.push({ ...adminUser, email, error: err.message });
    }
  }

  // ─── Print Table ──────────────────────────────────────
  const bar = '═'.repeat(72);
  const lines = [];
  lines.push(`\n${bar}`);
  lines.push('  SECURE HOSTEL — ADMIN CREDENTIALS (Keep this file secret!)');
  lines.push(`  College: ${COLLEGE.toUpperCase()} | Generated: ${new Date().toLocaleString('en-IN')}`);
  lines.push(bar);

  const groups = ['Warden', 'Security', 'HOD', 'Staff'];
  for (const grp of groups) {
    const grpUsers = results.filter(r => r.role === grp);
    if (!grpUsers.length) continue;
    lines.push(`\n  ── ${grp.toUpperCase()} ${'─'.repeat(60 - grp.length)}`);
    lines.push(`  ${'Name'.padEnd(24)} ${'Dept'.padEnd(8)} ${'Email'.padEnd(30)} Password`);
    lines.push(`  ${'-'.repeat(68)}`);
    for (const u of grpUsers) {
      lines.push(`  ${u.name.padEnd(24)} ${(u.department || 'ALL').padEnd(8)} ${u.email.padEnd(30)} ${u.password}`);
    }
  }

  if (skipped.length) {
    lines.push(`\n  ── SKIPPED (already existed) ${'─'.repeat(41)}`);
    skipped.forEach(u => lines.push(`  ${u.email}  — ${u.reason}`));
  }
  if (failed.length) {
    lines.push(`\n  ── FAILED ${'─'.repeat(60)}`);
    failed.forEach(u => lines.push(`  ${u.email}  — ${u.error}`));
  }

  lines.push(`\n${bar}`);
  lines.push(`  Total created: ${results.length} | Skipped: ${skipped.length} | Failed: ${failed.length}`);
  lines.push(`${bar}\n`);

  const output = lines.join('\n');
  console.log(output);

  // Save to file
  const outFile = path.join(__dirname, 'credentials.txt');
  fs.writeFileSync(outFile, output);
  console.log(`\n📄 Credentials saved to: backend/credentials.txt`);
  console.log('   ⚠️  Keep this file secure — delete after distributing credentials!\n');

  await db.close();
  process.exit(0);
}

seedCredentials();
