/**
 * State Delta Agent Service
 * Analyzes narrative output and determines state changes
 */

import { callOpenRouterWithRetry, parseJsonResponse } from '@/services/ai/openrouter';
import type {
  StateDeltaAgentInput,
  StateDeltaAgentOutput,
  OpenRouterMessage,
} from '@/types/api/agents';

/**
 * Build the system prompt for the state delta agent
 */
function buildStateDeltaSystemPrompt(input: StateDeltaAgentInput): string {
  const { world_schema, characters, current_states, relationships } = input;

  let prompt = `You are a state tracking AI for an interactive story game. Your job is to analyze what happened in the narrative and determine what state changes should occur.

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

# Characters
${characters.map((char) => `- ${char.display_name} (ID: ${char.story_character_id})`).join('\n')}

# Current State Values
${
  current_states.length > 0
    ? current_states
        .map((state) => {
          const char = characters.find((c) => c.story_character_id === state.story_character_id);
          const schema = world_schema.find((s) => s.schema_key === state.schema_key);
          return `${char?.display_name}.${schema?.display_name}: ${JSON.stringify(state.current_value)}`;
        })
        .join('\n')
    : 'No state values set yet.'
}

# Current Relationships
${
  relationships.length > 0
    ? relationships
        .map((rel) => {
          const fromChar = characters.find((c) => c.story_character_id === rel.from_story_character_id);
          const toChar = characters.find((c) => c.story_character_id === rel.to_story_character_id);
          return `${fromChar?.display_name} → ${toChar?.display_name}: ${rel.score}, Tags: [${rel.tags.join(', ')}]`;
        })
        .join('\n')
    : 'No relationships defined yet.'
}

# Your Task
Based on the user input and narrative output (including system notes), determine what state changes should occur.

# Available Operations

## State Changes (for number, text, bool, enum fields)
- **set**: Set to exact value
- **inc**: Increment/decrement (numbers only)

## List Operations (for list_text fields)
- **push**: Add item(s) to list
- **remove**: Remove item(s) from list
- **set**: Replace entire list

## Relationship Changes
- **set_score**: Set relationship score to exact value
- **inc_score**: Increment/decrement relationship score
- **add**: Add relationship tags
- **remove**: Remove relationship tags

# Response Format
Respond with ONLY a valid JSON object (no markdown, no code blocks):

{
  "changes": [
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
  ],
  "relationship_changes": [
    {
      "from_story_character_id": "char_id_1",
      "to_story_character_id": "char_id_2",
      "op": "inc_score" | "set_score",
      "value": <number>,
      "tag_ops": [
        {
          "op": "add" | "remove",
          "value": "tag_name"
        }
      ],
      "reason": "Why this change happened"
    }
  ]
}

IMPORTANT:
- Only suggest changes that are clearly supported by the narrative
- Be conservative - don't make up changes
- Provide clear reasons for each change
- Respect the constraints of each field type (min/max for numbers, enum options, etc.)
- Empty arrays are fine if no changes are needed
- Relationship scores typically range from -100 to 100`;

  return prompt;
}

/**
 * Build the user message with context
 */
function buildUserMessage(input: StateDeltaAgentInput): string {
  const { narrative_output, user_input } = input;

  let message = `# User Input
${user_input}

# Narrative Output
${narrative_output.narrative}`;

  if (narrative_output.dialogue.length > 0) {
    message += '\n\n## Dialogue';
    narrative_output.dialogue.forEach((d) => {
      const speaker = input.characters.find(
        (c) => c.story_character_id === d.speaker_story_character_id
      );
      message += `\n${speaker?.display_name}: ${d.text}`;
    });
  }

  if (narrative_output.system_notes.length > 0) {
    message += '\n\n## System Notes\n';
    message += narrative_output.system_notes.map((note) => `- ${note}`).join('\n');
  }

  message += '\n\nBased on the above, what state changes should occur?';

  return message;
}

/**
 * Call the State Delta Agent to determine state changes
 */
export async function callStateDeltaAgent(
  apiKey: string,
  model: string,
  input: StateDeltaAgentInput,
  params?: Record<string, any>
): Promise<StateDeltaAgentOutput> {
  const messages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: buildStateDeltaSystemPrompt(input),
    },
    {
      role: 'user',
      content: buildUserMessage(input),
    },
  ];

  // Default parameters for state analysis
  const defaultParams = {
    temperature: 0.3, // Lower temperature for more deterministic analysis
    max_tokens: 2000,
    top_p: 0.9,
    ...params,
  };

  try {
    const response = await callOpenRouterWithRetry(apiKey, messages, model, defaultParams, 2);

    // Parse JSON response
    const parsed = parseJsonResponse<StateDeltaAgentOutput>(response.content);

    if (!parsed) {
      throw new Error('Failed to parse state delta agent response as JSON');
    }

    // Ensure arrays exist
    return {
      changes: parsed.changes || [],
      list_ops: parsed.list_ops || [],
      relationship_changes: parsed.relationship_changes || [],
    };
  } catch (error) {
    console.error('State delta agent error:', error);
    throw error;
  }
}
