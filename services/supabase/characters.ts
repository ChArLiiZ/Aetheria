/**
 * Characters Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { Character } from '@/types';

/**
 * Get all characters for a user (include original author info for forked content)
 */
export async function getCharacters(userId: string): Promise<Character[]> {
  return withRetry(async () => {
    const { data, error } = await (supabase
      .from('characters') as any)
      .select(`
        *,
        original_author:original_author_id(display_name, avatar_url)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch characters: ' + error.message);
    }

    // 合併原作者資訊到 character 物件
    return (data || []).map((item: any) => ({
      ...item,
      original_author_name: item.original_author?.display_name || null,
      original_author_avatar_url: item.original_author?.avatar_url || null,
      original_author: undefined,
    })) as Character[];
  });
}

/**
 * Get a single character by ID (include original author info for forked content)
 */
export async function getCharacterById(
  characterId: string,
  userId: string
): Promise<Character | null> {
  return withRetry(async () => {
    const { data, error } = await (supabase
      .from('characters') as any)
      .select(`
        *,
        original_author:original_author_id(display_name, avatar_url)
      `)
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error('Failed to fetch character: ' + error.message);
    }

    // 合併原作者資訊到 character 物件
    return {
      ...data,
      original_author_name: data.original_author?.display_name || null,
      original_author_avatar_url: data.original_author?.avatar_url || null,
      original_author: undefined,
    } as Character;
  });
}

/**
 * Create a new character
 */
export async function createCharacter(
  userId: string,
  data: {
    canonical_name: string;
    core_profile_text: string;
    tags?: string[];
    image_url?: string | null;
  }
): Promise<Character> {
  return withRetry(async () => {
    const { data: newCharacter, error } = await (supabase
      .from('characters') as any)
      .insert({
        user_id: userId,
        canonical_name: data.canonical_name,
        core_profile_text: data.core_profile_text,
        tags_json: data.tags && data.tags.length > 0 ? JSON.stringify(data.tags) : '',
        image_url: data.image_url ?? null,
      })
      .select()
      .single();

    if (error || !newCharacter) {
      throw new Error('Failed to create character: ' + error?.message);
    }

    return newCharacter as Character;
  });
}

/**
 * Update an existing character
 */
export async function updateCharacter(
  characterId: string,
  userId: string,
  data: Partial<{
    canonical_name: string;
    core_profile_text: string;
    tags?: string[];
    image_url: string | null;
    visibility: 'private' | 'public';
  }>
): Promise<Character> {
  return withRetry(async () => {
    const updatePayload: any = {};

    if (data.canonical_name !== undefined) {
      updatePayload.canonical_name = data.canonical_name;
    }
    if (data.core_profile_text !== undefined) {
      updatePayload.core_profile_text = data.core_profile_text;
    }
    if (data.tags !== undefined) {
      updatePayload.tags_json = data.tags.length > 0 ? JSON.stringify(data.tags) : '';
    }
    if (data.image_url !== undefined) {
      updatePayload.image_url = data.image_url;
    }
    if (data.visibility !== undefined) {
      // 查詢當前角色資訊（用於檢查是否為複製品和 published_at）
      const { data: currentCharacter, error: fetchError } = await (supabase
        .from('characters') as any)
        .select('published_at, original_author_id')
        .eq('character_id', characterId)
        .eq('user_id', userId)
        .single();

      // 檢查查詢錯誤
      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new Error('找不到要更新的角色');
        }
        throw new Error('查詢角色資訊失敗: ' + fetchError.message);
      }

      // 禁止將複製品設為公開
      if (data.visibility === 'public' && currentCharacter?.original_author_id) {
        throw new Error('複製的角色無法設為公開');
      }

      updatePayload.visibility = data.visibility;
      // 首次公開時設定 published_at（只有當 published_at 尚未設定時）
      if (data.visibility === 'public') {
        // 只有在 published_at 為 null 時才設定
        if (!currentCharacter?.published_at) {
          updatePayload.published_at = new Date().toISOString();
        }
      }
    }

    const { data: updatedCharacter, error } = await (supabase
      .from('characters') as any)
      .update(updatePayload)
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !updatedCharacter) {
      throw new Error('Failed to update character: ' + error?.message);
    }

    return updatedCharacter as Character;
  });
}

/**
 * Delete a character
 */
export async function deleteCharacter(
  characterId: string,
  userId: string
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('character_id', characterId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to delete character: ' + error.message);
    }
  });
}

/**
 * Delete multiple characters
 */
export async function deleteCharacters(
  characterIds: string[],
  userId: string
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('characters')
      .delete()
      .in('character_id', characterIds)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to delete characters: ' + error.message);
    }
  });
}

/**
 * Check if a character name already exists for this user
 */
export async function characterNameExists(
  userId: string,
  name: string,
  excludeCharacterId?: string
): Promise<boolean> {
  return withRetry(async () => {
    let query = supabase
      .from('characters')
      .select('character_id')
      .eq('user_id', userId)
      .ilike('canonical_name', name);

    if (excludeCharacterId) {
      query = query.neq('character_id', excludeCharacterId);
    }

    const { data } = await query;

    return (data?.length || 0) > 0;
  });
}
