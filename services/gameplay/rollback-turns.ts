/**
 * Rollback story state to a specific turn index by removing that turn and all
 * subsequent turns, while restoring state values.
 * 
 * 注意：已移除 relationship 功能，只回溯 state 變更。
 */

import type { StoryTurn } from '@/types';
import { getStoryTurns, deleteStoryTurnsFromIndex } from '@/services/supabase/story-turns';
import { getChangeLogsByTurnIds } from '@/services/supabase/change-log';
import { setStateValue, deleteStateValue } from '@/services/supabase/story-state-values';
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

  // Revert state changes in reverse order
  for (const log of sortedLogs) {
    if (log.entity_type === 'state') {
      if (!log.target_story_character_id || !log.schema_key) continue;
      const beforeValue = parseJson(log.before_value_json);
      if (beforeValue === null) {
        await deleteStateValue(
          storyId,
          log.target_story_character_id,
          log.schema_key,
          userId
        );
      } else {
        await setStateValue(userId, {
          story_id: storyId,
          story_character_id: log.target_story_character_id,
          schema_key: log.schema_key,
          value_json: JSON.stringify(beforeValue),
        });
      }
    }
    // 注意：relationship 類型已移除，不再處理
  }

  await deleteStoryTurnsFromIndex(storyId, fromTurnIndex, userId);

  const remainingTurns = turns.filter((turn) => turn.turn_index < fromTurnIndex);
  const newTurnCount = remainingTurns.reduce(
    (max, turn) => Math.max(max, turn.turn_index),
    0
  );

  await updateStory(storyId, userId, { turn_count: newTurnCount });

  return remainingTurns;
}
