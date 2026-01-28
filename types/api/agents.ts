import { StoryMode } from '../database';

// ==================== Story Agent (合併版) ====================

/**
 * Story Agent 輸入 - 合併敘事和狀態變更
 */
export interface StoryAgentInput {
  story_mode: StoryMode;
  /** 世界描述（簡短概述） */
  world_description: string;
  /** 世界規則（詳細設定） */
  world_rules: string;
  /** 故事前提（背景設定） */
  story_premise: string;
  /** 故事提示（給 AI 的指導） */
  story_prompt: string;
  characters: StoryCharacterContext[];
  world_schema: SchemaContext[];
  current_states: CurrentStateContext[];
  recent_turns: RecentTurnContext[];
  user_input: string;
  /** 滾動摘要（前情提要） */
  story_summary?: string;
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

// ==================== Suggestion Agent ====================

/**
 * Suggestion Agent 輸入 - 生成行動建議
 */
export interface SuggestionAgentInput {
  story_mode: StoryMode;
  world_rules: string;
  story_prompt: string;
  characters: StoryCharacterContext[];
  recent_turns: RecentTurnContext[];
  /** 滾動摘要（前情提要） */
  story_summary?: string;
}

/**
 * Suggestion Agent 輸出 - 三個建議行動
 */
export interface SuggestionAgentOutput {
  /** 三個建議的行動 */
  suggestions: string[];
}

// ==================== Generation Assistant ====================

/** 生成類型 */
export type GenerationType = 'world' | 'character';

/** Schema 狀態種類資料（用於生成） */
export interface SchemaGenerationData {
  schema_key: string;
  display_name: string;
  type: 'text' | 'number' | 'bool' | 'enum' | 'list_text';
  ai_description: string;
  default_value?: string;
  enum_options?: string[];
  number_min?: number;
  number_max?: number;
}

/** 世界觀生成輸入 */
export interface WorldGenerationInput {
  currentData: {
    name?: string;
    description?: string;
    rules_text?: string;
    schemas?: SchemaGenerationData[];
  };
  userPrompt: string;
}

/** 世界觀生成輸出 */
export interface WorldGenerationOutput {
  name: string;
  description: string;
  rules_text: string;
  schemas: SchemaGenerationData[];
}

/** 角色生成輸入 */
export interface CharacterGenerationInput {
  currentData: {
    canonical_name?: string;
    core_profile_text?: string;
    tags?: string[];
  };
  userPrompt: string;
}

/** 角色生成輸出 */
export interface CharacterGenerationOutput {
  canonical_name: string;
  core_profile_text: string;
  tags: string[];
}

// ==================== Full Story Generation ====================

/** 完整故事生成輸入 */
export interface FullStoryGenerationInput {
  userPrompt: string;
  /** 現有資料（用於修改模式） */
  currentData?: FullStoryGenerationOutput;
  /** 現有的角色標籤（讓 AI 優先使用） */
  existingCharacterTags?: string[];
  /** 現有的世界標籤 */
  existingWorldTags?: string[];
  /** 現有的故事標籤 */
  existingStoryTags?: string[];
}

/** 生成的角色資料 */
export interface GeneratedCharacterData {
  canonical_name: string;
  core_profile_text: string;
  tags: string[];
  is_player: boolean;
  /** 角色的初始狀態值 */
  initial_states: Record<string, string | number | boolean | string[]>;
}

/** 完整故事生成輸出 */
export interface FullStoryGenerationOutput {
  /** 世界觀設定 */
  world: {
    name: string;
    description: string;
    rules_text: string;
    tags: string[];
    schemas: SchemaGenerationData[];
  };
  /** 角色列表（1-3 個） */
  characters: GeneratedCharacterData[];
  /** 故事設定 */
  story: {
    title: string;
    premise_text: string;
    story_mode: 'PLAYER_CHARACTER' | 'DIRECTOR';
    story_prompt: string;
    tags: string[];
  };
}

