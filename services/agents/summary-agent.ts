/**
 * Summary Agent Service
 * 專門負責生成故事滾動摘要
 */

import { callOpenRouterWithRetry } from '@/services/ai/openrouter';
import type { OpenRouterMessage } from '@/types/api/agents';
import type { RecentTurnContext } from '@/types/api/agents';

export interface SummaryAgentInput {
    /** 先前的摘要（如果有） */
    previous_summary?: string;
    /** 需要被摘要的回合 */
    turns_to_summarize: RecentTurnContext[];
}

/**
 * Build the system prompt for summary generation
 */
function buildSummarySystemPrompt(): string {
    return `你是一個故事摘要助手。你的任務是將故事的對話歷史壓縮成簡潔的摘要。

# 輸出規則
1. 直接輸出摘要文字，不要使用 JSON 格式
2. 使用繁體中文
3. 摘要長度控制在 300-500 字以內
4. 保持客觀的第三人稱視角

# 應保留的重要資訊
- 重要的劇情轉折和事件
- 角色間關係的變化（結盟、背叛、戀愛等）
- 獲得或失去的重要物品
- 揭露的重要秘密或線索
- 地點的重大變化
- 角色的重要決定

# 應省略的內容
- 日常對話和寒暄
- 重複的行動描述
- 不影響劇情的細節

# 摘要格式範例
故事開始於古老的魔法森林。主角小明在森林深處遇見了神秘的精靈莉莉，兩人結為盟友。
在探索過程中，他們發現了被封印的惡魔之門，並從守門人那裡得知需要三把鑰匙才能永久封印它。
目前小明已獲得火焰之鑰，莉莉則透露她的真實身份是精靈公主，正在逃避王國的追兵...`;
}

/**
 * Build the conversation for summary generation
 */
function buildSummaryMessages(input: SummaryAgentInput): OpenRouterMessage[] {
    const messages: OpenRouterMessage[] = [];

    // System prompt
    messages.push({
        role: 'system',
        content: buildSummarySystemPrompt(),
    });

    // Build user request
    let userContent = '';

    if (input.previous_summary) {
        userContent += `【先前摘要】\n${input.previous_summary}\n\n`;
    }

    userContent += '【最近發生的事件】\n';
    input.turns_to_summarize.forEach((turn) => {
        userContent += `---\n玩家輸入：${turn.user_input}\n敘述：${turn.narrative}\n`;
    });

    userContent += '\n請根據以上內容，生成一個整合的故事摘要。如果有先前摘要，請將新事件融入其中。';

    messages.push({
        role: 'user',
        content: userContent,
    });

    return messages;
}

/**
 * Call the Summary Agent to generate a rolling summary
 */
export async function callSummaryAgent(
    apiKey: string,
    model: string,
    previousSummary: string | undefined,
    turnsToSummarize: RecentTurnContext[],
    params?: Record<string, any>
): Promise<string> {
    const input: SummaryAgentInput = {
        previous_summary: previousSummary,
        turns_to_summarize: turnsToSummarize,
    };

    const messages = buildSummaryMessages(input);

    console.log('[callSummaryAgent] 開始生成摘要...');
    console.log('[callSummaryAgent] 先前摘要長度:', previousSummary?.length || 0);
    console.log('[callSummaryAgent] 待摘要回合數:', turnsToSummarize.length);

    // Default parameters for summary generation
    const defaultParams = {
        temperature: 0.5,
        top_p: 0.9,
        ...params,
        max_tokens: 4000,
    };

    try {
        const response = await callOpenRouterWithRetry(
            apiKey,
            messages,
            model,
            defaultParams,
            1
        );

        const summary = response.content.trim();
        console.log('[callSummaryAgent] 摘要生成完成，長度:', summary.length);

        return summary;
    } catch (error) {
        console.error('[callSummaryAgent] 摘要生成失敗:', error);
        throw error;
    }
}
