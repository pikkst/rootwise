import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';
import { getRequiredEnvVar } from '../utils/env';

const env = import.meta.env as Record<string, string | undefined>;
const supabaseUrl = getRequiredEnvVar(env, 'VITE_SUPABASE_URL');
const supabaseAnonKey = getRequiredEnvVar(env, 'VITE_SUPABASE_ANON_KEY');

export const supabase: SupabaseClient<Database, 'public', 'public'> = createClient<Database, 'public', 'public'>(supabaseUrl, supabaseAnonKey);
