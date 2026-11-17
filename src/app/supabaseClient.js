import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aetenddiyhijwudtqgyw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldGVuZGRpeWhpand1ZHRxZ3l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzA5MTgsImV4cCI6MjEwNDEwNjkxOH0.QFULBGTnt6icob-_zrg2vaNI-xneaOpUWQGNtZ2cibc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

