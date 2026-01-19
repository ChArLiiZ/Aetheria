/**
 * Story Update Check Service
 *
 * 檢查故事使用的世界觀、狀態定義、角色是否有更新，
 * 用於顯示提示給使用者。
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';

export interface StoryUpdateCheck {
    hasUpdates: boolean;
    worldUpdated: boolean;
    schemaUpdated: boolean;
    charactersUpdated: string[]; // 更新過的角色名稱列表
}

/**
 * 檢查故事相關資源是否有更新
 *
 * 效能優化：使用單一查詢取得所有需要的資料，避免多次 API 呼叫
 *
 * @param storyId - 故事 ID
 * @param userId - 使用者 ID
 * @returns 更新檢查結果
 */
export async function checkStoryUpdates(
    storyId: string,
    userId: string
): Promise<StoryUpdateCheck> {
    return withRetry(async () => {
        // 使用單一查詢取得故事及其相關資料
        const { data: story, error: storyError } = await (supabase
            .from('stories')
            .select(`
        story_id,
        updated_at,
        world_id,
        worlds!inner (
          world_id,
          updated_at
        )
      `)
            .eq('story_id', storyId)
            .eq('user_id', userId)
            .single() as any);

        if (storyError || !story) {
            console.error('[checkStoryUpdates] 無法取得故事:', storyError);
            return {
                hasUpdates: false,
                worldUpdated: false,
                schemaUpdated: false,
                charactersUpdated: [],
            };
        }

        // 使用 story.updated_at 作為比較基準
        // 這樣重新開始故事後（會更新 updated_at），就不會再顯示更新提示
        const storyLastUpdated = new Date(story.updated_at);
        const worldData = story.worlds as unknown as { world_id: string; updated_at: string };

        // 檢查世界觀是否更新
        const worldUpdatedAt = new Date(worldData.updated_at);
        const worldUpdated = worldUpdatedAt > storyLastUpdated;

        // 取得狀態定義的最新更新時間
        const { data: schemaData } = await (supabase
            .from('world_state_schema')
            .select('updated_at')
            .eq('world_id', story.world_id)
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1) as any);

        const schemaUpdated = schemaData && schemaData.length > 0
            ? new Date(schemaData[0].updated_at) > storyLastUpdated
            : false;

        // 取得故事角色及原始角色的更新時間
        const { data: storyCharacters } = await (supabase
            .from('story_characters')
            .select(`
        story_character_id,
        character_id,
        characters!inner (
          character_id,
          canonical_name,
          updated_at
        )
      `)
            .eq('story_id', storyId)
            .eq('user_id', userId) as any);

        const charactersUpdated: string[] = [];

        if (storyCharacters) {
            for (const sc of storyCharacters) {
                const charData = sc.characters as unknown as {
                    character_id: string;
                    canonical_name: string;
                    updated_at: string;
                };

                // 比較角色更新時間與故事最後更新時間
                if (new Date(charData.updated_at) > storyLastUpdated) {
                    charactersUpdated.push(charData.canonical_name);
                }
            }
        }

        const hasUpdates = worldUpdated || schemaUpdated || charactersUpdated.length > 0;

        if (hasUpdates) {
            console.log('[checkStoryUpdates] 發現更新:', {
                worldUpdated,
                schemaUpdated,
                charactersUpdated,
            });
        }

        return {
            hasUpdates,
            worldUpdated,
            schemaUpdated,
            charactersUpdated,
        };
    });
}
