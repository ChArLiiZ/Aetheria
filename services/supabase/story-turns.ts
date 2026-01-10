// @ts-nocheck
/**
 * Story Turns Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { StoryTurn } from '@/types';

/**
 * Get all turns for a story
 */
export async function getStoryTurns(
  storyId: string,
  userId: string
): Promise<StoryTurn[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('story_turns')
      .select('*')
      .eq('story_id', storyId)
      .eq('user_id', userId)
      .order('turn_index', { ascending: true });

    if (error) {
      throw new Error('Failed to fetch story turns: ' + error.message);
    }

    return (data || []) as StoryTurn[];
  }, { operationName: 'getStoryTurns' });
}

/**
 * Get a single turn by ID
 */
export async function getStoryTurnById(
  turnId: string,
  userId: string
): Promise<StoryTurn | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('story_turns')
      .select('*')
      .eq('turn_id', turnId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error('Failed to fetch story turn: ' + error.message);
    }

    return data as StoryTurn;
  });
}

/**
 * Create a new turn
 */
export async function createStoryTurn(
  userId: string,
  data: {
    story_id: string;
    turn_index: number;
    user_input_text: string;
    narrative_text: string;
    dialogue_json: string;
    scene_tags_json?: string;
    token_usage_json?: string;
  }
): Promise<StoryTurn> {
  const payload = {
    user_id: userId,
    story_id: data.story_id,
    turn_index: data.turn_index,
    user_input_text: data.user_input_text,
    narrative_text: data.narrative_text,
    dialogue_json: data.dialogue_json,
    scene_tags_json: data.scene_tags_json || '',
    token_usage_json: data.token_usage_json,
    error_flag: false,
  };

  return withRetry(async () => {
    const { data: newTurn, error } = await supabase
      .from('story_turns')
      .insert(payload)
      .select()
      .single();

    if (error || !newTurn) {
      throw new Error('Failed to create story turn: ' + error?.message);
    }

    return newTurn as StoryTurn;
  });
}

/**
 * Mark a turn as having an error
 */
export async function markTurnAsError(
  turnId: string,
  userId: string
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('story_turns')
      .update({ error_flag: true })
      .eq('turn_id', turnId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to mark turn as error: ' + error.message);
    }
  });
}

/**
 * Delete a turn (usually only for error recovery)
 */
export async function deleteStoryTurn(
  turnId: string,
  userId: string
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('story_turns')
      .delete()
      .eq('turn_id', turnId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to delete story turn: ' + error.message);
    }
  });
}

/**
 * Delete turns from a specific index onward
 */
export async function deleteStoryTurnsFromIndex(
  storyId: string,
  fromTurnIndex: number,
  userId: string
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('story_turns')
      .delete()
      .eq('story_id', storyId)
      .eq('user_id', userId)
      .gte('turn_index', fromTurnIndex);

    if (error) {
      throw new Error('Failed to delete story turns: ' + error.message);
    }
  });
}
