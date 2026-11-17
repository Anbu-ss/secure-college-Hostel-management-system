// Clean Database Reset - Supabase Native
// Clears test data while maintaining institutional seed data
require('dotenv').config();
const { supabase } = require('../config/supabase.config');

async function resetDatabase() {
    console.log('🧹 Resetting database to clean Supabase state...');

    try {
        await supabase.from('gate_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('gate_pass_approvals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('gate_pass_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('hostel_allocations').delete().neq('id', 0);
        await supabase.from('student_profiles').delete().neq('id', 0);
        await supabase.from('students').delete().neq('id', 0);
        await supabase.from('student_import_errors').delete().neq('id', 0);
        await supabase.from('student_import_batches').delete().neq('id', 0);
        await supabase.from('account_activation_tokens').delete().neq('id', 0);
        await supabase.from('audit_logs').delete().neq('id', 0);

        // Remove non-institutional test profiles
        await supabase.from('profiles').delete().eq('role', 'STUDENT');

        console.log('✅ Supabase database cleared of all test records.');
        console.log('   Ready for fresh student registrations and gate pass requests.');
    } catch (err) {
        console.error('Error during database reset:', err);
    }
}

if (require.main === module) {
    resetDatabase().then(() => process.exit(0));
}

module.exports = resetDatabase;
