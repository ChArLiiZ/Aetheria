import { StoryMode } from '../database';

// ==================== Narrative Agent ====================

export interface NarrativeAgentInput {
  story_mode: StoryMode;
  world_rules: string;
  story_prompt: string;
  player_character_id?: string;
  characters: NarrativeCharacterContext[];
  relationships: NarrativeRelationshipContext[];
  recent_turns: RecentTurnContext[];
  user_input: string;
}

export interface NarrativeCharacterContext {
  story_character_id: string;
  display_name: string;
  core_profile: string;
  override_profile?: string;
  current_state_summary: string;
}

export interface NarrativeRelationshipContext {
  from_character_id: string;
  to_character_id: string;
  score: number;
  tags: string[];
}

export interface RecentTurnContext {
  turn_index: number;
  user_input: string;
  narrative: string;
  dialogue: DialogueEntry[];
}

export interface DialogueEntry {
  speaker_story_character_id: string;
  text: string;
}

export interface NarrativeAgentOutput {
  narrative: string;
  dialogue: DialogueEntry[];
  scene_tags: string[];
  system_notes: string[];
}

// ==================== State Delta Agent ====================

export interface StateDeltaAgentInput {
  world_schema: SchemaContext[];
  characters: StateDeltaCharacterContext[];
  current_states: CurrentStateContext[];
  relationships: StateDeltaRelationshipContext[];
  narrative_output: NarrativeAgentOutput;
  user_input: string;
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

export interface StateDeltaCharacterContext {
  story_character_id: string;
  display_name: string;
}

export interface CurrentStateContext {
  story_character_id: string;
  schema_key: string;
  current_value: any;
}

export interface StateDeltaRelationshipContext {
  from_story_character_id: string;
  to_story_character_id: string;
  score: number;
  tags: string[];
}

export interface StateDeltaAgentOutput {
  changes: StateChange[];
  list_ops: ListOperation[];
  relationship_changes: RelationshipChange[];
}

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

export interface RelationshipChange {
  from_story_character_id: string;
  to_story_character_id: string;
  op: 'inc_score' | 'set_score';
  value: number;
  tag_ops: RelationshipTagOperation[];
  reason: string;
}

export interface RelationshipTagOperation {
  op: 'add' | 'remove';
  value: string;
}

// ==================== Action Suggestion Agent ====================

export interface ActionSuggestionAgentInput {
  story_mode: StoryMode;
  player_character_id?: string;
  world_rules: string;
  characters: ActionSuggestionCharacterContext[];
  current_situation: string; // last narrative
  recent_actions: string[]; // last N user inputs
}

export interface ActionSuggestionCharacterContext {
  story_character_id: string;
  display_name: string;
  is_player: boolean;
}

export interface ActionSuggestionAgentOutput {
  suggestions: ActionSuggestion[];
}

export interface ActionSuggestion {
  text: string;
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
