import { StoryMode } from '../database';

// ==================== Story Agent (合併版) ====================

/**
 * Story Agent 輸入 - 合併敘事和狀態變更
 */
export interface StoryAgentInput {
  story_mode: StoryMode;
  world_rules: string;
  story_prompt: string;
  characters: StoryCharacterContext[];
  world_schema: SchemaContext[];
  current_states: CurrentStateContext[];
  recent_turns: RecentTurnContext[];
  user_input: string;
}

/**
 * Story Agent 輸出 - 敘事（含 Markdown 對話）和狀態變更
 */
export interface StoryAgentOutput {
  /** 敘事文字，對話使用 Markdown 引用區塊格式：> **角色名**：「對話內容」 */
  narrative: string;
  /** 狀態變更 */
  state_changes: StateChange[];
  /** 列表操作 */
  list_ops: ListOperation[];
}

// ==================== Story Agent Context Types ====================

export interface StoryCharacterContext {
  story_character_id: string;
  display_name: string;
  core_profile: string;
  override_profile?: string;
  current_state_summary: string;
  /** 是否為玩家控制的角色 */
  is_player: boolean;
}

export interface RecentTurnContext {
  turn_index: number;
  user_input: string;
  narrative: string;
}

export interface SchemaContext {
  schema_key: string;
  display_name: string;
  type: 'number' | 'text' | 'bool' | 'enum' | 'list_text';
  ai_description: string;
  enum_options?: string[];
  number_constraints?: {
    min?: number;
    max?: number;
    decimals?: number;
    unit?: string;
  };
}

export interface CurrentStateContext {
  story_character_id: string;
  schema_key: string;
  current_value: any;
}

// ==================== State Change Types ====================

export interface StateChange {
  target_story_character_id: string;
  schema_key: string;
  op: 'set' | 'inc';
  value: number | string | boolean;
  reason: string;
}

export interface ListOperation {
  target_story_character_id: string;
  schema_key: string;
  op: 'push' | 'remove' | 'set';
  value: string | string[];
  reason: string;
}

// ==================== OpenRouter API ====================

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  [key: string]: any;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
