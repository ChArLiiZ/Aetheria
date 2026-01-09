/**
 * Turn Execution Service
 * Orchestrates the full turn execution flow:
 * 1. Gather context
 * 2. Call narrative agent
 * 3. Call state delta agent
 * 4. Apply state changes
 * 5. Save turn
 */

import type {
  Story,
  StoryTurn,
  StoryCharacter,
  Character,
  StoryStateValue,
  StoryRelationship,
  World,
  WorldStateSchema,
} from '@/types';

import type {
  NarrativeAgentInput,
  NarrativeAgentOutput,
  StateDeltaAgentInput,
  StateDeltaAgentOutput,
  NarrativeCharacterContext,
  NarrativeRelationshipContext,
  RecentTurnContext,
  SchemaContext,
  StateDeltaCharacterContext,
  CurrentStateContext,
  StateDeltaRelationshipContext,
  DialogueEntry,
} from '@/types/api/agents';

import { callNarrativeAgent } from '@/services/agents/narrative-agent';
import { callStateDeltaAgent } from '@/services/agents/state-delta-agent';
import { getStoryTurns, createStoryTurn, markTurnAsError } from '@/services/supabase/story-turns';
import { getStoryCharacters } from '@/services/supabase/story-characters';
import { getCharacterById } from '@/services/supabase/characters';
import { getAllStateValuesForStory, setStateValue } from '@/services/supabase/story-state-values';
import { getStoryRelationships, setRelationship } from '@/services/supabase/story-relationships';
import { getWorldById } from '@/services/supabase/worlds';
import { getSchemaByWorldId } from '@/services/supabase/world-schema';
import { updateStory } from '@/services/supabase/stories';
import { createChangeLogs, ChangeLogInsert } from '@/services/supabase/change-log';

export interface ExecuteTurnInput {
  story: Story;
  userInput: string;
  userId: string;
  apiKey: string;
  model?: string;
  params?: Record<string, any>;
}

export interface ExecuteTurnResult {
  turn: StoryTurn;
  narrativeOutput: NarrativeAgentOutput;
  stateChanges: StateDeltaAgentOutput;
}

type ChangeLogDraft = Omit<ChangeLogInsert, 'turn_id'>;

/**
 * Build narrative agent input from story context
 */
async function buildNarrativeInput(
  story: Story,
  userInput: string,
  userId: string
): Promise<NarrativeAgentInput> {
  // Fetch all required data in parallel
  const [world, storyCharacters, recentTurns, stateValues, relationships, worldSchema] =
    await Promise.all([
      getWorldById(story.world_id, userId),
      getStoryCharacters(story.story_id, userId),
      getStoryTurns(story.story_id, userId),
      getAllStateValuesForStory(story.story_id, userId),
      getStoryRelationships(story.story_id, userId),
      getSchemaByWorldId(story.world_id, userId),
    ]);

  if (!world) {
    throw new Error('World not found');
  }

  // Fetch character details
  const characterDetails = await Promise.all(
    storyCharacters.map((sc) => getCharacterById(sc.character_id, userId))
  );

  // Build character contexts
  const characters: NarrativeCharacterContext[] = storyCharacters.map((sc, index) => {
    const char = characterDetails[index];
    if (!char) {
      throw new Error(`Character not found: ${sc.character_id}`);
    }

    // Get character's state values
    const charStates = stateValues.filter(
      (sv) => sv.story_character_id === sc.story_character_id
    );

    // Build state summary
    const stateSummary = charStates
      .map((sv) => {
        const schema = worldSchema.find((s) => s.schema_key === sv.schema_key);
        if (!schema) return '';
        try {
          const value = JSON.parse(sv.value_json);
          return `${schema.display_name}: ${JSON.stringify(value)}`;
        } catch {
          return '';
        }
      })
      .filter(Boolean)
      .join(', ');

    return {
      story_character_id: sc.story_character_id,
      display_name: sc.display_name_override || char.canonical_name,
      core_profile: char.core_profile_text,
      current_state_summary: stateSummary || 'No state set',
    };
  });

  // Build relationship contexts
  const relationshipContexts: NarrativeRelationshipContext[] = relationships.map((rel) => ({
    from_character_id: rel.from_story_character_id,
    to_character_id: rel.to_story_character_id,
    score: rel.score,
    tags: JSON.parse(rel.tags_json || '[]'),
  }));

  // Build recent turn contexts (last 10 turns)
  const recentTurnContexts: RecentTurnContext[] = recentTurns.slice(-10).map((turn) => ({
    turn_index: turn.turn_index,
    user_input: turn.user_input_text,
    narrative: turn.narrative_text,
    dialogue: JSON.parse(turn.dialogue_json || '[]'),
  }));

  return {
    story_mode: story.story_mode,
    world_rules: world.rules_text,
    story_prompt: story.story_prompt,
    player_character_id: story.player_character_id,
    characters,
    relationships: relationshipContexts,
    recent_turns: recentTurnContexts,
    user_input: userInput,
  };
}

/**
 * Build state delta agent input
 */
async function buildStateDeltaInput(
  story: Story,
  userInput: string,
  narrativeOutput: NarrativeAgentOutput,
  userId: string
): Promise<StateDeltaAgentInput> {
  // Fetch required data
  const [worldSchema, storyCharacters, stateValues, relationships] = await Promise.all([
    getSchemaByWorldId(story.world_id, userId),
    getStoryCharacters(story.story_id, userId),
    getAllStateValuesForStory(story.story_id, userId),
    getStoryRelationships(story.story_id, userId),
  ]);

  // Fetch character details for display names
  const characterDetails = await Promise.all(
    storyCharacters.map((sc) => getCharacterById(sc.character_id, userId))
  );

  // Build schema contexts
  const schemaContexts: SchemaContext[] = worldSchema.map((schema) => ({
    schema_key: schema.schema_key,
    display_name: schema.display_name,
    type: schema.type,
    ai_description: schema.ai_description,
    enum_options: schema.enum_options_json ? JSON.parse(schema.enum_options_json) : undefined,
    number_constraints: schema.number_constraints_json
      ? JSON.parse(schema.number_constraints_json)
      : undefined,
  }));

  // Build character contexts
  const characters: StateDeltaCharacterContext[] = storyCharacters.map((sc, index) => {
    const char = characterDetails[index];
    return {
      story_character_id: sc.story_character_id,
      display_name: sc.display_name_override || char?.canonical_name || 'Unknown',
    };
  });

  // Build current state contexts
  const currentStates: CurrentStateContext[] = stateValues.map((sv) => ({
    story_character_id: sv.story_character_id,
    schema_key: sv.schema_key,
    current_value: JSON.parse(sv.value_json),
  }));

  // Build relationship contexts
  const relationshipContexts: StateDeltaRelationshipContext[] = relationships.map((rel) => ({
    from_story_character_id: rel.from_story_character_id,
    to_story_character_id: rel.to_story_character_id,
    score: rel.score,
    tags: JSON.parse(rel.tags_json || '[]'),
  }));

  return {
    world_schema: schemaContexts,
    characters,
    current_states: currentStates,
    relationships: relationshipContexts,
    narrative_output: narrativeOutput,
    user_input: userInput,
  };
}

/**
 * Apply state changes from state delta agent
 */
async function applyStateChanges(
  story: Story,
  stateChanges: StateDeltaAgentOutput,
  userId: string
): Promise<ChangeLogDraft[]> {
  const changeLogs: ChangeLogDraft[] = [];

  // Fetch current states, world schema, and relationships
  const [currentStates, worldSchema, currentRelationships] = await Promise.all([
    getAllStateValuesForStory(story.story_id, userId),
    getSchemaByWorldId(story.world_id, userId),
    getStoryRelationships(story.story_id, userId),
  ]);

  const stateMap = new Map<string, any>();
  currentStates.forEach((state) => {
    const key = `${state.story_character_id}:${state.schema_key}`;
    try {
      stateMap.set(key, JSON.parse(state.value_json));
    } catch {
      stateMap.set(key, state.value_json);
    }
  });

  const relationshipMap = new Map<string, { score: number; tags: string[] }>();
  currentRelationships.forEach((rel) => {
    let tags: string[] = [];
    try {
      tags = JSON.parse(rel.tags_json || '[]');
    } catch {
      tags = [];
    }
    relationshipMap.set(`${rel.from_story_character_id}:${rel.to_story_character_id}`, {
      score: rel.score,
      tags,
    });
  });

  const serializeValue = (value: any) => (value === undefined ? null : JSON.stringify(value));

  // Apply state changes
  for (const change of stateChanges.changes) {
    const schema = worldSchema.find((s) => s.schema_key === change.schema_key);
    if (!schema) continue;

    const stateKey = `${change.target_story_character_id}:${change.schema_key}`;
    const beforeValue = stateMap.get(stateKey);
    let newValue = change.value;

    if (change.op === 'inc' && schema.type === 'number') {
      const currentValue = beforeValue ?? 0;
      newValue = (currentValue as number) + (change.value as number);

      if (schema.number_constraints_json) {
        const constraints = JSON.parse(schema.number_constraints_json);
        if (constraints.min !== undefined) {
          newValue = Math.max(newValue as number, constraints.min);
        }
        if (constraints.max !== undefined) {
          newValue = Math.min(newValue as number, constraints.max);
        }
      }
    }

    await setStateValue(userId, {
      story_id: story.story_id,
      story_character_id: change.target_story_character_id,
      schema_key: change.schema_key,
      value_json: JSON.stringify(newValue),
    });

    stateMap.set(stateKey, newValue);
    changeLogs.push({
      story_id: story.story_id,
      user_id: userId,
      entity_type: 'state',
      target_story_character_id: change.target_story_character_id,
      schema_key: change.schema_key,
      op: change.op,
      before_value_json: serializeValue(beforeValue),
      after_value_json: serializeValue(newValue),
      reason_text: change.reason || 'state change',
    });
  }

  // Apply list operations
  for (const listOp of stateChanges.list_ops) {
    const stateKey = `${listOp.target_story_character_id}:${listOp.schema_key}`;
    const beforeValue = stateMap.get(stateKey);
    const currentList = Array.isArray(beforeValue) ? beforeValue : [];

    let newList: string[];
    switch (listOp.op) {
      case 'push': {
        const itemsToPush = Array.isArray(listOp.value) ? listOp.value : [listOp.value];
        newList = [...currentList, ...itemsToPush];
        break;
      }
      case 'remove': {
        const itemsToRemove = Array.isArray(listOp.value) ? listOp.value : [listOp.value];
        newList = currentList.filter((item) => !itemsToRemove.includes(item));
        break;
      }
      case 'set':
        newList = Array.isArray(listOp.value) ? listOp.value : [listOp.value];
        break;
      default:
        continue;
    }

    await setStateValue(userId, {
      story_id: story.story_id,
      story_character_id: listOp.target_story_character_id,
      schema_key: listOp.schema_key,
      value_json: JSON.stringify(newList),
    });

    stateMap.set(stateKey, newList);
    changeLogs.push({
      story_id: story.story_id,
      user_id: userId,
      entity_type: 'state',
      target_story_character_id: listOp.target_story_character_id,
      schema_key: listOp.schema_key,
      op: listOp.op,
      before_value_json: serializeValue(currentList),
      after_value_json: serializeValue(newList),
      reason_text: listOp.reason || 'list change',
    });
  }

  // Apply relationship changes
  for (const relChange of stateChanges.relationship_changes) {
    const relKey = `${relChange.from_story_character_id}:${relChange.to_story_character_id}`;
    const currentRel = relationshipMap.get(relKey);
    const beforeValue = currentRel
      ? { score: currentRel.score, tags: currentRel.tags }
      : null;

    let newScore = relChange.value;
    if (relChange.op === 'inc_score' && currentRel) {
      newScore = currentRel.score + relChange.value;
    }

    newScore = Math.max(-100, Math.min(100, newScore));

    let currentTags: string[] = currentRel ? [...currentRel.tags] : [];
    for (const tagOp of relChange.tag_ops) {
      if (tagOp.op === 'add' && !currentTags.includes(tagOp.value)) {
        currentTags.push(tagOp.value);
      } else if (tagOp.op === 'remove') {
        currentTags = currentTags.filter((tag) => tag !== tagOp.value);
      }
    }

    await setRelationship(userId, {
      story_id: story.story_id,
      from_story_character_id: relChange.from_story_character_id,
      to_story_character_id: relChange.to_story_character_id,
      score: newScore,
      tags_json: JSON.stringify(currentTags),
    });

    relationshipMap.set(relKey, { score: newScore, tags: currentTags });
    changeLogs.push({
      story_id: story.story_id,
      user_id: userId,
      entity_type: 'relationship',
      from_story_character_id: relChange.from_story_character_id,
      to_story_character_id: relChange.to_story_character_id,
      op: relChange.op,
      before_value_json: beforeValue ? JSON.stringify(beforeValue) : null,
      after_value_json: JSON.stringify({ score: newScore, tags: currentTags }),
      reason_text: relChange.reason || 'relationship change',
    });
  }

  return changeLogs;
}

/**
 * Execute a full turn
 */
export async function executeTurn(input: ExecuteTurnInput): Promise<ExecuteTurnResult> {
  const { story, userInput, userId, apiKey, model, params } = input;

  // Use model from story or input
  const selectedModel = model || story.model_override || 'anthropic/claude-3.5-sonnet';

  // Get current turn count
  const currentTurns = await getStoryTurns(story.story_id, userId);
  const nextTurnIndex =
    currentTurns.length > 0
      ? Math.max(...currentTurns.map((turn) => turn.turn_index)) + 1
      : 1;

  // Step 1: Call narrative agent
  const narrativeInput = await buildNarrativeInput(story, userInput, userId);
  const narrativeOutput = await callNarrativeAgent(apiKey, selectedModel, narrativeInput, params);

  // Step 2: Call state delta agent
  const stateDeltaInput = await buildStateDeltaInput(story, userInput, narrativeOutput, userId);
  const stateChanges = await callStateDeltaAgent(apiKey, selectedModel, stateDeltaInput, params);

  // Step 3: Apply state changes
  const changeLogs = await applyStateChanges(story, stateChanges, userId);

  // Step 4: Save turn
  const turn = await createStoryTurn(userId, {
    story_id: story.story_id,
    turn_index: nextTurnIndex,
    user_input_text: userInput,
    narrative_text: narrativeOutput.narrative,
    dialogue_json: JSON.stringify(narrativeOutput.dialogue),
    scene_tags_json: JSON.stringify(narrativeOutput.scene_tags),
  });

  // Step 5: Write change logs
  if (changeLogs.length > 0) {
    const entries = changeLogs.map((entry) => ({
      ...entry,
      turn_id: turn.turn_id,
    }));

    try {
      await createChangeLogs(entries);
    } catch (error) {
      console.error('Failed to create change logs:', error);
      await markTurnAsError(turn.turn_id, userId);
    }
  }

  // Step 6: Update story turn count
  await updateStory(story.story_id, userId, {
    turn_count: nextTurnIndex,
  });

  return {
    turn,
    narrativeOutput,
    stateChanges,
  };
}
