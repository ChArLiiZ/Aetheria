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

  let prompt = `You are a creative narrative AI for an interactive story game.

# World Rules
${world_rules}

# Story Prompt
${story_prompt}

# Story Mode
${story_mode === 'PLAYER_CHARACTER' ? 'Player Character Mode: The player controls one specific character.' : 'Director Mode: The player directs all characters and events.'}

# Characters
${characters
  .map((char) => {
    return `**${char.display_name}** (ID: ${char.story_character_id})
- Core Profile: ${char.core_profile}
${char.override_profile ? `- Story Override: ${char.override_profile}` : ''}
- Current State: ${char.current_state_summary}`;
  })
  .join('\n\n')}

# Relationships
${
  relationships.length > 0
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
- System notes should be concise observations about state changes (e.g., "Character took damage", "Gained new item")`;

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

    // Validate required fields
    if (!parsed.narrative) {
      throw new Error('Narrative agent response missing required field: narrative');
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
