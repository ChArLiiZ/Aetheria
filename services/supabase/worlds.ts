// @ts-nocheck
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
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const fetchPromise = supabase
    .from('worlds')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    throw new Error('Failed to fetch worlds: ' + error.message);
  }

  return (data || []) as World[];
}

/**
 * Get world by ID
 */
export async function getWorldById(
  worldId: string,
  userId: string
): Promise<World | null> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const fetchPromise = supabase
    .from('worlds')
    .select('*')
    .eq('world_id', worldId)
    .eq('user_id', userId)
    .single();

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error('Failed to fetch world: ' + error.message);
  }

  return data as World;
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
  }
): Promise<World> {
  const { data: newWorld, error } = await supabase
    .from('worlds')
    .insert({
      user_id: userId,
      name: data.name,
      description: data.description,
      rules_text: data.rules_text,
    })
    .select()
    .single();

  if (error || !newWorld) {
    throw new Error('Failed to create world: ' + error?.message);
  }

  return newWorld as World;
}

/**
 * Update world
 */
export async function updateWorld(
  worldId: string,
  userId: string,
  updates: Partial<Pick<World, 'name' | 'description' | 'rules_text'>>
): Promise<void> {
  const { error } = await supabase
    .from('worlds')
    .update(updates)
    .eq('world_id', worldId)
    .eq('user_id', userId);

  if (error) {
    throw new Error('Failed to update world: ' + error.message);
  }
}

/**
 * Delete world
 */
export async function deleteWorld(
  worldId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('worlds')
    .delete()
    .eq('world_id', worldId)
    .eq('user_id', userId);

  if (error) {
    throw new Error('Failed to delete world: ' + error.message);
  }
}

/**
 * Check if world name already exists for user
 */
export async function worldNameExists(
  userId: string,
  name: string,
  excludeWorldId?: string
): Promise<boolean> {
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
}
