// @ts-nocheck
/**
 * Story Summaries Service (Supabase)
 * 管理滾動摘要歷史
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { StorySummary } from '@/types';

/**
 * Create a new story summary
 */
export async function createStorySummary(
    userId: string,
    data: {
        story_id: string;
        generated_at_turn: number;
        summary_text: string;
    }
): Promise<StorySummary> {
    const payload = {
        user_id: userId,
        story_id: data.story_id,
        generated_at_turn: data.generated_at_turn,
        summary_text: data.summary_text,
    };

    return withRetry(async () => {
        const { data: newSummary, error } = await supabase
            .from('story_summaries')
            .insert(payload)
            .select()
            .single();

        if (error || !newSummary) {
            throw new Error('Failed to create story summary: ' + error?.message);
        }

        return newSummary as StorySummary;
    }, { operationName: 'createStorySummary' });
}

/**
 * Get the latest applicable summary for a given turn
 * 取得適用於指定回合的摘要（generated_at_turn < turnIndex 且最新的一筆）
 */
export async function getLatestSummaryForTurn(
    storyId: string,
    turnIndex: number,
    userId: string
): Promise<StorySummary | null> {
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('story_summaries')
            .select('*')
            .eq('story_id', storyId)
            .eq('user_id', userId)
            .lt('generated_at_turn', turnIndex)
            .order('generated_at_turn', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            throw new Error('Failed to fetch story summary: ' + error.message);
        }

        return data as StorySummary | null;
    }, { operationName: 'getLatestSummaryForTurn' });
}

/**
 * Get the most recent summary for a story (regardless of turn)
 */
export async function getLatestSummary(
    storyId: string,
    userId: string
): Promise<StorySummary | null> {
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('story_summaries')
            .select('*')
            .eq('story_id', storyId)
            .eq('user_id', userId)
            .order('generated_at_turn', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            throw new Error('Failed to fetch latest summary: ' + error.message);
        }

        return data as StorySummary | null;
    }, { operationName: 'getLatestSummary' });
}

/**
 * Delete summaries generated after a specific turn (for rollback)
 */
export async function deleteSummariesAfterTurn(
    storyId: string,
    afterTurnIndex: number,
    userId: string
): Promise<void> {
    return withRetry(async () => {
        const { error } = await supabase
            .from('story_summaries')
            .delete()
            .eq('story_id', storyId)
            .eq('user_id', userId)
            .gte('generated_at_turn', afterTurnIndex);

        if (error) {
            throw new Error('Failed to delete summaries: ' + error.message);
        }
    }, { operationName: 'deleteSummariesAfterTurn' });
}

/**
 * Get all summaries for a story (for debugging/admin)
 */
export async function getAllSummaries(
    storyId: string,
    userId: string
): Promise<StorySummary[]> {
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('story_summaries')
            .select('*')
            .eq('story_id', storyId)
            .eq('user_id', userId)
            .order('generated_at_turn', { ascending: true });

        if (error) {
            throw new Error('Failed to fetch summaries: ' + error.message);
        }

        return (data || []) as StorySummary[];
    }, { operationName: 'getAllSummaries' });
}
