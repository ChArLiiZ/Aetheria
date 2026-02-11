/**
 * Story Reset Service
 *
 * 提供重新開始故事的功能：保留故事設定（世界、角色、提示詞等），
 * 但清除所有遊玩記錄（回合、狀態變更、摘要等）並重置狀態值。
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { Story, StoryCharacter, WorldStateSchema } from '@/types';
import { GLOBAL_STATE_ID } from '@/types';
import { getStoryById } from './stories';
import { getStoryCharacters } from './story-characters';
import { getSchemaByWorldId } from './world-schema';
import { setMultipleStateValues } from './story-state-values';
import { getSchemaDefaultValue } from '@/utils/schema-defaults';

/**
 * 重新開始故事
 *
 * 此操作會：
 * 1. 刪除所有回合記錄 (story_turns) - change_log 會因為 ON DELETE CASCADE 自動刪除
 * 2. 刪除所有摘要記錄 (story_summaries)
 * 3. 重置所有狀態值為預設值 (story_state_values)
 * 4. 將 turn_count 重置為 0
 *
 * 保留：
 * - 故事基本資訊（標題、前提、提示詞等）
 * - 故事角色列表 (story_characters)
 * - 世界設定和 Schema
 *
 * @param storyId - 故事 ID
 * @param userId - 使用者 ID（用於驗證權限）
 */
export async function resetStory(
  storyId: string,
  userId: string
): Promise<void> {
  return withRetry(async () => {
    console.log(`[resetStory] 開始重置故事: ${storyId}`);

    // 1. 驗證故事存在且屬於該使用者
    const story = await getStoryById(storyId, userId);
    if (!story) {
      throw new Error('Story not found or access denied');
    }

    // 2. 取得故事角色和世界 Schema
    const [storyCharacters, worldSchema] = await Promise.all([
      getStoryCharacters(storyId, userId),
      getSchemaByWorldId(story.world_id, userId),
    ]);

    console.log(`[resetStory] 找到 ${storyCharacters.length} 個角色, ${worldSchema.length} 個狀態欄位`);

    // 3. 刪除所有回合記錄（change_log 會自動刪除因為 ON DELETE CASCADE）
    console.log('[resetStory] 刪除回合記錄...');
    const { error: turnsError } = await supabase
      .from('story_turns')
      .delete()
      .eq('story_id', storyId)
      .eq('user_id', userId);

    if (turnsError) {
      console.error('[resetStory] 刪除回合記錄失敗:', turnsError);
      throw new Error('Failed to delete story turns: ' + turnsError.message);
    }

    // 4. 刪除所有摘要記錄
    console.log('[resetStory] 刪除摘要記錄...');
    const { error: summariesError } = await supabase
      .from('story_summaries')
      .delete()
      .eq('story_id', storyId)
      .eq('user_id', userId);

    if (summariesError) {
      console.error('[resetStory] 刪除摘要記錄失敗:', summariesError);
      throw new Error('Failed to delete story summaries: ' + summariesError.message);
    }

    // 5. 刪除所有舊的狀態值記錄（確保套用最新的世界觀狀態定義）
    console.log('[resetStory] 刪除舊狀態值...');
    const { error: deleteStateError } = await supabase
      .from('story_state_values')
      .delete()
      .eq('story_id', storyId)
      .eq('user_id', userId);

    if (deleteStateError) {
      console.error('[resetStory] 刪除舊狀態值失敗:', deleteStateError);
      throw new Error('Failed to delete old state values: ' + deleteStateError.message);
    }

    // 6. 根據最新的世界觀重新建立所有狀態值
    console.log('[resetStory] 建立新狀態值...');
    const stateValues: Array<{
      story_id: string;
      story_character_id: string;
      schema_key: string;
      value_json: string;
    }> = [];

    const characterSchemas = worldSchema.filter((s) => s.scope !== 'global');
    const globalSchemas = worldSchema.filter((s) => s.scope === 'global');

    // Character-scoped states: one per character per schema
    storyCharacters.forEach((sc) => {
      characterSchemas.forEach((schema) => {
        const defaultValue = getSchemaDefaultValue(schema);
        stateValues.push({
          story_id: storyId,
          story_character_id: sc.story_character_id,
          schema_key: schema.schema_key,
          value_json: JSON.stringify(defaultValue),
        });
      });
    });

    // Global-scoped states: one per schema using sentinel ID
    globalSchemas.forEach((schema) => {
      const defaultValue = getSchemaDefaultValue(schema);
      stateValues.push({
        story_id: storyId,
        story_character_id: GLOBAL_STATE_ID,
        schema_key: schema.schema_key,
        value_json: JSON.stringify(defaultValue),
      });
    });

    if (stateValues.length > 0) {
      await setMultipleStateValues(userId, stateValues);
      console.log(`[resetStory] 已建立 ${stateValues.length} 個狀態值`);
    }

    // 7. 將 story 的 turn_count 重置為 0
    console.log('[resetStory] 重置回合計數...');
    const { error: updateError } = await (supabase
      .from('stories') as any)
      .update({
        turn_count: 0,
        updated_at: new Date().toISOString()
      })
      .eq('story_id', storyId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[resetStory] 重置回合計數失敗:', updateError);
      throw new Error('Failed to reset turn count: ' + updateError.message);
    }

    console.log('[resetStory] 故事重置完成');
  });
}

/**
 * 檢查故事是否有遊玩記錄
 *
 * @param storyId - 故事 ID
 * @param userId - 使用者 ID
 * @returns 是否有遊玩記錄（有回合記錄表示已開始遊玩）
 */
export async function hasStoryProgress(
  storyId: string,
  userId: string
): Promise<boolean> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('story_turns')
      .select('turn_id', { count: 'exact', head: true })
      .eq('story_id', storyId)
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      console.error('[hasStoryProgress] 檢查失敗:', error);
      return false;
    }

    return (data?.length ?? 0) > 0;
  });
}
