// @ts-nocheck
/**
 * Characters Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { Character } from '@/types';

/**
 * Get all characters for a user
 */
export async function getCharacters(userId: string): Promise<Character[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to fetch characters: ' + error.message);
  }

  return (data || []) as Character[];
}

/**
 * Get a single character by ID
 */
export async function getCharacterById(
  characterId: string,
  userId: string
): Promise<Character | null> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('character_id', characterId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error('Failed to fetch character: ' + error.message);
  }

  return data as Character;
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
  }
): Promise<Character> {
  const { data: newCharacter, error } = await supabase
    .from('characters')
    .insert({
      user_id: userId,
      canonical_name: data.canonical_name,
      core_profile_text: data.core_profile_text,
      tags_json: data.tags && data.tags.length > 0 ? JSON.stringify(data.tags) : '',
    })
    .select()
    .single();

  if (error || !newCharacter) {
    throw new Error('Failed to create character: ' + error?.message);
  }

  return newCharacter as Character;
}

/**
 * Update an existing character
 */
export async function updateCharacter(
  characterId: string,
  userId: string,
  data: {
    canonical_name: string;
    core_profile_text: string;
    tags?: string[];
  }
): Promise<Character> {
  const { data: updatedCharacter, error } = await supabase
    .from('characters')
    .update({
      canonical_name: data.canonical_name,
      core_profile_text: data.core_profile_text,
      tags_json: data.tags && data.tags.length > 0 ? JSON.stringify(data.tags) : '',
    })
    .eq('character_id', characterId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !updatedCharacter) {
    throw new Error('Failed to update character: ' + error?.message);
  }

  return updatedCharacter as Character;
}

/**
 * Delete a character
 */
export async function deleteCharacter(
  characterId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .delete()
    .eq('character_id', characterId)
    .eq('user_id', userId);

  if (error) {
    throw new Error('Failed to delete character: ' + error.message);
  }
}

/**
 * Check if a character name already exists for this user
 */
export async function characterNameExists(
  userId: string,
  name: string,
  excludeCharacterId?: string
): Promise<boolean> {
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
}
