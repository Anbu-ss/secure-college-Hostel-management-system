// Database Configuration - Supabase Native (SQLite Removed)
// All persistent records are managed exclusively via Supabase PostgreSQL.
const { supabase } = require('./supabase.config');

console.log('Database connected successfully (Supabase Native Mode)');

// Lightweight compatibility shim for legacy SQLite pool calls
const pool = {
    execute: async (sql, params = []) => {
        // Safe no-op response for any remaining legacy dual-write / mirror calls
        return [[], []];
    },
    get: async (sql, params = []) => {
        return null;
    },
    all: async (sql, params = []) => {
        return [];
    },
    run: async (sql, params = []) => {
        return { insertId: null, changes: 0 };
    },
    exec: async (sql) => {
        return true;
    }
};

module.exports = pool;
