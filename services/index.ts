/**
 * Service Layer Index
 *
 * Central export point for all database services
 * Currently using Supabase as the backend
 */

// Export all services from Supabase
export * from './supabase/auth';
export * from './supabase/worlds';
export * from './supabase/world-schema';
export * from './supabase/characters';
export * from './supabase/provider-settings';

// For convenience, also export the Supabase client
export { supabase } from '@/lib/supabase/client';
