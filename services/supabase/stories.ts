// @ts-nocheck
/**
 * Stories Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { Story, StoryMode, StoryStatus } from '@/types';

/**
 * Get all stories for a user
 */
export async function getStories(userId: string): Promise<Story[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch stories: ' + error.message);
    }

    return (data || []) as Story[];
  });
}

/**
 * Get a single story by ID
 */
export async function getStoryById(
  storyId: string,
  userId: string
): Promise<Story | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('story_id', storyId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error('Failed to fetch story: ' + error.message);
    }

    return data as Story;
  });
}

/**
 * Create a new story
 */
export async function createStory(
  userId: string,
  data: {
    world_id: string;
    title: string;
    premise_text: string;
    story_mode: StoryMode;
    player_character_id?: string;
    story_prompt: string;
    model_override?: string;
    params_override_json?: string;
  }
): Promise<Story> {
  const payload = {
    user_id: userId,
    world_id: data.world_id,
    title: data.title,
    premise_text: data.premise_text,
    story_mode: data.story_mode,
    player_character_id: data.player_character_id,
    story_prompt: data.story_prompt,
    model_override: data.model_override,
    params_override_json: data.params_override_json,
    status: 'active' as StoryStatus,
    turn_count: 0,
  };

  return withRetry(async () => {
    const { data: newStory, error } = await supabase
      .from('stories')
      .insert(payload)
      .select()
      .single();

    if (error || !newStory) {
      throw new Error('Failed to create story: ' + error?.message);
    }

    return newStory as Story;
  });
}

/**
 * Update an existing story
 */
export async function updateStory(
  storyId: string,
  userId: string,
  updates: Partial<Pick<Story, 'title' | 'premise_text' | 'story_prompt' | 'model_override' | 'params_override_json' | 'status' | 'turn_count' | 'player_character_id'>>
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('stories')
      .update(updates)
      .eq('story_id', storyId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to update story: ' + error.message);
    }
  });
}

/**
 * Delete a story
 */
export async function deleteStory(
  storyId: string,
  userId: string
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('story_id', storyId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to delete story: ' + error.message);
    }
  });
}

/**
 * Increment turn count
 */
export async function incrementTurnCount(
  storyId: string,
  userId: string
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase.rpc('increment_story_turn_count', {
      p_story_id: storyId,
      p_user_id: userId,
    });

    if (error) {
      // Fallback: get current count and increment manually
      const story = await getStoryById(storyId, userId);
      if (story) {
        await updateStory(storyId, userId, {
          turn_count: (story.turn_count || 0) + 1,
        });
      }
    }
  });
}

/**
 * End a story (change status to 'ended')
 */
export async function endStory(
  storyId: string,
  userId: string
): Promise<void> {
  await updateStory(storyId, userId, { status: 'ended' });
}

/**
 * Check if story title already exists for user
 */
export async function storyTitleExists(
  userId: string,
  title: string,
  excludeStoryId?: string
): Promise<boolean> {
  return withRetry(async () => {
    let query = supabase
      .from('stories')
      .select('story_id')
      .eq('user_id', userId)
      .ilike('title', title);

    if (excludeStoryId) {
      query = query.neq('story_id', excludeStoryId);
    }

    const { data } = await query;

    return (data?.length || 0) > 0;
  });
}
