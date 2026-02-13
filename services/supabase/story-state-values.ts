/**
 * Story State Values Service (Supabase)
 */

import { supabase, type DbClient } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { StoryStateValue } from '@/types';

/**
 * Get all state values for a story character
 */
export async function getStateValues(
  storyId: string,
  storyCharacterId: string,
  userId: string
): Promise<StoryStateValue[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('story_state_values')
      .select('*')
      .eq('story_id', storyId)
      .eq('story_character_id', storyCharacterId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to fetch state values: ' + error.message);
    }

    return (data || []) as StoryStateValue[];
  });
}

/**
 * Get all state values for a story (all characters)
 */
export async function getAllStateValuesForStory(
  storyId: string,
  userId: string,
  db?: DbClient
): Promise<StoryStateValue[]> {
  const client = db || supabase;
  return withRetry(async () => {
    const { data, error } = await client
      .from('story_state_values')
      .select('*')
      .eq('story_id', storyId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to fetch state values: ' + error.message);
    }

    return (data || []) as StoryStateValue[];
  });
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
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('story_state_values')
      .select('*')
      .eq('story_id', storyId)
      .eq('story_character_id', storyCharacterId)
      .eq('schema_key', schemaKey)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error('Failed to fetch state value: ' + error.message);
    }

    return data as StoryStateValue;
  });
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

  return withRetry(async () => {
    // Upsert: insert if not exists, update if exists
    const { data: stateValue, error } = await (supabase
      .from('story_state_values') as any)
      .upsert(payload, {
        onConflict: 'story_id,story_character_id,schema_key',
      })
      .select()
      .single();

    if (error || !stateValue) {
      throw new Error('Failed to set state value: ' + error?.message);
    }

    return stateValue as StoryStateValue;
  });
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
  }>,
  db?: DbClient
): Promise<StoryStateValue[]> {
  const client = db || supabase;
  const payload = values.map((v) => ({
    user_id: userId,
    ...v,
  }));

  return withRetry(async () => {
    const { data: stateValues, error } = await (client
      .from('story_state_values') as any)
      .upsert(payload, {
        onConflict: 'story_id,story_character_id,schema_key',
      })
      .select();

    if (error || !stateValues) {
      throw new Error('Failed to set state values: ' + error?.message);
    }

    return stateValues as StoryStateValue[];
  });
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
  return withRetry(async () => {
    const { error } = await supabase
      .from('story_state_values')
      .delete()
      .eq('story_id', storyId)
      .eq('story_character_id', storyCharacterId)
      .eq('schema_key', schemaKey)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to delete state value: ' + error.message);
    }
  });
}

/**
 * Delete all state values for a story character
 */
export async function deleteAllStateValues(
  storyId: string,
  storyCharacterId: string,
  userId: string
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('story_state_values')
      .delete()
      .eq('story_id', storyId)
      .eq('story_character_id', storyCharacterId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to delete state values: ' + error.message);
    }
  });
}
