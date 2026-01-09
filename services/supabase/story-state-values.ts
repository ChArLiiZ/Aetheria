/**
 * Story State Values Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import type { StoryStateValue } from '@/types';

/**
 * Get all state values for a story character
 */
export async function getStateValues(
  storyId: string,
  storyCharacterId: string,
  userId: string
): Promise<StoryStateValue[]> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const fetchPromise = supabase
    .from('story_state_values')
    .select('*')
    .eq('story_id', storyId)
    .eq('story_character_id', storyCharacterId)
    .eq('user_id', userId);

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    throw new Error('Failed to fetch state values: ' + error.message);
  }

  return (data || []) as StoryStateValue[];
}

/**
 * Get all state values for a story (all characters)
 */
export async function getAllStateValuesForStory(
  storyId: string,
  userId: string
): Promise<StoryStateValue[]> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const fetchPromise = supabase
    .from('story_state_values')
    .select('*')
    .eq('story_id', storyId)
    .eq('user_id', userId);

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    throw new Error('Failed to fetch state values: ' + error.message);
  }

  return (data || []) as StoryStateValue[];
}

/**
 * Get a specific state value
 */
export async function getStateValue(
  storyId: string,
  storyCharacterId: string,
  schemaKey: string,
  userId: string
): Promise<StoryStateValue | null> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const fetchPromise = supabase
    .from('story_state_values')
    .select('*')
    .eq('story_id', storyId)
    .eq('story_character_id', storyCharacterId)
    .eq('schema_key', schemaKey)
    .eq('user_id', userId)
    .single();

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error('Failed to fetch state value: ' + error.message);
  }

  return data as StoryStateValue;
}

/**
 * Set a state value (insert or update)
 */
export async function setStateValue(
  userId: string,
  data: {
    story_id: string;
    story_character_id: string;
    schema_key: string;
    value_json: string;
  }
): Promise<StoryStateValue> {
  const payload = {
    user_id: userId,
    story_id: data.story_id,
    story_character_id: data.story_character_id,
    schema_key: data.schema_key,
    value_json: data.value_json,
  };

  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  // Upsert: insert if not exists, update if exists
  const upsertPromise = supabase
    .from('story_state_values')
    .upsert(payload, {
      onConflict: 'story_id,story_character_id,schema_key',
    })
    .select()
    .single();

  const result = await Promise.race([upsertPromise, timeoutPromise]);
  const { data: stateValue, error } = result as any;

  if (error || !stateValue) {
    throw new Error('Failed to set state value: ' + error?.message);
  }

  return stateValue as StoryStateValue;
}

/**
 * Set multiple state values at once
 */
export async function setMultipleStateValues(
  userId: string,
  values: Array<{
    story_id: string;
    story_character_id: string;
    schema_key: string;
    value_json: string;
  }>
): Promise<StoryStateValue[]> {
  const payload = values.map((v) => ({
    user_id: userId,
    ...v,
  }));

  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const upsertPromise = supabase
    .from('story_state_values')
    .upsert(payload, {
      onConflict: 'story_id,story_character_id,schema_key',
    })
    .select();

  const result = await Promise.race([upsertPromise, timeoutPromise]);
  const { data: stateValues, error } = result as any;

  if (error || !stateValues) {
    throw new Error('Failed to set state values: ' + error?.message);
  }

  return stateValues as StoryStateValue[];
}

/**
 * Delete a state value
 */
export async function deleteStateValue(
  storyId: string,
  storyCharacterId: string,
  schemaKey: string,
  userId: string
): Promise<void> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const deletePromise = supabase
    .from('story_state_values')
    .delete()
    .eq('story_id', storyId)
    .eq('story_character_id', storyCharacterId)
    .eq('schema_key', schemaKey)
    .eq('user_id', userId);

  const result = await Promise.race([deletePromise, timeoutPromise]);
  const { error } = result as any;

  if (error) {
    throw new Error('Failed to delete state value: ' + error.message);
  }
}

/**
 * Delete all state values for a story character
 */
export async function deleteAllStateValues(
  storyId: string,
  storyCharacterId: string,
  userId: string
): Promise<void> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const deletePromise = supabase
    .from('story_state_values')
    .delete()
    .eq('story_id', storyId)
    .eq('story_character_id', storyCharacterId)
    .eq('user_id', userId);

  const result = await Promise.race([deletePromise, timeoutPromise]);
  const { error } = result as any;

  if (error) {
    throw new Error('Failed to delete state values: ' + error.message);
  }
}
