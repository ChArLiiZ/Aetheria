/**
 * Worlds Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { World } from '@/types';

/**
 * Get all worlds for a user
 */
export async function getWorldsByUserId(userId: string): Promise<World[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('worlds')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch worlds: ' + error.message);
    }

    return (data || []) as World[];
  });
}

/**
 * Get world by ID
 */
export async function getWorldById(
  worldId: string,
  userId: string
): Promise<World | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('worlds')
      .select('*')
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

    return data as World;
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

    return newWorld as World;
  });
}

/**
 * Update world
 */
export async function updateWorld(
  worldId: string,
  userId: string,
  updates: Partial<Pick<World, 'name' | 'description' | 'rules_text' | 'image_url'>> & { tags?: string[] }
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

