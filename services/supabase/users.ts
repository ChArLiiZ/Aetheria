/**
 * Users Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
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

/**
 * 更新用戶頭像 URL
 */
export async function updateUserAvatar(userId: string, avatarUrl: string | null): Promise<void> {
  return withRetry(async () => {
    const { error } = await (supabase
      .from('users') as any)
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to update avatar: ' + error.message);
    }
  });
}

/**
 * 取得公開用戶資訊（用於顯示創建者）
 */
export async function getPublicUserInfo(userId: string): Promise<{ display_name: string; avatar_url: string | null } | null> {
  const { data, error } = await supabase
    .from('users')
    .select('display_name, avatar_url')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to fetch user info:', error);
    return null;
  }

  return data;
}

// Note: updateDisplayName and updatePassword are now in auth.ts
// and use Supabase Auth for account updates
