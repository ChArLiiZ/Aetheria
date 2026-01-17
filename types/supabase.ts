/**
 * Supabase Database Types
 *
 * Type definitions for Supabase tables
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          user_id: string
          email: string
          display_name: string
          password_hash: string
          created_at: string
          updated_at: string
          status: string
          last_login_at: string | null
        }
        Insert: {
          user_id?: string
          email: string
          display_name: string
          password_hash: string
          created_at?: string
          updated_at?: string
          status?: string
          last_login_at?: string | null
        }
        Update: {
          user_id?: string
          email?: string
          display_name?: string
          password_hash?: string
          created_at?: string
          updated_at?: string
          status?: string
          last_login_at?: string | null
        }
      }
      provider_settings: {
        Row: {
          user_id: string
          provider: string
          api_key: string
          default_model: string
          default_params_json: string
          updated_at: string
        }
        Insert: {
          user_id: string
          provider: string
          api_key: string
          default_model: string
          default_params_json?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          provider?: string
          api_key?: string
          default_model?: string
          default_params_json?: string
          updated_at?: string
        }
      }
      worlds: {
        Row: {
          world_id: string
          user_id: string
          name: string
          description: string
          rules_text: string
          tags_json: string | null
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          world_id?: string
          user_id: string
          name: string
          description: string
          rules_text: string
          tags_json?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          world_id?: string
          user_id?: string
          name?: string
          description?: string
          rules_text?: string
          tags_json?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      world_state_schema: {
        Row: {
          schema_id: string
          world_id: string
          user_id: string
          schema_key: string
          display_name: string
          type: string
          ai_description: string
          default_value_json: string
          enum_options_json: string
          number_constraints_json: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          schema_id?: string
          world_id: string
          user_id: string
          schema_key: string
          display_name: string
          type: string
          ai_description: string
          default_value_json?: string
          enum_options_json?: string
          number_constraints_json?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          schema_id?: string
          world_id?: string
          user_id?: string
          schema_key?: string
          display_name?: string
          type?: string
          ai_description?: string
          default_value_json?: string
          enum_options_json?: string
          number_constraints_json?: string
          sort_order?: number
          updated_at?: string
        }
      }
      characters: {
        Row: {
          character_id: string
          user_id: string
          canonical_name: string
          core_profile_text: string
          tags_json: string
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          character_id?: string
          user_id: string
          canonical_name: string
          core_profile_text: string
          tags_json?: string
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          user_id?: string
          canonical_name?: string
          core_profile_text?: string
          tags_json?: string
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      stories: {
        Row: {
          story_id: string
          user_id: string
          world_id: string
          title: string
          premise_text: string
          story_mode: string
          player_character_id: string | null
          story_prompt: string
          model_override: string | null
          params_override_json: string | null
          context_turns_override: number | null
          tags_json: string | null
          turn_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          story_id?: string
          user_id: string
          world_id: string
          title: string
          premise_text: string
          story_mode: string
          player_character_id?: string | null
          story_prompt: string
          model_override?: string | null
          params_override_json?: string | null
          context_turns_override?: number | null
          tags_json?: string | null
          turn_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          story_id?: string
          user_id?: string
          world_id?: string
          title?: string
          premise_text?: string
          story_mode?: string
          player_character_id?: string | null
          story_prompt?: string
          model_override?: string | null
          params_override_json?: string | null
          context_turns_override?: number | null
          tags_json?: string | null
          turn_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      story_characters: {
        Row: {
          story_character_id: string
          story_id: string
          user_id: string
          character_id: string
          display_name_override: string | null
          is_player: boolean
          created_at: string
        }
        Insert: {
          story_character_id?: string
          story_id: string
          user_id: string
          character_id: string
          display_name_override?: string | null
          is_player?: boolean
          created_at?: string
        }
        Update: {
          story_character_id?: string
          story_id?: string
          user_id?: string
          character_id?: string
          display_name_override?: string | null
          is_player?: boolean
          created_at?: string
        }
      }
      story_character_overrides: {
        Row: {
          story_character_id: string
          story_id: string
          user_id: string
          override_profile_text: string | null
          override_voice_style: string | null
          updated_at: string
        }
        Insert: {
          story_character_id: string
          story_id: string
          user_id: string
          override_profile_text?: string | null
          override_voice_style?: string | null
          updated_at?: string
        }
        Update: {
          story_character_id?: string
          story_id?: string
          user_id?: string
          override_profile_text?: string | null
          override_voice_style?: string | null
          updated_at?: string
        }
      }
      story_state_values: {
        Row: {
          story_id: string
          user_id: string
          story_character_id: string
          schema_key: string
          value_json: string
          updated_at: string
        }
        Insert: {
          story_id: string
          user_id: string
          story_character_id: string
          schema_key: string
          value_json: string
          updated_at?: string
        }
        Update: {
          story_id?: string
          user_id?: string
          story_character_id?: string
          schema_key?: string
          value_json?: string
          updated_at?: string
        }
      }
      story_turns: {
        Row: {
          turn_id: string
          story_id: string
          user_id: string
          turn_index: number
          user_input_text: string
          narrative_text: string
          created_at: string
          error_flag: boolean | null
          token_usage_json: string | null
        }
        Insert: {
          turn_id?: string
          story_id: string
          user_id: string
          turn_index: number
          user_input_text: string
          narrative_text: string
          created_at?: string
          error_flag?: boolean | null
          token_usage_json?: string | null
        }
        Update: {
          turn_id?: string
          story_id?: string
          user_id?: string
          turn_index?: number
          user_input_text?: string
          narrative_text?: string
          created_at?: string
          error_flag?: boolean | null
          token_usage_json?: string | null
        }
      }
      change_log: {
        Row: {
          change_id: string
          turn_id: string
          story_id: string
          user_id: string
          entity_type: string
          target_story_character_id: string | null
          schema_key: string | null
          op: string
          before_value_json: string | null
          after_value_json: string | null
          reason_text: string
        }
        Insert: {
          change_id?: string
          turn_id: string
          story_id: string
          user_id: string
          entity_type: string
          target_story_character_id?: string | null
          schema_key?: string | null
          op: string
          before_value_json?: string | null
          after_value_json?: string | null
          reason_text: string
        }
        Update: {
          change_id?: string
          turn_id?: string
          story_id?: string
          user_id?: string
          entity_type?: string
          target_story_character_id?: string | null
          schema_key?: string | null
          op?: string
          before_value_json?: string | null
          after_value_json?: string | null
          reason_text?: string
        }
      }
      story_summaries: {
        Row: {
          summary_id: string
          story_id: string
          user_id: string
          generated_at_turn: number
          summary_text: string
          created_at: string
        }
        Insert: {
          summary_id?: string
          story_id: string
          user_id: string
          generated_at_turn: number
          summary_text: string
          created_at?: string
        }
        Update: {
          summary_id?: string
          story_id?: string
          user_id?: string
          generated_at_turn?: number
          summary_text?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
