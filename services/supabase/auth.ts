/**
 * Authentication Service (Supabase)
 *
 * Handles user authentication using Supabase Auth with custom password validation
 */

import { supabase } from '@/lib/supabase/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { User } from '@/types';
import bcrypt from 'bcryptjs';

/**
 * Register a new user
 */
export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    // Validate password (at least 6 characters, lowercase allowed)
    if (password.length < 6) {
      return { success: false, error: '密碼長度至少需要 6 個字符' };
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('user_id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return { success: false, error: '此 Email 已被註冊' };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in our custom users table
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        email: email.toLowerCase(),
        display_name: displayName,
        password_hash: passwordHash,
        status: 'active',
      })
      .select()
      .single();

    if (insertError || !newUser) {
      return { success: false, error: '註冊失敗：' + insertError?.message };
    }

    return { success: true, user: newUser as User };
  } catch (error: any) {
    return { success: false, error: error.message || '註冊失敗' };
  }
}

/**
 * Login user
 */
export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    // Get user by email
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (fetchError || !user) {
      return { success: false, error: 'Email 或密碼錯誤' };
    }

    // Check if user is active
    if (user.status !== 'active') {
      return { success: false, error: '帳號已被停用' };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return { success: false, error: 'Email 或密碼錯誤' };
    }

    // Update last login timestamp
    await supabaseAdmin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', user.user_id);

    return { success: true, user: user as User };
  } catch (error: any) {
    return { success: false, error: error.message || '登入失敗' };
  }
}

/**
 * Get current user by ID
 */
export async function getCurrentUser(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as User;
  } catch {
    return null;
  }
}

/**
 * Update user display name
 */
export async function updateDisplayName(
  userId: string,
  newDisplayName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ display_name: newDisplayName })
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || '更新失敗' };
  }
}

/**
 * Update user password
 */
export async function updatePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate new password
    if (newPassword.length < 6) {
      return { success: false, error: '新密碼長度至少需要 6 個字符' };
    }

    // Get current user
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('password_hash')
      .eq('user_id', userId)
      .single();

    if (!user) {
      return { success: false, error: '用戶不存在' };
    }

    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValidPassword) {
      return { success: false, error: '舊密碼錯誤' };
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    const { error } = await supabaseAdmin
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || '更新密碼失敗' };
  }
}
