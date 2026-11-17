/**
 * setup-admin.js — Secure Institutional Admin Setup Script
 * ─────────────────────────────────────────────────────────────
 * Creates or configures an authorized Institutional User (Admin, Warden, Staff, Security)
 * in Supabase Auth & public.profiles with 10-round bcrypt hashing.
 *
 * Usage:
 *   node scripts/setup-admin.js <email> <password> "<Full Name>" <ROLE>
 *
 * Example:
 *   node scripts/setup-admin.js principal@hostel.edu SecureAdminPass2026! "Hostel Director" ADMIN
 *
 * If arguments are omitted, it reads from environment variables:
 *   ADMIN_SETUP_EMAIL, ADMIN_SETUP_PASSWORD, ADMIN_SETUP_NAME, ADMIN_SETUP_ROLE
 */

require('dotenv').config();
const { supabase } = require('../config/supabase.config');

async function setupAdmin() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.ADMIN_SETUP_EMAIL || '').trim();
  const password = (args[1] || process.env.ADMIN_SETUP_PASSWORD || '').trim();
  const fullName = (args[2] || process.env.ADMIN_SETUP_NAME || 'Principal Administrator').trim();
  const role = (args[3] || process.env.ADMIN_SETUP_ROLE || 'ADMIN').toUpperCase().trim();

  if (!email || !password) {
    console.error('❌ Error: Email and password are required.');
    console.log('\nUsage:');
    console.log('  node scripts/setup-admin.js <email> <password> "[Full Name]" [ROLE]');
    console.log('\nSupported roles: ADMIN, SUPER_ADMIN, WARDEN, STAFF, SECURITY');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('❌ Error: Password must be at least 6 characters.');
    process.exit(1);
  }

  console.log(`\n🚀 Initializing Institutional User in Supabase...`);
  console.log(`   Email: ${email}`);
  console.log(`   Name:  ${fullName}`);
  console.log(`   Role:  ${role}\n`);

  try {
    const { data, error } = await supabase.rpc('create_institutional_user', {
      p_email: email,
      p_password: password,
      p_full_name: fullName,
      p_role: role
    });

    if (error) {
      console.error('❌ Failed to create institutional user:', error.message);
      process.exit(1);
    }

    if (!data?.success) {
      console.error('❌ RPC Error:', data?.message || 'Unable to create user.');
      process.exit(1);
    }

    console.log('✅ Institutional account successfully provisioned in Supabase Auth!');
    console.log(`   User ID: ${data.user_id}`);
    console.log(`   Role:    ${data.role}`);
    console.log(`   Status:  ACTIVE`);
    console.log('\nYou can now log in securely through the portal.\n');
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

setupAdmin();
