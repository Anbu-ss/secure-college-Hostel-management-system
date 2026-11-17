const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aetenddiyhijwudtqgyw.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldGVuZGRpeWhpand1ZHRxZ3l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzA5MTgsImV4cCI6MjEwNDEwNjkxOH0.QFULBGTnt6icob-_zrg2vaNI-xneaOpUWQGNtZ2cibc';
const INITIAL_STUDENT_PASSWORD = process.env.INITIAL_STUDENT_PASSWORD || 'dmi@1202';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Helper for isolated authentication checks without mutating the global client
function createAuthClient() {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

// Helper for authenticated client when acting on behalf of a student's session
async function createAuthenticatedClient(accessToken, refreshToken = '') {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    if (accessToken) {
        await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });
    }
    return client;
}

module.exports = {
    supabase,
    createAuthClient,
    createAuthenticatedClient,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    INITIAL_STUDENT_PASSWORD
};

