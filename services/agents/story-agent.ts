/**
 * Story Agent Service
 * 合併版 AI Agent - 同時處理敘事生成和狀態變更
 */

import { callOpenRouterJsonWithRetry } from '@/services/ai/openrouter';
import type {
    StoryAgentInput,
    StoryAgentOutput,
    OpenRouterMessage,
} from '@/types/api/agents';

/**
 * Build the system prompt for the story agent
 */
function buildStorySystemPrompt(input: StoryAgentInput): string {
    const { story_mode, world_description, world_rules, story_premise, story_prompt, characters, world_schema, current_states } = input;

    // Find the player character using is_player field
    const playerCharacter = characters.find(c => c.is_player);

    let prompt = `You are an AI storyteller managing a living, breathing story world.

# World Overview
${world_description}

# World Rules
${world_rules}

# Story Premise
${story_premise}

# Story Prompt
${story_prompt}

${input.story_summary ? `# 故事摘要（前情提要）
以下是故事至今的摘要，請參考以保持劇情連貫性：

${input.story_summary}
` : ''}
# Story Mode
${story_mode === 'PLAYER_CHARACTER'
            ? `Player Character Mode: The player controls one specific character${playerCharacter ? ` (${playerCharacter.display_name})` : ''}. 
Write from the perspective that the player's input represents the actions/thoughts of their character.
Never control the player character's internal thoughts or decisions - only describe their actions and the world's response.`
            : 'Director Mode: The player directs all characters and events as a narrator/director.'}

# Characters
${characters
            .map((char) => {
                return `**${char.display_name}** (ID: ${char.story_character_id})${char.is_player ? ' 【玩家角色】' : ''}
- Core Profile: ${char.core_profile}
${char.override_profile ? `- Story Override: ${char.override_profile}` : ''}
- Current State: ${char.current_state_summary}`;
            })
            .join('\n\n')}

# World State Schema
${world_schema
            .map((schema) => {
                let desc = `**${schema.display_name}** (${schema.schema_key}): ${schema.ai_description}`;

                if (schema.type === 'enum' && schema.enum_options) {
                    desc += ` [${schema.enum_options.join(', ')}]`;
                }

                if (schema.type === 'number' && schema.number_constraints) {
                    const c = schema.number_constraints;
                    const parts = [];
                    // Always show min/max constraints when defined to ensure AI respects the range
                    if (c.min !== undefined) parts.push(`min:${c.min}`);
                    if (c.max !== undefined) parts.push(`max:${c.max}`);
                    if (c.unit) parts.push(c.unit);
                    if (parts.length > 0) desc += ` (${parts.join(', ')})`;
                }

                return desc;
            })
            .join('\n')}

# Current State Values
${current_states.length > 0
            ? current_states
                .map((state) => {
                    const char = characters.find((c) => c.story_character_id === state.story_character_id);
                    const schema = world_schema.find((s) => s.schema_key === state.schema_key);
                    return `${char?.display_name}.${schema?.display_name}: ${JSON.stringify(state.current_value)}`;
                })
                .join('\n')
            : 'No state values set yet.'
        }

# CRITICAL: Living World State System

Every character is a living entity that exists continuously in the story world, not just when mentioned in the narrative.

**Core Principle: Universal State Review**
After generating your narrative, systematically review ALL characters' states, not just those mentioned:

1. **Passage of Time**: How much time passed? Update time-dependent states:
   - Resources that regenerate/deplete (stamina, mana, hunger)
   - Status effects with durations (buffs, debuffs, injuries)
   - Environmental conditions (weather, time of day)

2. **Background Activities**: What are off-screen characters doing?
   - Location changes from their ongoing activities
   - Resource consumption from their background actions
   - Inventory changes from their autonomous behavior

3. **Narrative-Driven Changes**: Update states for events you described:
   - Explicit actions (combat, movement, item use)
   - Implicit changes (emotional states, relationship shifts)

**Balance Principle**: Update states that *logically should change*. Don't update trivial states unnecessarily (e.g., a sleeping character's "alertness" every turn), but don't skip significant background changes either.

**Examples:**

✅ GOOD: User input: "I search the ruins."
- Narrative mentions only Player exploring
- State updates: Player.location ✓, Player.stamina ✓ (searching is tiring),
  Companion.location ✓ (following player), Companion.alertness ✓ (watching for danger)

❌ BAD: Only updating Player states because Companion wasn't mentioned in narrative

✅ GOOD: Narrative describes 6-hour journey
- All characters: stamina/hunger decreased, time-of-day updated
- Even characters not traveling: update their activities in that timeframe

**Review Checklist:**
□ Time passage → Update time-dependent states for ALL characters
□ Each character → What are they doing? Update location/activity states
□ Narrative events → Update directly-affected states
□ Resource usage → Update costs (mana, items, stamina)

# Your Task
Based on the user's input, generate:

1. **Narrative** (2-4 paragraphs):
   - Dialogue format: > **角色名**：「對話內容」
   - CRITICAL: Weave dialogue naturally into narrative flow, NOT listed at end

   Example:
   凜的冰藍眼眸微微柔和，轉向身旁的櫻。
   > **凜**：「放心，我會保護好妳的。」
   她冷淡的語調中帶著罕見的溫柔。

2. **State Changes**: Follow the Universal State Review from the CRITICAL section above.

# Response Format (JSON only, no markdown)

{
  "narrative": "敘事文字，對話用 > **角色名**：「對話」",
  "state_changes": [
    {"target_story_character_id": "id", "schema_key": "key",
     "op": "set|inc", "value": <value>, "reason": "explanation"}
  ],
  "list_ops": [
    {"target_story_character_id": "id", "schema_key": "key",
     "op": "push|remove|set", "value": "item", "reason": "explanation"}
  ]
}

Note: Empty arrays acceptable only if truly no changes occurred.

# Final Instructions

- Write in Traditional Chinese (繁體中文)
- Stay true to world rules and character personalities
- Follow the State Review Checklist from CRITICAL section
- Provide clear reasons for state changes
- Respect schema constraints (min/max, enum options)
${story_mode === 'PLAYER_CHARACTER' && playerCharacter
            ? `- ${playerCharacter.display_name} is player-controlled - describe their actions from input, don't control decisions`
            : ''}`;

    return prompt;
}

/**
 * Build the conversation history for context
 */
function buildConversationHistory(input: StoryAgentInput): OpenRouterMessage[] {
    const messages: OpenRouterMessage[] = [];

    // Add system prompt
    messages.push({
        role: 'system',
        content: buildStorySystemPrompt(input),
    });

    // Add recent turns for context
    input.recent_turns.forEach((turn) => {
        // User input
        messages.push({
            role: 'user',
            content: turn.user_input,
        });

        // AI response (narrative only, dialogue is now embedded)
        messages.push({
            role: 'assistant',
            content: turn.narrative,
        });
    });

    // Add current user input
    messages.push({
        role: 'user',
        content: input.user_input,
    });

    return messages;
}

/**
 * Call the Story Agent to generate narrative and state changes
 */
export async function callStoryAgent(
    apiKey: string,
    model: string,
    input: StoryAgentInput,
    params?: Record<string, any>
): Promise<StoryAgentOutput> {
    const messages = buildConversationHistory(input);

    // Log for debugging
    const playerChar = input.characters.find(c => c.is_player);
    console.log('[callStoryAgent] 角色數量:', input.characters.length);
    console.log('[callStoryAgent] 最近回合數:', input.recent_turns.length);
    console.log('[callStoryAgent] 玩家角色:', playerChar?.display_name || '無（導演模式）');
    console.log('[callStoryAgent] 狀態 Schema 數量:', input.world_schema.length);

    // Default parameters
    const defaultParams = {
        temperature: 0.7,
        top_p: 0.9,
        ...params,
    };

    try {
        const response = await callOpenRouterJsonWithRetry<StoryAgentOutput>(
            apiKey,
            messages,
            model,
            defaultParams,
            2
        );

        const parsed = response.parsed;

        // Log the parsed response for debugging
        console.log('[callStoryAgent] 解析後的回應預覽:', parsed.narrative?.substring(0, 200));
        console.log('[callStoryAgent] 狀態變更數量:', parsed.state_changes?.length || 0);
        console.log('[callStoryAgent] 列表操作數量:', parsed.list_ops?.length || 0);

        // 狀態變更統計（監控背景角色更新）
        const affectedCharacters = new Set([
            ...(parsed.state_changes || []).map(c => c.target_story_character_id),
            ...(parsed.list_ops || []).map(c => c.target_story_character_id)
        ]);

        const backgroundUpdates = (parsed.state_changes || []).filter(c =>
            c.reason && (
                c.reason.toLowerCase().includes('background') ||
                c.reason.toLowerCase().includes('時間') ||
                c.reason.toLowerCase().includes('背景') ||
                c.reason.toLowerCase().includes('passage of time') ||
                c.reason.toLowerCase().includes('regenerat')
            )
        );

        console.log('[callStoryAgent] 狀態變更統計:', {
            totalChanges: (parsed.state_changes?.length || 0) + (parsed.list_ops?.length || 0),
            affectedCharacters: affectedCharacters.size,
            backgroundUpdates: backgroundUpdates.length
        });

        // Validate required fields
        if (!parsed || typeof parsed !== 'object') {
            console.error('[callStoryAgent] 解析結果不是物件:', parsed);
            throw new Error('AI 回應格式錯誤：不是有效的 JSON 物件');
        }

        if (!parsed.narrative) {
            console.error('[callStoryAgent] 缺少 narrative 欄位');
            throw new Error('AI 回應格式錯誤：缺少 narrative 欄位');
        }

        // Ensure arrays exist
        return {
            narrative: parsed.narrative,
            state_changes: parsed.state_changes || [],
            list_ops: parsed.list_ops || [],
        };
    } catch (error) {
        console.error('Story agent error:', error);
        throw error;
    }
}
