// @ts-nocheck
/**
 * Story Characters Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { StoryCharacter } from '@/types';

/**
 * Get all characters in a story
 */
export async function getStoryCharacters(
  storyId: string,
  userId: string
): Promise<StoryCharacter[]> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const fetchPromise = supabase
    .from('story_characters')
    .select('*')
    .eq('story_id', storyId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    throw new Error('Failed to fetch story characters: ' + error.message);
  }

  return (data || []) as StoryCharacter[];
}

/**
 * Get a single story character by ID
 */
export async function getStoryCharacterById(
  storyCharacterId: string,
  userId: string
): Promise<StoryCharacter | null> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const fetchPromise = supabase
    .from('story_characters')
    .select('*')
    .eq('story_character_id', storyCharacterId)
    .eq('user_id', userId)
    .single();

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error('Failed to fetch story character: ' + error.message);
  }

  return data as StoryCharacter;
}

/**
 * Add a character to a story
 */
export async function addStoryCharacter(
  userId: string,
  data: {
    story_id: string;
    character_id: string;
    display_name_override?: string;
    is_player?: boolean;
  }
): Promise<StoryCharacter> {
  const payload = {
    user_id: userId,
    story_id: data.story_id,
    character_id: data.character_id,
    display_name_override: data.display_name_override,
    is_player: data.is_player || false,
  };

  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const insertPromise = supabase
    .from('story_characters')
    .insert(payload)
    .select()
    .single();

  const result = await Promise.race([insertPromise, timeoutPromise]);
  const { data: newStoryCharacter, error } = result as any;

  if (error || !newStoryCharacter) {
    throw new Error('Failed to add story character: ' + error?.message);
  }

  return newStoryCharacter as StoryCharacter;
}

/**
 * Update a story character
 */
export async function updateStoryCharacter(
  storyCharacterId: string,
  userId: string,
  updates: {
    display_name_override?: string;
  }
): Promise<void> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const updatePromise = supabase
    .from('story_characters')
    .update(updates)
    .eq('story_character_id', storyCharacterId)
    .eq('user_id', userId);

  const result = await Promise.race([updatePromise, timeoutPromise]);
  const { error } = result as any;

  if (error) {
    throw new Error('Failed to update story character: ' + error.message);
  }
}

/**
 * Remove a character from a story
 */
export async function removeStoryCharacter(
  storyCharacterId: string,
  userId: string
): Promise<void> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const deletePromise = supabase
    .from('story_characters')
    .delete()
    .eq('story_character_id', storyCharacterId)
    .eq('user_id', userId);

  const result = await Promise.race([deletePromise, timeoutPromise]);
  const { error } = result as any;

  if (error) {
    throw new Error('Failed to remove story character: ' + error.message);
  }
}

/**
 * Check if a character is already in a story
 */
export async function isCharacterInStory(
  storyId: string,
  characterId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('story_characters')
    .select('story_character_id')
    .eq('story_id', storyId)
    .eq('character_id', characterId)
    .eq('user_id', userId);

  return (data?.length || 0) > 0;
}
