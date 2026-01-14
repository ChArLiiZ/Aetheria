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
          world_name: string
          description: string
          core_setting: string
          tags_json: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          world_id?: string
          user_id: string
          world_name: string
          description: string
          core_setting: string
          tags_json?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          world_id?: string
          user_id?: string
          world_name?: string
          description?: string
          core_setting?: string
          tags_json?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      world_state_schema: {
        Row: {
          schema_id: string
          world_id: string
          user_id: string
          state_name: string
          state_type: string
          description: string
          default_value: string | null
          min_value: number | null
          max_value: number | null
          enum_options_json: string | null
          list_text_items_json: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          schema_id?: string
          world_id: string
          user_id: string
          state_name: string
          state_type: string
          description: string
          default_value?: string | null
          min_value?: number | null
          max_value?: number | null
          enum_options_json?: string | null
          list_text_items_json?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          schema_id?: string
          world_id?: string
          user_id?: string
          state_name?: string
          state_type?: string
          description?: string
          default_value?: string | null
          min_value?: number | null
          max_value?: number | null
          enum_options_json?: string | null
          list_text_items_json?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      characters: {
        Row: {
          character_id: string
          user_id: string
          character_name: string
          core_profile: string
          tags_json: string
          created_at: string
          updated_at: string
        }
        Insert: {
          character_id?: string
          user_id: string
          character_name: string
          core_profile: string
          tags_json?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          user_id?: string
          character_name?: string
          core_profile?: string
          tags_json?: string
          created_at?: string
          updated_at?: string
        }
      }
      stories: {
        Row: {
          story_id: string
          user_id: string
          world_id: string
          story_title: string
          story_objective: string
          objective_progress_summary: string
          ending_summary: string | null
          tags_json: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          story_id?: string
          user_id: string
          world_id: string
          story_title: string
          story_objective: string
          objective_progress_summary?: string
          ending_summary?: string | null
          tags_json?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          story_id?: string
          user_id?: string
          world_id?: string
          story_title?: string
          story_objective?: string
          objective_progress_summary?: string
          ending_summary?: string | null
          tags_json?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      story_characters: {
        Row: {
          story_id: string
          character_id: string
          user_id: string
          added_at: string
        }
        Insert: {
          story_id: string
          character_id: string
          user_id: string
          added_at?: string
        }
        Update: {
          story_id?: string
          character_id?: string
          user_id?: string
          added_at?: string
        }
      }
      story_character_overrides: {
        Row: {
          story_id: string
          character_id: string
          user_id: string
          override_profile: string | null
          updated_at: string
        }
        Insert: {
          story_id: string
          character_id: string
          user_id: string
          override_profile?: string | null
          updated_at?: string
        }
        Update: {
          story_id?: string
          character_id?: string
          user_id?: string
          override_profile?: string | null
          updated_at?: string
        }
      }
      story_state_values: {
        Row: {
          story_id: string
          schema_id: string
          user_id: string
          current_value: string
          updated_at: string
        }
        Insert: {
          story_id: string
          schema_id: string
          user_id: string
          current_value: string
          updated_at?: string
        }
        Update: {
          story_id?: string
          schema_id?: string
          user_id?: string
          current_value?: string
          updated_at?: string
        }
      }
      story_relationships: {
        Row: {
          story_id: string
          character_a_id: string
          character_b_id: string
          user_id: string
          relationship_summary: string
          updated_at: string
        }
        Insert: {
          story_id: string
          character_a_id: string
          character_b_id: string
          user_id: string
          relationship_summary: string
          updated_at?: string
        }
        Update: {
          story_id?: string
          character_a_id?: string
          character_b_id?: string
          user_id?: string
          relationship_summary?: string
          updated_at?: string
        }
      }
      story_turns: {
        Row: {
          turn_id: string
          story_id: string
          user_id: string
          turn_number: number
          user_input: string
          ai_narrative: string
          created_at: string
        }
        Insert: {
          turn_id?: string
          story_id: string
          user_id: string
          turn_number: number
          user_input: string
          ai_narrative: string
          created_at?: string
        }
        Update: {
          turn_id?: string
          story_id?: string
          user_id?: string
          turn_number?: number
          user_input?: string
          ai_narrative?: string
          created_at?: string
        }
      }
      change_log: {
        Row: {
          log_id: string
          story_id: string
          user_id: string
          turn_number: number
          change_type: string
          target_type: string
          target_id: string
          old_value: string | null
          new_value: string
          timestamp: string
        }
        Insert: {
          log_id?: string
          story_id: string
          user_id: string
          turn_number: number
          change_type: string
          target_type: string
          target_id: string
          old_value?: string | null
          new_value: string
          timestamp?: string
        }
        Update: {
          log_id?: string
          story_id?: string
          user_id?: string
          turn_number?: number
          change_type?: string
          target_type?: string
          target_id?: string
          old_value?: string | null
          new_value?: string
          timestamp?: string
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
