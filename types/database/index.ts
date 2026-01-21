// ==================== Enums ====================

export type StoryMode = 'PLAYER_CHARACTER' | 'DIRECTOR';
export type UserStatus = 'active' | 'disabled';
export type SchemaFieldType = 'number' | 'text' | 'bool' | 'enum' | 'list_text';
export type EntityType = 'state';
export type Visibility = 'private' | 'public';

// State operation types
export type StateOp = 'set' | 'inc';
export type ListOp = 'push' | 'remove' | 'set';

// ==================== Base Types ====================

export interface User {
  user_id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  status: UserStatus;
  last_login_at?: string;
}

export interface ProviderSettings {
  user_id: string;
  provider: 'openrouter' | 'openai';
  api_key: string;
  default_model: string;
  default_params_json: string; // JSON string
  default_context_turns?: number; // 預設上下文回合數
  updated_at: string;
}

export interface AIParams {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  [key: string]: any;
}

// ==================== World ====================

export interface World {
  world_id: string;
  user_id: string;
  name: string;
  description: string;
  rules_text: string;
  tags_json?: string; // JSON array string
  image_url?: string | null;
  visibility: Visibility;
  published_at?: string | null;
  original_author_id?: string | null; // 原作者 ID（NULL = user_id 就是原作者）
  forked_from_id?: string | null; // Fork 來源 ID
  original_author_name?: string | null; // 原作者顯示名稱（查詢時填充）
  original_author_avatar_url?: string | null; // 原作者頭像（查詢時填充）
  last_synced_at?: string | null; // 最後同步時間（複製品用）
  created_at: string;
  updated_at: string;
}

export interface NumberConstraints {
  min?: number;
  max?: number;
  decimals?: number;
  unit?: string;
}

export interface WorldStateSchema {
  schema_id: string;
  world_id: string;
  user_id: string;
  schema_key: string; // unique within world_id
  display_name: string;
  type: SchemaFieldType;
  ai_description: string;
  default_value_json: string; // JSON string
  enum_options_json?: string; // JSON array string
  number_constraints_json?: string; // JSON object string
  sort_order: number;
  updated_at: string;
}

// ==================== Character ====================

export interface Character {
  character_id: string;
  user_id: string;
  canonical_name: string;
  core_profile_text: string;
  tags_json?: string; // JSON array string
  image_url?: string | null;
  visibility: Visibility;
  published_at?: string | null;
  original_author_id?: string | null; // 原作者 ID（NULL = user_id 就是原作者）
  forked_from_id?: string | null; // Fork 來源 ID
  original_author_name?: string | null; // 原作者顯示名稱（查詢時填充）
  original_author_avatar_url?: string | null; // 原作者頭像（查詢時填充）
  last_synced_at?: string | null; // 最後同步時間（複製品用）
  created_at: string;
  updated_at: string;
}

// ==================== Story ====================

export interface Story {
  story_id: string;
  user_id: string;
  world_id: string;
  title: string;
  premise_text: string;
  story_mode: StoryMode;
  player_character_id?: string;
  story_prompt: string;
  model_override?: string;
  params_override_json?: string; // JSON string
  context_turns_override?: number; // 上下文回合數覆蓋
  tags_json?: string; // JSON array string
  turn_count?: number;
  created_at: string;
  updated_at: string;
}

export interface StoryCharacter {
  story_character_id: string;
  story_id: string;
  user_id: string;
  character_id: string;
  display_name_override?: string;
  is_player: boolean;
  created_at: string;
}

export interface StoryCharacterOverride {
  story_character_id: string; // PK / FK
  story_id: string;
  user_id: string;
  override_profile_text: string;
  override_voice_style?: string;
  updated_at: string;
}

// ==================== State ====================

export interface StoryStateValue {
  story_id: string;
  user_id: string;
  story_character_id: string;
  schema_key: string;
  value_json: string; // JSON string
  updated_at: string;
}


// ==================== Gameplay ====================

export interface StoryTurn {
  turn_id: string;
  story_id: string;
  user_id: string;
  turn_index: number;
  user_input_text: string;
  narrative_text: string;
  created_at: string;
  error_flag?: boolean;
  token_usage_json?: string; // JSON string
}

// ==================== Change Log ====================

export interface ChangeLog {
  change_id: string;
  turn_id: string;
  story_id: string;
  user_id: string;
  entity_type: EntityType;
  target_story_character_id: string | null;
  schema_key: string | null;
  op: string;
  before_value_json: string | null;
  after_value_json: string | null;
  reason_text: string;
}

// ==================== Helper Types (parsed JSON) ====================

export interface CharacterTags {
  tags: string[];
}


export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

// ==================== Story Summary ====================

export interface StorySummary {
  summary_id: string;
  story_id: string;
  user_id: string;
  generated_at_turn: number;
  summary_text: string;
  created_at: string;
}

