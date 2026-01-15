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
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('story_characters')
      .select('*')
      .eq('story_id', storyId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error('Failed to fetch story characters: ' + error.message);
    }

    return (data || []) as StoryCharacter[];
  });
}

/**
 * Get a single story character by ID
 */
export async function getStoryCharacterById(
  storyCharacterId: string,
  userId: string
): Promise<StoryCharacter | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('story_characters')
      .select('*')
      .eq('story_character_id', storyCharacterId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error('Failed to fetch story character: ' + error.message);
    }

    return data as StoryCharacter;
  });
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

  return withRetry(async () => {
    const { data: newStoryCharacter, error } = await (supabase
      .from('story_characters') as any)
      .insert(payload)
      .select()
      .single();

    if (error || !newStoryCharacter) {
      throw new Error('Failed to add story character: ' + error?.message);
    }

    return newStoryCharacter as StoryCharacter;
  });
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
  return withRetry(async () => {
    const { error } = await (supabase
      .from('story_characters') as any)
      .update(updates)
      .eq('story_character_id', storyCharacterId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to update story character: ' + error.message);
    }
  });
}

/**
 * Remove a character from a story
 */
export async function removeStoryCharacter(
  storyCharacterId: string,
  userId: string
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('story_characters')
      .delete()
      .eq('story_character_id', storyCharacterId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to remove story character: ' + error.message);
    }
  });
}

/**
 * Check if a character is already in a story
 */
export async function isCharacterInStory(
  storyId: string,
  characterId: string,
  userId: string
): Promise<boolean> {
  return withRetry(async () => {
    const { data } = await supabase
      .from('story_characters')
      .select('story_character_id')
      .eq('story_id', storyId)
      .eq('character_id', characterId)
      .eq('user_id', userId);

    return (data?.length || 0) > 0;
  });
}

/**
 * Get characters for multiple stories at once
 * Returns a Map where key is story_id and value is array of StoryCharacters
 */
export async function getStoryCharactersForStories(
  storyIds: string[],
  userId: string
): Promise<Map<string, StoryCharacter[]>> {
  if (storyIds.length === 0) {
    return new Map();
  }

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('story_characters')
      .select('*')
      .in('story_id', storyIds)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error('Failed to fetch story characters: ' + error.message);
    }

    const result = new Map<string, StoryCharacter[]>();
    
    // 初始化所有 storyIds
    storyIds.forEach(id => result.set(id, []));
    
    // 填入資料
    (data || []).forEach((sc: StoryCharacter) => {
      const existing = result.get(sc.story_id) || [];
      existing.push(sc);
      result.set(sc.story_id, existing);
    });

    return result;
  });
}
