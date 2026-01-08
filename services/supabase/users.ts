/**
 * Users Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';

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

/**
 * Update user display name
 */
export async function updateDisplayName(
  userId: string,
  newDisplayName: string
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ display_name: newDisplayName })
    .eq('user_id', userId);

  if (error) {
    throw new Error('Failed to update display name: ' + error.message);
  }
}

/**
 * Update user password (requires old password verification)
 */
export async function updatePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  // Get current user
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('password_hash')
    .eq('user_id', userId)
    .single();

  if (!user) {
    throw new Error('用戶不存在');
  }

  // Verify old password
  const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
  if (!isValidPassword) {
    throw new Error('舊密碼錯誤');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  // Update password
  const { error } = await supabaseAdmin
    .from('users')
    .update({ password_hash: newPasswordHash })
    .eq('user_id', userId);

  if (error) {
    throw new Error('Failed to update password: ' + error.message);
  }
}
