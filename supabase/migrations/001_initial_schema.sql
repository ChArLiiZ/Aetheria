-- ==================== Aetheria Database Schema ====================
-- This file creates all tables for the Aetheria application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== Users Table ====================
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  last_login_at TIMESTAMPTZ
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- ==================== Provider Settings Table ====================
CREATE TABLE provider_settings (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openrouter', 'gemini', 'openai')),
  api_key TEXT NOT NULL,
  default_model TEXT NOT NULL,
  default_params_json TEXT NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);

-- ==================== Worlds Table ====================
CREATE TABLE worlds (
  world_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rules_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster user queries
CREATE INDEX idx_worlds_user_id ON worlds(user_id);

-- ==================== World State Schema Table ====================
CREATE TABLE world_state_schema (
  schema_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  world_id UUID NOT NULL REFERENCES worlds(world_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  schema_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('number', 'text', 'bool', 'enum', 'list_text')),
  ai_description TEXT NOT NULL,
  default_value_json TEXT DEFAULT '',
  enum_options_json TEXT DEFAULT '',
  number_constraints_json TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(world_id, schema_key)
);

-- Create indexes
CREATE INDEX idx_world_state_schema_world_id ON world_state_schema(world_id);
CREATE INDEX idx_world_state_schema_user_id ON world_state_schema(user_id);

-- ==================== Characters Table ====================
CREATE TABLE characters (
  character_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  core_profile_text TEXT NOT NULL,
  tags_json TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster user queries
CREATE INDEX idx_characters_user_id ON characters(user_id);

-- ==================== Stories Table ====================
CREATE TABLE stories (
  story_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  world_id UUID NOT NULL REFERENCES worlds(world_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  premise_text TEXT NOT NULL,
  story_mode TEXT NOT NULL CHECK (story_mode IN ('PLAYER_CHARACTER', 'DIRECTOR')),
  player_character_id UUID,
  story_prompt TEXT NOT NULL,
  model_override TEXT,
  params_override_json TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  turn_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_stories_user_id ON stories(user_id);
CREATE INDEX idx_stories_world_id ON stories(world_id);
CREATE INDEX idx_stories_status ON stories(status);

-- ==================== Story Characters Table ====================
CREATE TABLE story_characters (
  story_character_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(story_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  display_name_override TEXT,
  is_player BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_story_characters_story_id ON story_characters(story_id);
CREATE INDEX idx_story_characters_character_id ON story_characters(character_id);

-- ==================== Story Character Overrides Table ====================
CREATE TABLE story_character_overrides (
  story_character_id UUID PRIMARY KEY REFERENCES story_characters(story_character_id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(story_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  override_profile_text TEXT NOT NULL,
  override_voice_style TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== Story State Values Table ====================
CREATE TABLE story_state_values (
  story_id UUID NOT NULL REFERENCES stories(story_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  story_character_id UUID NOT NULL REFERENCES story_characters(story_character_id) ON DELETE CASCADE,
  schema_key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, story_character_id, schema_key)
);

-- Create index
CREATE INDEX idx_story_state_values_story_id ON story_state_values(story_id);

-- ==================== Story Relationships Table ====================
CREATE TABLE story_relationships (
  story_id UUID NOT NULL REFERENCES stories(story_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  from_story_character_id UUID NOT NULL REFERENCES story_characters(story_character_id) ON DELETE CASCADE,
  to_story_character_id UUID NOT NULL REFERENCES story_characters(story_character_id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, from_story_character_id, to_story_character_id)
);

-- Create index
CREATE INDEX idx_story_relationships_story_id ON story_relationships(story_id);

-- ==================== Story Turns Table ====================
CREATE TABLE story_turns (
  turn_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(story_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  user_input_text TEXT NOT NULL,
  narrative_text TEXT NOT NULL,
  dialogue_json TEXT NOT NULL DEFAULT '[]',
  scene_tags_json TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_flag BOOLEAN DEFAULT FALSE,
  token_usage_json TEXT,
  UNIQUE(story_id, turn_index)
);

-- Create indexes
CREATE INDEX idx_story_turns_story_id ON story_turns(story_id);
CREATE INDEX idx_story_turns_created_at ON story_turns(created_at DESC);

-- ==================== Change Log Table ====================
CREATE TABLE change_log (
  change_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turn_id UUID NOT NULL REFERENCES story_turns(turn_id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(story_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('state', 'relationship')),

  -- For state changes
  target_story_character_id UUID REFERENCES story_characters(story_character_id) ON DELETE CASCADE,
  schema_key TEXT,

  -- For relationship changes
  from_story_character_id UUID REFERENCES story_characters(story_character_id) ON DELETE CASCADE,
  to_story_character_id UUID REFERENCES story_characters(story_character_id) ON DELETE CASCADE,

  op TEXT NOT NULL,
  before_value_json TEXT,
  after_value_json TEXT,
  reason_text TEXT NOT NULL
);

-- Create indexes
CREATE INDEX idx_change_log_turn_id ON change_log(turn_id);
CREATE INDEX idx_change_log_story_id ON change_log(story_id);

-- ==================== Updated At Triggers ====================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_settings_updated_at BEFORE UPDATE ON provider_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_worlds_updated_at BEFORE UPDATE ON worlds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_world_state_schema_updated_at BEFORE UPDATE ON world_state_schema
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_story_character_overrides_updated_at BEFORE UPDATE ON story_character_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_story_state_values_updated_at BEFORE UPDATE ON story_state_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_story_relationships_updated_at BEFORE UPDATE ON story_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== End of Schema ====================
