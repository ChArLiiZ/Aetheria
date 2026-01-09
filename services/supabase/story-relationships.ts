// @ts-nocheck
/**
 * Story Relationships Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import type { StoryRelationship } from '@/types';

/**
 * Get all relationships for a story
 */
export async function getStoryRelationships(
  storyId: string,
  userId: string
): Promise<StoryRelationship[]> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const fetchPromise = supabase
    .from('story_relationships')
    .select('*')
    .eq('story_id', storyId)
    .eq('user_id', userId);

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    throw new Error('Failed to fetch story relationships: ' + error.message);
  }

  return (data || []) as StoryRelationship[];
}

/**
 * Get a specific relationship
 */
export async function getRelationship(
  storyId: string,
  fromCharacterId: string,
  toCharacterId: string,
  userId: string
): Promise<StoryRelationship | null> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const fetchPromise = supabase
    .from('story_relationships')
    .select('*')
    .eq('story_id', storyId)
    .eq('from_story_character_id', fromCharacterId)
    .eq('to_story_character_id', toCharacterId)
    .eq('user_id', userId)
    .single();

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error('Failed to fetch relationship: ' + error.message);
  }

  return data as StoryRelationship;
}

/**
 * Set a relationship (upsert)
 */
export async function setRelationship(
  userId: string,
  data: {
    story_id: string;
    from_story_character_id: string;
    to_story_character_id: string;
    score: number;
    tags_json: string;
  }
): Promise<StoryRelationship> {
  const payload = {
    user_id: userId,
    ...data,
  };

  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const upsertPromise = supabase
    .from('story_relationships')
    .upsert(payload, {
      onConflict: 'story_id,from_story_character_id,to_story_character_id',
    })
    .select()
    .single();

  const result = await Promise.race([upsertPromise, timeoutPromise]);
  const { data: relationship, error } = result as any;

  if (error || !relationship) {
    throw new Error('Failed to set relationship: ' + error?.message);
  }

  return relationship as StoryRelationship;
}

/**
 * Update relationship score
 */
export async function updateRelationshipScore(
  storyId: string,
  fromCharacterId: string,
  toCharacterId: string,
  score: number,
  userId: string
): Promise<StoryRelationship> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const updatePromise = supabase
    .from('story_relationships')
    .update({ score })
    .eq('story_id', storyId)
    .eq('from_story_character_id', fromCharacterId)
    .eq('to_story_character_id', toCharacterId)
    .eq('user_id', userId)
    .select()
    .single();

  const result = await Promise.race([updatePromise, timeoutPromise]);
  const { data: relationship, error } = result as any;

  if (error || !relationship) {
    throw new Error('Failed to update relationship score: ' + error?.message);
  }

  return relationship as StoryRelationship;
}

/**
 * Update relationship tags
 */
export async function updateRelationshipTags(
  storyId: string,
  fromCharacterId: string,
  toCharacterId: string,
  tagsJson: string,
  userId: string
): Promise<StoryRelationship> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const updatePromise = supabase
    .from('story_relationships')
    .update({ tags_json: tagsJson })
    .eq('story_id', storyId)
    .eq('from_story_character_id', fromCharacterId)
    .eq('to_story_character_id', toCharacterId)
    .eq('user_id', userId)
    .select()
    .single();

  const result = await Promise.race([updatePromise, timeoutPromise]);
  const { data: relationship, error } = result as any;

  if (error || !relationship) {
    throw new Error('Failed to update relationship tags: ' + error?.message);
  }

  return relationship as StoryRelationship;
}

/**
 * Delete a relationship
 */
export async function deleteRelationship(
  storyId: string,
  fromCharacterId: string,
  toCharacterId: string,
  userId: string
): Promise<void> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const deletePromise = supabase
    .from('story_relationships')
    .delete()
    .eq('story_id', storyId)
    .eq('from_story_character_id', fromCharacterId)
    .eq('to_story_character_id', toCharacterId)
    .eq('user_id', userId);

  const result = await Promise.race([deletePromise, timeoutPromise]);
  const { error } = result as any;

  if (error) {
    throw new Error('Failed to delete relationship: ' + error.message);
  }
}
