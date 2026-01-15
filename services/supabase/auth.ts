/**
 * Authentication Service (Supabase Auth)
 *
 * Uses Supabase's built-in authentication system
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { User } from '@/types';
import { validatePassword } from '@/lib/auth/password';

function buildFallbackUser(sessionUser: any): User {
  const now = new Date().toISOString();
  const email = sessionUser?.email || '';
  const displayName =
    sessionUser?.user_metadata?.display_name || email.split('@')[0] || 'User';

  return {
    user_id: sessionUser?.id || '',
    email,
    display_name: displayName,
    status: 'active',
    created_at: sessionUser?.created_at || now,
    updated_at: now,
    last_login_at: sessionUser?.last_sign_in_at || undefined,
  };
}

async function tryCreateUserProfile(sessionUser: any): Promise<User | null> {
  if (!sessionUser?.id) return null;

  const email = sessionUser.email || '';
  if (!email) return null;
  const displayName =
    sessionUser?.user_metadata?.display_name || email.split('@')[0] || 'User';

  const { data, error } = await (supabase
    .from('users') as any)
    .insert({
      user_id: sessionUser.id,
      email,
      display_name: displayName,
      status: 'active',
    })
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return data as User;
}

/**
 * Register a new user
 */
export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return { success: false, error: passwordValidation.errors[0] || '密碼格式不符' };
    }

    // Sign up with Supabase Auth
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (signUpError) {
      return { success: false, error: signUpError.message };
    }

    if (!authData.user) {
      return { success: false, error: '註冊失敗' };
    }

    // Fetch the created profile from public.users
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();

    if (profileError || !profile) {
      // Profile might not be created yet due to trigger, return basic user info
      return {
        success: true,
        user: {
          user_id: authData.user.id,
          email: authData.user.email!,
          display_name: displayName,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as User,
      };
    }

    return { success: true, user: profile as User };
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
    // Sign in with Supabase Auth
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (signInError) {
      return { success: false, error: 'Email 或密碼錯誤' };
    }

    if (!authData.user) {
      return { success: false, error: '登入失敗' };
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: '無法取得用戶資料' };
    }

    // Update last login
    await (supabase
      .from('users') as any)
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', authData.user.id);

    return { success: true, user: profile as User };
  } catch (error: any) {
    return { success: false, error: error.message || '登入失敗' };
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Get current session
 */
export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  if (!session?.user) return null;

  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  if (profile) {
    return profile as User;
  }

  if (error && error.code !== 'PGRST116') {
    console.warn('Failed to load user profile, using session fallback:', error);
    return buildFallbackUser(session.user);
  }

  const createdProfile = await tryCreateUserProfile(session.user);
  if (createdProfile) {
    return createdProfile;
  }

  return buildFallbackUser(session.user);
}

/**
 * Update user display name
 */
export async function updateDisplayName(
  userId: string,
  newDisplayName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await (supabase
      .from('users') as any)
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
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return { success: false, error: passwordValidation.errors[0] || '新密碼格式不符' };
    }

    // Get current user's email to verify old password
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.email) {
      return { success: false, error: '無法取得用戶資訊' };
    }

    // Verify old password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: oldPassword,
    });

    if (signInError) {
      return { success: false, error: '舊密碼錯誤' };
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || '更新密碼失敗' };
  }
}
