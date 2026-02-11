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
import { callSummaryAgent } from '@/services/agents/summary-agent';
import { getStoryTurns, createStoryTurn, markTurnAsError } from '@/services/supabase/story-turns';
import { getStoryCharacters } from '@/services/supabase/story-characters';
import { getCharactersByIds } from '@/services/supabase/characters';
import { getAllStateValuesForStory, setMultipleStateValues } from '@/services/supabase/story-state-values';
import { getWorldById } from '@/services/supabase/worlds';
import { getSchemaByWorldId } from '@/services/supabase/world-schema';
import { updateStory } from '@/services/supabase/stories';
import { createChangeLogs, ChangeLogInsert } from '@/services/supabase/change-log';
import { getLatestSummaryForTurn, createStorySummary } from '@/services/supabase/story-summaries';
import { getSchemaDefaultValue } from '@/utils/schema-defaults';

// 預設上下文回合數
const DEFAULT_CONTEXT_TURNS = 5;

/**
 * 檢查狀態值是否為預設值
 * @param value - 當前狀態值
 * @param schema - 狀態 Schema 定義
 * @returns true 如果是預設值
 */
function isDefaultState(value: any, schema: WorldStateSchema): boolean {
  const defaultValue = getSchemaDefaultValue(schema);
  return JSON.stringify(value) === JSON.stringify(defaultValue);
}

/**
 * 驗證狀態操作是否與 schema 類型匹配
 * @param schemaType - Schema 的類型
 * @param operation - 要執行的操作類型
 * @returns true 如果操作有效，否則 false
 */
function validateStateOperation(
  schemaType: 'number' | 'text' | 'bool' | 'enum' | 'list_text',
  operation: 'set' | 'inc'
): boolean {
  // 定義有效的操作-類型組合
  const validCombinations: Record<string, ('set' | 'inc')[]> = {
    number: ['set', 'inc'], // 數字可以 set 或 inc
    text: ['set'], // 文字只能 set
    bool: ['set'], // 布林只能 set
    enum: ['set'], // 枚舉只能 set
    list_text: [], // 列表不應該用 StateChange，應該用 ListOperation
  };

  const validOps = validCombinations[schemaType] || [];
  return validOps.includes(operation);
}

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
 * @returns StoryAgentInput 以及補全後的狀態和 schema，用於後續狀態套用
 */
async function buildStoryAgentInput(
  story: Story,
  userInput: string,
  userId: string,
  contextTurns: number,
  currentTurnIndex: number
): Promise<{
  input: StoryAgentInput;
  stateValues: StoryStateValue[];
  worldSchema: WorldStateSchema[];
}> {
  console.log('[buildStoryAgentInput] 開始取得所有必要資料...');

  // Fetch all required data in parallel (including applicable summary)
  const [world, storyCharacters, recentTurns, stateValues, worldSchema, applicableSummary] =
    await Promise.all([
      getWorldById(story.world_id, userId),
      getStoryCharacters(story.story_id, userId),
      getStoryTurns(story.story_id, userId),
      getAllStateValuesForStory(story.story_id, userId),
      getSchemaByWorldId(story.world_id, userId),
      getLatestSummaryForTurn(story.story_id, currentTurnIndex, userId),
    ]);
  console.log('[buildStoryAgentInput] 所有平行查詢完成');
  console.log('[buildStoryAgentInput] 適用摘要:', applicableSummary ? `回合 ${applicableSummary.generated_at_turn}` : '無');

  if (!world) {
    throw new Error('World not found');
  }

  // Fetch character details (batch query to avoid N+1)
  console.log(`[buildStoryAgentInput] 取得 ${storyCharacters.length} 個角色的詳細資料...`);
  const characterIds = storyCharacters.map((sc) => sc.character_id);
  const characterList = await getCharactersByIds(characterIds, userId);
  const characterMap = new Map(characterList.map((c) => [c.character_id, c]));
  const characterDetails = storyCharacters.map((sc) => characterMap.get(sc.character_id) || null);
  console.log('[buildStoryAgentInput] 角色詳細資料取得完成');

  // Build schema contexts (需要在狀態補全前建構，因為補全邏輯需要使用)
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

  // 狀態自動補全：確保所有角色都有所有 Schema 的狀態值
  // 重要：必須在建構 character contexts 之前完成，確保狀態摘要使用完整的資料
  console.log('[buildStoryAgentInput] 檢查狀態完整性...');
  const stateMap = new Map<string, StoryStateValue>();
  stateValues.forEach((sv) => {
    const key = `${sv.story_character_id}:${sv.schema_key}`;
    stateMap.set(key, sv);
  });

  const missingStates: Array<{
    story_id: string;
    story_character_id: string;
    schema_key: string;
    value_json: string;
  }> = [];

  // 檢查每個角色是否有所有 Schema 的狀態
  for (const sc of storyCharacters) {
    for (const schema of worldSchema) {
      const key = `${sc.story_character_id}:${schema.schema_key}`;
      if (!stateMap.has(key)) {
        // 狀態缺失，建立預設值
        const defaultValue = getSchemaDefaultValue(schema);
        console.log(`[buildStoryAgentInput] 缺失狀態: ${sc.story_character_id}:${schema.schema_key}, 使用預設值:`, defaultValue);

        missingStates.push({
          story_id: story.story_id,
          story_character_id: sc.story_character_id,
          schema_key: schema.schema_key,
          value_json: JSON.stringify(defaultValue),
        });

        // 同時加入到記憶體的 stateValues 中，確保這次回合能使用
        const newStateValue: StoryStateValue = {
          user_id: userId,
          story_id: story.story_id,
          story_character_id: sc.story_character_id,
          schema_key: schema.schema_key,
          value_json: JSON.stringify(defaultValue),
          updated_at: new Date().toISOString(),
        };
        stateValues.push(newStateValue);
        stateMap.set(key, newStateValue);
      }
    }
  }

  // 批次寫入缺失的狀態到資料庫
  if (missingStates.length > 0) {
    console.log(`[buildStoryAgentInput] 發現 ${missingStates.length} 個缺失狀態，正在初始化...`);
    try {
      await setMultipleStateValues(userId, missingStates);
      console.log('[buildStoryAgentInput] 狀態初始化完成');
    } catch (error) {
      console.error('[buildStoryAgentInput] 狀態初始化失敗:', error);
      // 繼續執行，使用記憶體中的值
    }
  } else {
    console.log('[buildStoryAgentInput] 所有狀態完整，無需補全');
  }

  // 建構角色上下文（在狀態補全之後，確保使用完整的狀態資料）
  console.log('[buildStoryAgentInput] 建構角色上下文（使用補全後的狀態）...');
  const characters: StoryCharacterContext[] = storyCharacters.map((sc, index) => {
    const char = characterDetails[index];
    if (!char) {
      throw new Error(`Character not found: ${sc.character_id}`);
    }

    // Get character's state values (現在使用的是補全後的 stateValues)
    const charStates = stateValues.filter(
      (sv) => sv.story_character_id === sc.story_character_id
    );

    // Build state summary (優化：只顯示關鍵欄位和非預設值)
    const criticalFields = ['location', 'health', 'hp', 'status', 'condition'];

    const stateSummary = charStates
      .map((sv) => {
        const schema = worldSchema.find((s) => s.schema_key === sv.schema_key);
        if (!schema) return '';
        try {
          const value = JSON.parse(sv.value_json);

          // Prioritize non-default values for conciseness
          if (!criticalFields.includes(schema.schema_key) && isDefaultState(value, schema)) {
            return '';
          }

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

  // Build current state contexts (與 characters 使用相同的補全後狀態)
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
  console.log('  - 當前狀態數量:', currentStates.length);
  console.log('  - 最近回合數:', recentTurnContexts.length);
  console.log('  - 摘要:', applicableSummary ? '有' : '無');

  if (characters.length === 0) {
    console.warn('[buildStoryAgentInput] 警告：沒有角色！');
  }

  if (story.story_mode === 'PLAYER_CHARACTER' && !playerCharacter) {
    console.warn('[buildStoryAgentInput] 警告：玩家角色模式但沒有設定玩家角色！');
  }

  // Prompt 統計（用於監控優化效果）
  const systemPromptLength = (
    (world.description?.length || 0) +
    world.rules_text.length +
    (story.premise_text?.length || 0) +
    story.story_prompt.length +
    characters.map(c => c.core_profile.length).reduce((a, b) => a + b, 0) +
    (applicableSummary?.summary_text.length || 0)
  );

  const recentTurnsLength = recentTurnContexts
    .map(t => t.user_input.length + t.narrative.length)
    .reduce((a, b) => a + b, 0);

  console.log('[buildStoryAgentInput] Prompt 統計:', {
    systemPromptLength,
    characterCount: characters.length,
    schemaCount: schemaContexts.length,
    recentTurns: recentTurnContexts.length,
    estimatedTokens: Math.ceil((systemPromptLength + recentTurnsLength) / 4)
  });

  return {
    input: {
      story_mode: story.story_mode,
      world_description: world.description,
      world_rules: world.rules_text,
      story_premise: story.premise_text,
      story_prompt: story.story_prompt,
      characters,
      world_schema: schemaContexts,
      current_states: currentStates,
      recent_turns: recentTurnContexts,
      user_input: userInput,
      story_summary: applicableSummary?.summary_text,
    },
    stateValues, // 回傳補全後的狀態，確保與 AI 輸入一致
    worldSchema, // 回傳 schema，避免重複查詢
  };
}

/**
 * Apply state changes from story agent output
 * @param preInitializedStates - 已預先初始化的狀態（來自 buildStoryAgentInput 的補全），避免重新查詢時遺失初始化值
 */
async function applyStateChanges(
  story: Story,
  agentOutput: StoryAgentOutput,
  userId: string,
  worldSchema: WorldStateSchema[],
  preInitializedStates?: StoryStateValue[]
): Promise<ChangeLogDraft[]> {
  const changeLogs: ChangeLogDraft[] = [];

  console.log('[applyStateChanges] 使用', preInitializedStates ? '預先初始化的狀態' : '從資料庫重新查詢的狀態');

  // 使用預先初始化的狀態（如果有），否則從資料庫查詢
  const currentStates = preInitializedStates ?? await getAllStateValuesForStory(story.story_id, userId);

  const stateMap = new Map<string, any>();
  currentStates.forEach((state) => {
    const key = `${state.story_character_id}:${state.schema_key}`;
    try {
      stateMap.set(key, JSON.parse(state.value_json));
    } catch {
      stateMap.set(key, state.value_json);
    }
  });

  const serializeValue = (value: any): string | null =>
    value === undefined ? null : JSON.stringify(value);

  // 收集所有待寫入的狀態變更（先計算，後批次寫入）
  const pendingWrites: Array<{
    story_id: string;
    story_character_id: string;
    schema_key: string;
    value_json: string;
  }> = [];

  // 計算 state changes（不寫入資料庫）
  for (const change of agentOutput.state_changes) {
    console.log('[applyStateChanges] 處理狀態變更:', {
      target: change.target_story_character_id,
      schema_key: change.schema_key,
      op: change.op,
      value: change.value,
    });

    const schema = worldSchema.find((s) => s.schema_key === change.schema_key);
    const actualSchema = schema || worldSchema.find((s) => s.display_name === change.schema_key);

    if (!actualSchema) {
      console.warn(`[applyStateChanges] 找不到 schema "${change.schema_key}"，跳過此變更`);
      continue;
    }

    if (!schema && actualSchema) {
      console.warn(`[applyStateChanges] AI 使用了 display_name "${change.schema_key}" 而非 schema_key "${actualSchema.schema_key}"，已自動修正`);
    }

    const isValidOperation = validateStateOperation(actualSchema.type, change.op);
    if (!isValidOperation) {
      console.warn(`[applyStateChanges] 無效的操作組合: schema "${actualSchema.schema_key}" (type: ${actualSchema.type}) 不支援操作 "${change.op}"`);
      continue;
    }

    const stateKey = `${change.target_story_character_id}:${actualSchema.schema_key}`;
    const beforeValue = stateMap.get(stateKey);
    let newValue = change.value;

    if (change.op === 'inc') {
      if (actualSchema.type !== 'number') {
        console.error(`[applyStateChanges] 內部錯誤: inc 操作應該只用於 number 類型`);
        continue;
      }

      let currentValue: number;
      if (beforeValue !== undefined) {
        currentValue = beforeValue as number;
      } else {
        const defaultValue = getSchemaDefaultValue(actualSchema);
        currentValue = typeof defaultValue === 'number' ? defaultValue : 0;
        console.warn(`[applyStateChanges] 找不到狀態 "${actualSchema.schema_key}" 的現有值，使用 schema 預設值: ${currentValue}`);
      }

      newValue = currentValue + (change.value as number);

      if (actualSchema.number_constraints_json) {
        const constraints = JSON.parse(actualSchema.number_constraints_json);
        if (constraints.min !== undefined) newValue = Math.max(newValue as number, constraints.min);
        if (constraints.max !== undefined) newValue = Math.min(newValue as number, constraints.max);
      }
    }

    if (actualSchema.type === 'enum' && actualSchema.enum_options_json && change.op === 'set') {
      try {
        const validOptions = JSON.parse(actualSchema.enum_options_json) as string[];
        if (!validOptions.includes(newValue as string)) {
          console.warn(`[applyStateChanges] 無效的 Enum 值 "${newValue}" 對於 schema "${actualSchema.schema_key}". 有效選項:`, validOptions);
          continue;
        }
      } catch (error) {
        console.error(`[applyStateChanges] 無法解析 enum_options_json:`, error);
      }
    }

    if (actualSchema.type === 'number' && change.op === 'set' && actualSchema.number_constraints_json) {
      try {
        const constraints = JSON.parse(actualSchema.number_constraints_json);
        if (constraints.min !== undefined && (newValue as number) < constraints.min) {
          console.warn(`[applyStateChanges] 數值 ${newValue} 小於最小值 ${constraints.min}，已調整`);
          newValue = constraints.min;
        }
        if (constraints.max !== undefined && (newValue as number) > constraints.max) {
          console.warn(`[applyStateChanges] 數值 ${newValue} 大於最大值 ${constraints.max}，已調整`);
          newValue = constraints.max;
        }
      } catch (error) {
        console.error(`[applyStateChanges] 無法解析 number_constraints_json:`, error);
      }
    }

    // 記錄計算結果（暫不寫入資料庫）
    stateMap.set(stateKey, newValue);
    pendingWrites.push({
      story_id: story.story_id,
      story_character_id: change.target_story_character_id,
      schema_key: actualSchema.schema_key,
      value_json: JSON.stringify(newValue),
    });
    changeLogs.push({
      story_id: story.story_id,
      user_id: userId,
      entity_type: 'state',
      target_story_character_id: change.target_story_character_id,
      schema_key: actualSchema.schema_key,
      op: change.op,
      before_value_json: serializeValue(beforeValue),
      after_value_json: serializeValue(newValue),
      reason_text: change.reason || 'state change',
    });
  }

  // 計算 list operations（不寫入資料庫）
  for (const listOp of agentOutput.list_ops) {
    const schema = worldSchema.find((s) => s.schema_key === listOp.schema_key);
    const actualSchema = schema || worldSchema.find((s) => s.display_name === listOp.schema_key);

    if (!actualSchema) {
      console.warn(`[applyStateChanges] 找不到 schema "${listOp.schema_key}"，跳過列表操作`);
      continue;
    }

    if (!schema && actualSchema) {
      console.warn(`[applyStateChanges] AI 使用了 display_name "${listOp.schema_key}" 而非 schema_key "${actualSchema.schema_key}"，已自動修正`);
    }

    if (actualSchema.type !== 'list_text') {
      console.warn(`[applyStateChanges] 無效的列表操作: schema "${actualSchema.schema_key}" (type: ${actualSchema.type}) 不是 list_text 類型`);
      continue;
    }

    const stateKey = `${listOp.target_story_character_id}:${actualSchema.schema_key}`;
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

    stateMap.set(stateKey, newList);
    pendingWrites.push({
      story_id: story.story_id,
      story_character_id: listOp.target_story_character_id,
      schema_key: actualSchema.schema_key,
      value_json: JSON.stringify(newList),
    });
    changeLogs.push({
      story_id: story.story_id,
      user_id: userId,
      entity_type: 'state',
      target_story_character_id: listOp.target_story_character_id,
      schema_key: actualSchema.schema_key,
      op: listOp.op,
      before_value_json: serializeValue(currentList),
      after_value_json: serializeValue(newList),
      reason_text: listOp.reason || 'list change',
    });
  }

  // 批次寫入所有狀態變更（原子操作：全部成功或全部不變）
  if (pendingWrites.length > 0) {
    console.log(`[applyStateChanges] 批次寫入 ${pendingWrites.length} 個狀態變更...`);
    await setMultipleStateValues(userId, pendingWrites);
    console.log('[applyStateChanges] 批次寫入完成');
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
  const { input: storyAgentInput, stateValues, worldSchema } = await buildStoryAgentInput(
    story,
    userInput,
    userId,
    effectiveContextTurns,
    nextTurnIndex
  );
  console.log('[executeTurn] 步驟 1a 完成: 輸入已建構');

  console.log('[executeTurn] 步驟 1b: 呼叫 Story Agent...');
  const agentOutput = await callStoryAgent(apiKey, selectedModel, storyAgentInput, params);
  console.log('[executeTurn] 步驟 1 完成: Story Agent 回應成功');

  // Step 2: Apply state changes (傳入補全後的狀態，確保與 AI 輸入一致)
  console.log('[executeTurn] 步驟 2: 套用狀態變更...');
  const changeLogs = await applyStateChanges(story, agentOutput, userId, worldSchema, stateValues);
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

  // Step 6: Check if we need to generate a new summary
  // 在回合數達到上下文窗口倍數時觸發摘要生成
  const shouldGenerateSummary = nextTurnIndex > 0 && nextTurnIndex % effectiveContextTurns === 0;

  if (shouldGenerateSummary) {
    console.log(`[executeTurn] 步驟 6: 觸發摘要生成（回合 ${nextTurnIndex}）...`);
    try {
      // 取得需要摘要的回合（上一次摘要之後到現在的所有回合）
      const latestSummary = await getLatestSummaryForTurn(story.story_id, nextTurnIndex + 1, userId);
      const summaryStartTurn = latestSummary ? latestSummary.generated_at_turn : 0;

      // 篩選需要摘要的回合
      const turnsToSummarize = currentTurns
        .filter(t => t.turn_index > summaryStartTurn && t.turn_index <= nextTurnIndex)
        .map(t => ({
          turn_index: t.turn_index,
          user_input: t.user_input_text,
          narrative: t.narrative_text,
        }));

      // 加入剛完成的這個回合
      turnsToSummarize.push({
        turn_index: nextTurnIndex,
        user_input: userInput,
        narrative: agentOutput.narrative,
      });

      if (turnsToSummarize.length > 0) {
        const newSummary = await callSummaryAgent(
          apiKey,
          selectedModel,
          latestSummary?.summary_text,
          turnsToSummarize
        );

        await createStorySummary(userId, {
          story_id: story.story_id,
          generated_at_turn: nextTurnIndex,
          summary_text: newSummary,
        });

        console.log(`[executeTurn] 步驟 6 完成: 摘要已生成並儲存`);
      }
    } catch (summaryError) {
      // 摘要生成失敗不應該中斷主流程
      console.error('[executeTurn] 摘要生成失敗（不影響主流程）:', summaryError);
    }
  }

  console.log('[executeTurn] 回合執行完成！');

  return {
    turn,
    agentOutput,
  };
}
