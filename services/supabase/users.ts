/**
 * Users Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import type { User } from '@/types';

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error('Failed to fetch user: ' + error.message);
  }

  return data as User;
}

// Note: updateDisplayName and updatePassword are now in auth.ts
// and use API routes for secure password handling
