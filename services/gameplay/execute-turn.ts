/**
 * Turn Execution Service (簡化版)
 * 使用合併版 Story Agent，單次 API 呼叫處理敘事和狀態變更
 */

import type {
  Story,
  StoryTurn,
  StoryCharacter,
  Character,
  StoryStateValue,
  World,
  WorldStateSchema,
} from '@/types';

import type {
  StoryAgentInput,
  StoryAgentOutput,
  StoryCharacterContext,
  RecentTurnContext,
  SchemaContext,
  CurrentStateContext,
} from '@/types/api/agents';

import { callStoryAgent } from '@/services/agents/story-agent';
import { getStoryTurns, createStoryTurn, markTurnAsError } from '@/services/supabase/story-turns';
import { getStoryCharacters } from '@/services/supabase/story-characters';
import { getCharacterById } from '@/services/supabase/characters';
import { getAllStateValuesForStory, setStateValue } from '@/services/supabase/story-state-values';
import { getWorldById } from '@/services/supabase/worlds';
import { getSchemaByWorldId } from '@/services/supabase/world-schema';
import { updateStory } from '@/services/supabase/stories';
import { createChangeLogs, ChangeLogInsert } from '@/services/supabase/change-log';

// 預設上下文回合數
const DEFAULT_CONTEXT_TURNS = 5;

export interface ExecuteTurnInput {
  story: Story;
  userInput: string;
  userId: string;
  apiKey: string;
  model?: string;
  params?: Record<string, any>;
  /** 上下文回合數覆蓋 */
  contextTurns?: number;
}

export interface ExecuteTurnResult {
  turn: StoryTurn;
  agentOutput: StoryAgentOutput;
}

type ChangeLogDraft = Omit<ChangeLogInsert, 'turn_id'>;

/**
 * Build story agent input from story context
 */
async function buildStoryAgentInput(
  story: Story,
  userInput: string,
  userId: string,
  contextTurns: number
): Promise<StoryAgentInput> {
  console.log('[buildStoryAgentInput] 開始取得所有必要資料...');

  // Fetch all required data in parallel
  const [world, storyCharacters, recentTurns, stateValues, worldSchema] =
    await Promise.all([
      getWorldById(story.world_id, userId),
      getStoryCharacters(story.story_id, userId),
      getStoryTurns(story.story_id, userId),
      getAllStateValuesForStory(story.story_id, userId),
      getSchemaByWorldId(story.world_id, userId),
    ]);
  console.log('[buildStoryAgentInput] 所有平行查詢完成');

  if (!world) {
    throw new Error('World not found');
  }

  // Fetch character details
  console.log(`[buildStoryAgentInput] 取得 ${storyCharacters.length} 個角色的詳細資料...`);
  const characterDetails = await Promise.all(
    storyCharacters.map((sc) => getCharacterById(sc.character_id, userId))
  );
  console.log('[buildStoryAgentInput] 角色詳細資料取得完成');

  // Build character contexts
  const characters: StoryCharacterContext[] = storyCharacters.map((sc, index) => {
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
      is_player: sc.is_player,
    };
  });

  // Find the player character for logging
  const playerCharacter = characters.find(c => c.is_player);

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

  // Build current state contexts
  const currentStates: CurrentStateContext[] = stateValues.map((sv) => ({
    story_character_id: sv.story_character_id,
    schema_key: sv.schema_key,
    current_value: JSON.parse(sv.value_json),
  }));

  // Build recent turn contexts (使用指定的上下文回合數)
  const recentTurnContexts: RecentTurnContext[] = recentTurns.slice(-contextTurns).map((turn) => ({
    turn_index: turn.turn_index,
    user_input: turn.user_input_text,
    narrative: turn.narrative_text,
  }));

  // Log the built input for debugging
  console.log('[buildStoryAgentInput] 建構完成的輸入資料:');
  console.log('  - story_mode:', story.story_mode);
  console.log('  - 玩家角色:', playerCharacter?.display_name || '無（導演模式）');
  console.log('  - 角色數量:', characters.length);
  console.log('  - 狀態 Schema 數量:', schemaContexts.length);
  console.log('  - 最近回合數:', recentTurnContexts.length);

  if (characters.length === 0) {
    console.warn('[buildStoryAgentInput] 警告：沒有角色！');
  }

  if (story.story_mode === 'PLAYER_CHARACTER' && !playerCharacter) {
    console.warn('[buildStoryAgentInput] 警告：玩家角色模式但沒有設定玩家角色！');
  }

  return {
    story_mode: story.story_mode,
    world_rules: world.rules_text,
    story_prompt: story.story_prompt,
    characters,
    world_schema: schemaContexts,
    current_states: currentStates,
    recent_turns: recentTurnContexts,
    user_input: userInput,
  };
}

/**
 * Apply state changes from story agent output
 */
async function applyStateChanges(
  story: Story,
  agentOutput: StoryAgentOutput,
  userId: string
): Promise<ChangeLogDraft[]> {
  const changeLogs: ChangeLogDraft[] = [];

  // Fetch current states and world schema
  const [currentStates, worldSchema] = await Promise.all([
    getAllStateValuesForStory(story.story_id, userId),
    getSchemaByWorldId(story.world_id, userId),
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

  const serializeValue = (value: any): string | undefined =>
    value === undefined ? undefined : JSON.stringify(value);

  // Apply state changes
  for (const change of agentOutput.state_changes) {
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
  for (const listOp of agentOutput.list_ops) {
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

  return changeLogs;
}

/**
 * Execute a full turn (簡化版 - 單次 AI 呼叫)
 */
export async function executeTurn(input: ExecuteTurnInput): Promise<ExecuteTurnResult> {
  const { story, userInput, userId, apiKey, model, params, contextTurns } = input;

  console.log('[executeTurn] 開始執行回合...');

  // Use model from story or input
  const selectedModel = model || story.model_override || 'anthropic/claude-3.5-sonnet';

  // Get context turns (優先順序: input > story override > default)
  const effectiveContextTurns = contextTurns ?? story.context_turns_override ?? DEFAULT_CONTEXT_TURNS;

  // Get current turn count
  console.log('[executeTurn] 步驟 0: 取得目前回合數...');
  const currentTurns = await getStoryTurns(story.story_id, userId);
  const nextTurnIndex =
    currentTurns.length > 0
      ? Math.max(...currentTurns.map((turn) => turn.turn_index)) + 1
      : 1;
  console.log(`[executeTurn] 步驟 0 完成: 目前有 ${currentTurns.length} 個回合，下一個回合索引: ${nextTurnIndex}`);

  // Step 1: Build and call story agent (單次 API 呼叫)
  console.log('[executeTurn] 步驟 1: 建構 Story Agent 輸入...');
  const storyAgentInput = await buildStoryAgentInput(story, userInput, userId, effectiveContextTurns);
  console.log('[executeTurn] 步驟 1a 完成: 輸入已建構');

  console.log('[executeTurn] 步驟 1b: 呼叫 Story Agent...');
  const agentOutput = await callStoryAgent(apiKey, selectedModel, storyAgentInput, params);
  console.log('[executeTurn] 步驟 1 完成: Story Agent 回應成功');

  // Step 2: Apply state changes
  console.log('[executeTurn] 步驟 2: 套用狀態變更...');
  const changeLogs = await applyStateChanges(story, agentOutput, userId);
  console.log(`[executeTurn] 步驟 2 完成: 套用了 ${changeLogs.length} 個狀態變更`);

  // Step 3: Save turn
  console.log('[executeTurn] 步驟 3: 儲存回合...');
  const turn = await createStoryTurn(userId, {
    story_id: story.story_id,
    turn_index: nextTurnIndex,
    user_input_text: userInput,
    narrative_text: agentOutput.narrative,
  });
  console.log('[executeTurn] 步驟 3 完成: 回合已儲存');

  // Step 4: Write change logs
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

  // Step 5: Update story turn count
  await updateStory(story.story_id, userId, {
    turn_count: nextTurnIndex,
  });

  console.log('[executeTurn] 回合執行完成！');

  return {
    turn,
    agentOutput,
  };
}
