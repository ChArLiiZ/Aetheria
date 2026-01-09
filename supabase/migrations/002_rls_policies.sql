-- ==================== Row Level Security Policies ====================
-- Ensures users can only access their own data

-- ==================== Enable RLS on all tables ====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_state_schema ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_character_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_state_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;

-- ==================== Users Table Policies ====================
-- Users can read their own data
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Users can update their own data
CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid()::text = user_id::text);

-- Allow user creation (for registration)
CREATE POLICY "Anyone can create users"
  ON users FOR INSERT
  WITH CHECK (true);

-- ==================== Provider Settings Policies ====================
CREATE POLICY "Users can CRUD own provider settings"
  ON provider_settings FOR ALL
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ==================== Worlds Policies ====================
CREATE POLICY "Users can CRUD own worlds"
  ON worlds FOR ALL
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ==================== World State Schema Policies ====================
CREATE POLICY "Users can CRUD own world state schema"
  ON world_state_schema FOR ALL
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ==================== Characters Policies ====================
CREATE POLICY "Users can CRUD own characters"
  ON characters FOR ALL
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ==================== Stories Policies ====================
CREATE POLICY "Users can CRUD own stories"
  ON stories FOR ALL
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ==================== Story Characters Policies ====================
CREATE POLICY "Users can CRUD own story characters"
  ON story_characters FOR ALL
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ==================== Story Character Overrides Policies ====================
CREATE POLICY "Users can CRUD own story character overrides"
  ON story_character_overrides FOR ALL
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ==================== Story State Values Policies ====================
CREATE POLICY "Users can CRUD own story state values"
  ON story_state_values FOR ALL
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ==================== Story Relationships Policies ====================
CREATE POLICY "Users can CRUD own story relationships"
  ON story_relationships FOR ALL
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ==================== Story Turns Policies ====================
CREATE POLICY "Users can CRUD own story turns"
  ON story_turns FOR ALL
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- ==================== Change Log Policies ====================
CREATE POLICY "Users can read own change log"
  ON change_log FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own change log"
  ON change_log FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

-- ==================== End of RLS Policies ====================
