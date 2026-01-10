/**
 * Narrative Agent Service
 * Generates narrative text and dialogue based on story context
 */

import { callOpenRouterJsonWithRetry } from '@/services/ai/openrouter';
import type {
  NarrativeAgentInput,
  NarrativeAgentOutput,
  OpenRouterMessage,
} from '@/types/api/agents';

/**
 * Build the system prompt for the narrative agent
 */
function buildNarrativeSystemPrompt(input: NarrativeAgentInput): string {
  const { story_mode, world_rules, story_prompt, characters, relationships } = input;

  // Find the player character using is_player field
  const playerCharacter = characters.find(c => c.is_player);

  let prompt = `You are a creative narrative AI for an interactive story game.

# World Rules
${world_rules}

# Story Prompt
${story_prompt}

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

# Relationships
${relationships.length > 0
      ? relationships
        .map((rel) => {
          const fromChar = characters.find((c) => c.story_character_id === rel.from_character_id);
          const toChar = characters.find((c) => c.story_character_id === rel.to_character_id);
          return `${fromChar?.display_name} → ${toChar?.display_name}: Score ${rel.score}${rel.tags.length > 0 ? `, Tags: ${rel.tags.join(', ')}` : ''}`;
        })
        .join('\n')
      : 'No relationships defined yet.'
    }

# Your Task
Based on the user's input, generate:
1. **Narrative**: A vivid, engaging description of what happens (2-4 paragraphs)
2. **Dialogue**: Any spoken words by characters (if applicable)
3. **Scene Tags**: Keywords describing the scene (e.g., "combat", "social", "exploration")
4. **System Notes**: Internal notes about what happened (for state tracking)

# Response Format
Respond with ONLY a valid JSON object (no markdown, no code blocks):

{
  "narrative": "The narrative text here...",
  "dialogue": [
    {
      "speaker_story_character_id": "character_id",
      "text": "What they said"
    }
  ],
  "scene_tags": ["tag1", "tag2"],
  "system_notes": ["Note about what happened for state tracking"]
}

IMPORTANT:
- Write in Traditional Chinese (繁體中文)
- Stay true to the world rules and character personalities
- Make the narrative engaging and immersive
- Dialogue should feel natural and character-appropriate
- System notes should be concise observations about state changes (e.g., "Character took damage", "Gained new item")
${story_mode === 'PLAYER_CHARACTER' && playerCharacter
      ? `- Remember: ${playerCharacter.display_name} is controlled by the player. Describe their actions based on the player's input, but don't control their internal decisions.`
      : ''}`;

  return prompt;
}

/**
 * Build the conversation history for context
 */
function buildConversationHistory(input: NarrativeAgentInput): OpenRouterMessage[] {
  const messages: OpenRouterMessage[] = [];

  // Add system prompt
  messages.push({
    role: 'system',
    content: buildNarrativeSystemPrompt(input),
  });

  // Add recent turns for context (last 5 turns)
  const recentTurns = input.recent_turns.slice(-5);
  recentTurns.forEach((turn) => {
    // User input
    messages.push({
      role: 'user',
      content: turn.user_input,
    });

    // AI response (narrative + dialogue)
    let response = turn.narrative;
    if (turn.dialogue.length > 0) {
      response += '\n\n對話:\n';
      turn.dialogue.forEach((d) => {
        const speaker = input.characters.find(
          (c) => c.story_character_id === d.speaker_story_character_id
        );
        response += `${speaker?.display_name}: ${d.text}\n`;
      });
    }

    messages.push({
      role: 'assistant',
      content: response,
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
 * Call the Narrative Agent to generate story content
 */
export async function callNarrativeAgent(
  apiKey: string,
  model: string,
  input: NarrativeAgentInput,
  params?: Record<string, any>
): Promise<NarrativeAgentOutput> {
  const messages = buildConversationHistory(input);

  // Log the system prompt for debugging
  const playerChar = input.characters.find(c => c.is_player);
  console.log('[callNarrativeAgent] 角色數量:', input.characters.length);
  console.log('[callNarrativeAgent] 最近回合數:', input.recent_turns.length);
  console.log('[callNarrativeAgent] 玩家角色:', playerChar?.display_name || '無（導演模式）');

  // Default parameters for narrative generation
  const defaultParams = {
    temperature: 0.8,
    max_tokens: 2000,
    top_p: 0.9,
    ...params,
  };

  try {
    const response = await callOpenRouterJsonWithRetry<NarrativeAgentOutput>(
      apiKey,
      messages,
      model,
      defaultParams,
      2
    );

    const parsed = response.parsed;

    // Log the parsed response for debugging
    console.log('[callNarrativeAgent] 解析後的回應:', JSON.stringify(parsed, null, 2).substring(0, 500));
    console.log('[callNarrativeAgent] 回應物件的鍵:', Object.keys(parsed || {}));

    // Validate required fields
    if (!parsed || typeof parsed !== 'object') {
      console.error('[callNarrativeAgent] 解析結果不是物件:', parsed);
      throw new Error('AI 回應格式錯誤：不是有效的 JSON 物件');
    }

    if (!parsed.narrative) {
      console.error('[callNarrativeAgent] 缺少 narrative 欄位。完整回應:', JSON.stringify(parsed));
      console.error('[callNarrativeAgent] 原始回應:', response.raw);
      throw new Error('AI 回應格式錯誤：缺少 narrative 欄位');
    }

    // Ensure arrays exist
    return {
      narrative: parsed.narrative,
      dialogue: parsed.dialogue || [],
      scene_tags: parsed.scene_tags || [],
      system_notes: parsed.system_notes || [],
    };
  } catch (error) {
    console.error('Narrative agent error:', error);
    throw error;
  }
}
