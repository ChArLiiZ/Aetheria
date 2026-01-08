/**
 * Authentication Service (Supabase)
 *
 * Handles user authentication via API routes
 */

import type { User } from '@/types';

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

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || '註冊失敗' };
    }

    return { success: true, user: result.user };
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
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || '登入失敗' };
    }

    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: error.message || '登入失敗' };
  }
}

/**
 * Get current user by ID
 */
export async function getCurrentUser(userId: string): Promise<User | null> {
  // This can be removed since we use session storage
  return null;
}

/**
 * Update user display name
 */
export async function updateDisplayName(
  userId: string,
  newDisplayName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, displayName: newDisplayName }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || '更新失敗' };
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

    const response = await fetch('/api/auth/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, oldPassword, newPassword }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || '更新密碼失敗' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || '更新密碼失敗' };
  }
}
