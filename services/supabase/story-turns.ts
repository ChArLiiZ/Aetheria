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
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const fetchPromise = supabase
    .from('story_turns')
    .select('*')
    .eq('story_id', storyId)
    .eq('user_id', userId)
    .order('turn_index', { ascending: true });

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    throw new Error('Failed to fetch story turns: ' + error.message);
  }

  return (data || []) as StoryTurn[];
}

/**
 * Get a single turn by ID
 */
export async function getStoryTurnById(
  turnId: string,
  userId: string
): Promise<StoryTurn | null> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const fetchPromise = supabase
    .from('story_turns')
    .select('*')
    .eq('turn_id', turnId)
    .eq('user_id', userId)
    .single();

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error('Failed to fetch story turn: ' + error.message);
  }

  return data as StoryTurn;
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

  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const insertPromise = supabase
    .from('story_turns')
    .insert(payload)
    .select()
    .single();

  const result = await Promise.race([insertPromise, timeoutPromise]);
  const { data: newTurn, error } = result as any;

  if (error || !newTurn) {
    throw new Error('Failed to create story turn: ' + error?.message);
  }

  return newTurn as StoryTurn;
}

/**
 * Mark a turn as having an error
 */
export async function markTurnAsError(
  turnId: string,
  userId: string
): Promise<void> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const updatePromise = supabase
    .from('story_turns')
    .update({ error_flag: true })
    .eq('turn_id', turnId)
    .eq('user_id', userId);

  const result = await Promise.race([updatePromise, timeoutPromise]);
  const { error } = result as any;

  if (error) {
    throw new Error('Failed to mark turn as error: ' + error.message);
  }
}

/**
 * Delete a turn (usually only for error recovery)
 */
export async function deleteStoryTurn(
  turnId: string,
  userId: string
): Promise<void> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const deletePromise = supabase
    .from('story_turns')
    .delete()
    .eq('turn_id', turnId)
    .eq('user_id', userId);

  const result = await Promise.race([deletePromise, timeoutPromise]);
  const { error } = result as any;

  if (error) {
    throw new Error('Failed to delete story turn: ' + error.message);
  }
}

/**
 * Delete turns from a specific index onward
 */
export async function deleteStoryTurnsFromIndex(
  storyId: string,
  fromTurnIndex: number,
  userId: string
): Promise<void> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const deletePromise = supabase
    .from('story_turns')
    .delete()
    .eq('story_id', storyId)
    .eq('user_id', userId)
    .gte('turn_index', fromTurnIndex);

  const result = await Promise.race([deletePromise, timeoutPromise]);
  const { error } = result as any;

  if (error) {
    throw new Error('Failed to delete story turns: ' + error.message);
  }
}
