-- ==================== Visibility System ====================
-- Add public/private visibility to worlds and characters

-- 1. Add visibility column to worlds
ALTER TABLE worlds ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'public'));
ALTER TABLE worlds ADD COLUMN published_at TIMESTAMPTZ;

-- 2. Add visibility column to characters
ALTER TABLE characters ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'public'));
ALTER TABLE characters ADD COLUMN published_at TIMESTAMPTZ;

-- 3. Create indexes for faster public content queries
CREATE INDEX idx_worlds_visibility ON worlds(visibility) WHERE visibility = 'public';
CREATE INDEX idx_characters_visibility ON characters(visibility) WHERE visibility = 'public';

-- 4. RLS Policies: Allow reading public content

-- Anyone can read public worlds
CREATE POLICY "Anyone can read public worlds"
  ON worlds FOR SELECT
  USING (visibility = 'public');

-- Anyone can read public characters
CREATE POLICY "Anyone can read public characters"
  ON characters FOR SELECT
  USING (visibility = 'public');

-- Anyone can read schemas of public worlds
CREATE POLICY "Anyone can read public world schemas"
  ON world_state_schema FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM worlds 
      WHERE worlds.world_id = world_state_schema.world_id 
      AND worlds.visibility = 'public'
    )
  );

-- ==================== End of Migration ====================
