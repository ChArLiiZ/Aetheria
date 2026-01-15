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
    const { story_mode, world_rules, story_prompt, characters, world_schema, current_states } = input;

    // Find the player character using is_player field
    const playerCharacter = characters.find(c => c.is_player);

    let prompt = `You are an AI storyteller for an interactive story game. Your job is to:
1. Generate engaging narrative text based on the user's input
2. Determine what state changes should occur

# World Rules
${world_rules}

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
                let desc = `**${schema.display_name}** (key: ${schema.schema_key})
- Type: ${schema.type}
- Description: ${schema.ai_description}`;

                if (schema.type === 'enum' && schema.enum_options) {
                    desc += `\n- Options: ${schema.enum_options.join(', ')}`;
                }

                if (schema.type === 'number' && schema.number_constraints) {
                    const c = schema.number_constraints;
                    if (c.min !== undefined) desc += `\n- Min: ${c.min}`;
                    if (c.max !== undefined) desc += `\n- Max: ${c.max}`;
                    if (c.unit) desc += `\n- Unit: ${c.unit}`;
                }

                return desc;
            })
            .join('\n\n')}

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

# CRITICAL: State Update Requirements

You MUST proactively update states whenever the narrative implies a change:

**Always Update These States:**
- **Location**: Update EVERY TIME a character moves or their position changes, even for small movements
- **Health/Status**: Update when characters take damage, heal, or change condition
- **Inventory/Items**: Update when characters gain, lose, or use items
- **Resources (mana, stamina, etc.)**: Update when characters use abilities or rest
- **Any situational states**: If a state exists in the schema and your narrative mentions it, update it

**How to Track State Changes:**
1. After writing your narrative, review it sentence by sentence
2. Ask yourself: "Did this sentence describe any state change?"
3. If yes, add the corresponding state_change
4. Don't skip obvious changes just because they seem minor

**Example:**
❌ BAD: Narrative mentions "Alice walks to the forest" but no location update
✅ GOOD: Narrative + state_change for Alice.location from "village" to "forest"

❌ BAD: Narrative mentions "Bob uses a healing spell on himself" but no mana/health update
✅ GOOD: Narrative + state_change for Bob.mana (decreased) and Bob.health (increased)

# Your Task
Based on the user's input, generate:
1. **Narrative**: A vivid, engaging description of what happens (2-4 paragraphs).
   - Character dialogue MUST be naturally woven INTO the narrative flow, not listed at the end.
   - Use Markdown quote block format for dialogue: > **角色名**：「對話內容」
   - Dialogue should appear at the natural moment when the character speaks.

   **GOOD Example (dialogue woven naturally):**
   凜的冰藍眼眸微微柔和，轉向身旁的櫻。

   > **凜**：「放心，我會保護好妳的。」

   她冷淡的語調中帶著罕見的溫柔，雪白短髮在微風中輕輕晃動。

   **BAD Example (dialogue listed at end - DO NOT DO THIS):**
   凜的冰藍眼眸微微柔和，轉向身旁的櫻，冷淡的語調中帶著罕見的溫柔。

   > **凜**：「放心，我會保護好妳的。」

2. **State Changes**: Determine what state changes should occur based on the narrative.
   - Review your narrative and identify ALL implied state changes
   - Err on the side of updating states when in doubt
   - Missing a state update is worse than adding one unnecessarily

# Response Format
Respond with ONLY a valid JSON object (no markdown, no code blocks):

{
  "narrative": "敘事文字... 對話使用 > **角色名**：「對話」 格式，自然穿插在敘事中",
  "state_changes": [
    {
      "target_story_character_id": "character_id",
      "schema_key": "state_key",
      "op": "set" | "inc",
      "value": <number | string | boolean>,
      "reason": "Why this change happened"
    }
  ],
  "list_ops": [
    {
      "target_story_character_id": "character_id",
      "schema_key": "list_key",
      "op": "push" | "remove" | "set",
      "value": "item" | ["item1", "item2"],
      "reason": "Why this change happened"
    }
  ]
}

IMPORTANT:
- Write in Traditional Chinese (繁體中文)
- Stay true to the world rules and character personalities
- Make the narrative engaging and immersive
- **CRITICAL: Dialogue MUST be naturally woven into the narrative at the moment characters speak, NOT listed separately at the end**
- Each dialogue line should be surrounded by narrative description before AND after
- **Accurately reflect ALL state changes that occur in the narrative**
- Err on the side of updating states when in doubt - missing updates is worse than extra updates
- Provide clear reasons for each state change
- Respect the constraints of each field type (min/max for numbers, enum options, etc.)
- Empty arrays are fine if no changes are needed (but try to avoid this for states clearly affected by the narrative)
${story_mode === 'PLAYER_CHARACTER' && playerCharacter
            ? `- Remember: ${playerCharacter.display_name} is controlled by the player. Describe their actions based on the player's input, but don't control their internal decisions.`
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
        max_tokens: 3000,
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
