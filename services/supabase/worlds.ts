/**
 * Worlds Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { World } from '@/types';

/**
 * Get all worlds for a user (include original author info for forked content)
 */
export async function getWorldsByUserId(userId: string): Promise<World[]> {
  return withRetry(async () => {
    const { data, error } = await (supabase
      .from('worlds') as any)
      .select(`
        *,
        original_author:original_author_id(display_name, avatar_url)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch worlds: ' + error.message);
    }

    // 合併原作者資訊到 world 物件
    return (data || []).map((item: any) => ({
      ...item,
      original_author_name: item.original_author?.display_name || null,
      original_author_avatar_url: item.original_author?.avatar_url || null,
      original_author: undefined,
    })) as World[];
  });
}

/**
 * Get world by ID (include original author info for forked content)
 */
export async function getWorldById(
  worldId: string,
  userId: string
): Promise<World | null> {
  return withRetry(async () => {
    const { data, error } = await (supabase
      .from('worlds') as any)
      .select(`
        *,
        original_author:original_author_id(display_name, avatar_url)
      `)
      .eq('world_id', worldId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error('Failed to fetch world: ' + error.message);
    }

    // 合併原作者資訊到 world 物件
    return {
      ...data,
      original_author_name: data.original_author?.display_name || null,
      original_author_avatar_url: data.original_author?.avatar_url || null,
      original_author: undefined,
    } as World;
  });
}

/**
 * Create new world
 */
export async function createWorld(
  userId: string,
  data: {
    name: string;
    description: string;
    rules_text: string;
    tags?: string[];
    image_url?: string | null;
  }
): Promise<World> {
  return withRetry(async () => {
    const { data: newWorld, error } = await (supabase
      .from('worlds') as any)
      .insert({
        user_id: userId,
        name: data.name,
        description: data.description,
        rules_text: data.rules_text,
        tags_json: data.tags && data.tags.length > 0 ? JSON.stringify(data.tags) : '',
        image_url: data.image_url ?? null,
      })
      .select()
      .single();

    if (error || !newWorld) {
      throw new Error('Failed to create world: ' + error?.message);
    }

    const world = newWorld as World;

    // Create default global schema: "current_time"
    try {
      const { createSchemaItem } = await import('./world-schema');
      await createSchemaItem(world.world_id, userId, {
        schema_key: 'current_time',
        display_name: '當前時間',
        type: 'text',
        scope: 'global',
        ai_description: 'The current in-story time. Update this as time passes in the narrative (e.g., "清晨", "下午三點", "深夜").',
        default_value_json: JSON.stringify('未設定'),
      });
      console.log('[createWorld] Created default global schema: current_time');
    } catch (err) {
      console.warn('[createWorld] Failed to create default global schema:', err);
      // Non-critical, continue
    }

    return world;
  });
}

/**
 * Update world
 */
export async function updateWorld(
  worldId: string,
  userId: string,
  updates: Partial<Pick<World, 'name' | 'description' | 'rules_text' | 'image_url' | 'visibility'>> & { tags?: string[] }
): Promise<void> {
  return withRetry(async () => {
    const payload: any = {};

    // 只有當欄位明確被傳入時才更新，避免 undefined 意外覆蓋現有值
    if (updates.name !== undefined) {
      payload.name = updates.name;
    }
    if (updates.description !== undefined) {
      payload.description = updates.description;
    }
    if (updates.rules_text !== undefined) {
      payload.rules_text = updates.rules_text;
    }
    if (updates.image_url !== undefined) {
      payload.image_url = updates.image_url;
    }
    if (updates.tags !== undefined) {
      payload.tags_json = updates.tags.length > 0 ? JSON.stringify(updates.tags) : '';
    }
    if (updates.visibility !== undefined) {
      // 查詢當前世界觀資訊（用於檢查是否為複製品和 published_at）
      const { data: currentWorld, error: fetchError } = await (supabase
        .from('worlds') as any)
        .select('published_at, original_author_id')
        .eq('world_id', worldId)
        .eq('user_id', userId)
        .single();

      // 檢查查詢錯誤
      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new Error('找不到要更新的世界觀');
        }
        throw new Error('查詢世界觀資訊失敗: ' + fetchError.message);
      }

      // 禁止將複製品設為公開
      if (updates.visibility === 'public' && currentWorld?.original_author_id) {
        throw new Error('複製的世界觀無法設為公開');
      }

      payload.visibility = updates.visibility;
      // 首次公開時設定 published_at（只有當 published_at 尚未設定時）
      if (updates.visibility === 'public') {
        // 只有在 published_at 為 null 時才設定
        if (!currentWorld?.published_at) {
          payload.published_at = new Date().toISOString();
        }
      }
    }

    const { error } = await (supabase
      .from('worlds') as any)
      .update(payload)
      .eq('world_id', worldId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to update world: ' + error.message);
    }
  });
}

/**
 * Delete world
 */
export async function deleteWorld(
  worldId: string,
  userId: string
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('worlds')
      .delete()
      .eq('world_id', worldId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to delete world: ' + error.message);
    }
  });
}

/**
 * Delete multiple worlds
 */
export async function deleteWorlds(
  worldIds: string[],
  userId: string
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('worlds')
      .delete()
      .in('world_id', worldIds)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to delete worlds: ' + error.message);
    }
  });
}

/**
 * Check if world name already exists for user
 */
export async function worldNameExists(
  userId: string,
  name: string,
  excludeWorldId?: string
): Promise<boolean> {
  return withRetry(async () => {
    let query = supabase
      .from('worlds')
      .select('world_id')
      .eq('user_id', userId)
      .ilike('name', name);

    if (excludeWorldId) {
      query = query.neq('world_id', excludeWorldId);
    }

    const { data } = await query;

    return (data?.length || 0) > 0;
  });
}

