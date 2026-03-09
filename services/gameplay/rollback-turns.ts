/**
 * Rollback story state to a specific turn index by removing that turn and all
 * subsequent turns, while restoring state values.
 *
 * 注意：已移除 relationship 功能，只回溯 state 變更。
 */

import type { StoryTurn } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { getStoryTurns, deleteStoryTurnsFromIndex } from '@/services/supabase/story-turns';
import { getChangeLogsByTurnIds } from '@/services/supabase/change-log';
import { setMultipleStateValues, deleteStateValue } from '@/services/supabase/story-state-values';
import { updateStory } from '@/services/supabase/stories';

const parseJson = (value?: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export async function rollbackStoryToTurn(
  storyId: string,
  fromTurnIndex: number,
  userId: string
): Promise<StoryTurn[]> {
  const turns = await getStoryTurns(storyId, userId);
  const turnsToDelete = turns.filter((turn) => turn.turn_index >= fromTurnIndex);

  if (turnsToDelete.length === 0) {
    return turns;
  }

  const turnIds = turnsToDelete.map((turn) => turn.turn_id);
  const turnIndexMap = new Map(turnsToDelete.map((turn) => [turn.turn_id, turn.turn_index]));
  const changeLogs = await getChangeLogsByTurnIds(turnIds, userId);

  // Sort by turn index descending (reverse chronological order)
  const sortedLogs = [...changeLogs].sort((a, b) => {
    const indexA = turnIndexMap.get(a.turn_id) || 0;
    const indexB = turnIndexMap.get(b.turn_id) || 0;
    if (indexA !== indexB) {
      return indexB - indexA;
    }
    return a.change_id.localeCompare(b.change_id);
  });

  // Compute final before-values for each state key (batch approach)
  // 對每個 state key，只需最早的 before_value（即最終要還原的值）
  const restoreMap = new Map<string, { before: any; storyCharacterId: string; schemaKey: string }>();
  const deleteKeys = new Set<string>();

  for (const log of sortedLogs) {
    if (log.entity_type !== 'state') continue;
    if (!log.target_story_character_id || !log.schema_key) continue;

    const key = `${log.target_story_character_id}:${log.schema_key}`;
    // 倒序遍歷，後處理（較早的 turn）會覆蓋前面的，最終得到最早的 before_value
    const beforeValue = parseJson(log.before_value_json);
    if (beforeValue === null) {
      deleteKeys.add(key);
      restoreMap.delete(key);
    } else {
      deleteKeys.delete(key);
      restoreMap.set(key, {
        before: beforeValue,
        storyCharacterId: log.target_story_character_id,
        schemaKey: log.schema_key,
      });
    }
  }

  // Batch restore state values (single DB call instead of N calls)
  if (restoreMap.size > 0) {
    const valuesToRestore = Array.from(restoreMap.values()).map((v) => ({
      story_id: storyId,
      story_character_id: v.storyCharacterId,
      schema_key: v.schemaKey,
      value_json: JSON.stringify(v.before),
    }));
    await setMultipleStateValues(userId, valuesToRestore);
  }

  // Delete state values that didn't exist before (sequential, usually rare)
  for (const key of deleteKeys) {
    const [storyCharacterId, schemaKey] = key.split(':');
    await deleteStateValue(storyId, storyCharacterId, schemaKey, userId);
  }

  // Delete turns (change_log cascade deletes automatically)
  await deleteStoryTurnsFromIndex(storyId, fromTurnIndex, userId);

  // Clean up stale summaries generated at or after the rollback point
  await supabase
    .from('story_summaries')
    .delete()
    .eq('story_id', storyId)
    .eq('user_id', userId)
    .gte('generated_at_turn', fromTurnIndex);

  const remainingTurns = turns.filter((turn) => turn.turn_index < fromTurnIndex);
  const newTurnCount = remainingTurns.reduce(
    (max, turn) => Math.max(max, turn.turn_index),
    0
  );

  await updateStory(storyId, userId, { turn_count: newTurnCount });

  return remainingTurns;
}
