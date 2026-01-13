/**
 * Suggestion Agent Service
 * 根據故事上下文生成行動建議
 */

import { callOpenRouterJsonWithRetry } from '@/services/ai/openrouter';
import type {
    SuggestionAgentInput,
    SuggestionAgentOutput,
    OpenRouterMessage,
} from '@/types/api/agents';

/**
 * Build the system prompt for the suggestion agent
 */
function buildSuggestionSystemPrompt(input: SuggestionAgentInput): string {
    const { story_mode, world_rules, story_prompt, characters } = input;

    // Find the player character
    const playerCharacter = characters.find((c) => c.is_player);

    let prompt = `You are a creative assistant for an interactive story game. Your job is to suggest 3 interesting and contextually appropriate actions the player might take.

# World Rules
${world_rules}

# Story Prompt
${story_prompt}

${input.story_summary ? `# Story Summary (Previously)
${input.story_summary}
` : ''}
# Story Mode
${story_mode === 'PLAYER_CHARACTER'
            ? `Player Character Mode: The player controls ${playerCharacter?.display_name || 'a specific character'}. 
Suggest actions that this character would reasonably take.`
            : 'Director Mode: The player directs all characters and events. Suggest broader narrative directions.'
        }

# Characters
${characters
            .map((char) => {
                return `**${char.display_name}**${char.is_player ? ' 【Player Character】' : ''}
- Profile: ${char.core_profile}
- Current State: ${char.current_state_summary}`;
            })
            .join('\n\n')}

# Your Task
Generate exactly 3 action suggestions that:
1. Are interesting and advance the story
2. Fit the world rules and character personalities
3. Are varied in approach (e.g., cautious, bold, creative)
4. Are concise but descriptive (1-2 sentences each)

# Response Format
Respond with ONLY a valid JSON object (no markdown, no code blocks):

{
  "suggestions": [
    "建議行動一的描述",
    "建議行動二的描述",
    "建議行動三的描述"
  ]
}

IMPORTANT:
- Write in Traditional Chinese (繁體中文)
- Each suggestion should be actionable and specific
- Make suggestions diverse - offer different approaches
- Keep each suggestion concise (under 50 characters if possible)`;

    return prompt;
}

/**
 * Build the conversation history for context
 */
function buildConversationHistory(input: SuggestionAgentInput): OpenRouterMessage[] {
    const messages: OpenRouterMessage[] = [];

    // Add system prompt
    messages.push({
        role: 'system',
        content: buildSuggestionSystemPrompt(input),
    });

    // Add recent turns for context
    input.recent_turns.forEach((turn) => {
        messages.push({
            role: 'user',
            content: turn.user_input,
        });

        messages.push({
            role: 'assistant',
            content: turn.narrative,
        });
    });

    // Add a final prompt to generate suggestions
    messages.push({
        role: 'user',
        content: '請根據目前的故事情境，提供三個有趣的行動建議。',
    });

    return messages;
}

/**
 * Call the Suggestion Agent to generate action suggestions
 */
export async function callSuggestionAgent(
    apiKey: string,
    model: string,
    input: SuggestionAgentInput,
    params?: Record<string, any>
): Promise<SuggestionAgentOutput> {
    const messages = buildConversationHistory(input);

    console.log('[callSuggestionAgent] 角色數量:', input.characters.length);
    console.log('[callSuggestionAgent] 最近回合數:', input.recent_turns.length);

    // Use lower max_tokens since we only need short suggestions
    const defaultParams = {
        temperature: 0.8, // Slightly higher for creative suggestions
        max_tokens: 500,
        top_p: 0.9,
        ...params,
    };

    try {
        const response = await callOpenRouterJsonWithRetry<SuggestionAgentOutput>(
            apiKey,
            messages,
            model,
            defaultParams,
            1 // Only 1 retry for suggestions
        );

        const parsed = response.parsed;

        console.log('[callSuggestionAgent] 生成建議:', parsed.suggestions);

        // Validate
        if (!parsed || !Array.isArray(parsed.suggestions)) {
            throw new Error('AI 回應格式錯誤：缺少 suggestions 陣列');
        }

        // Ensure we have exactly 3 suggestions
        const suggestions = parsed.suggestions.slice(0, 3);
        while (suggestions.length < 3) {
            suggestions.push('繼續探索周圍環境');
        }

        return { suggestions };
    } catch (error) {
        console.error('Suggestion agent error:', error);
        throw error;
    }
}
