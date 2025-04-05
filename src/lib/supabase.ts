
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dngnpijxtxcocaszhnmz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZ25waWp4dHhjb2Nhc3pobm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2OTgyODcsImV4cCI6MjA1ODI3NDI4N30.L7mZdtsM2iooFdABhdn6wiMip9hkZs33C4iqlWbK6Uw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
