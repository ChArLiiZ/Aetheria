-- 集中式標籤系統
-- Migration: 011_centralized_tags.sql

-- 建立 tags 表
CREATE TABLE IF NOT EXISTS tags (
  tag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('world', 'character', 'story')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tag_type, name)
);

-- 建立世界觀標籤關聯表
CREATE TABLE IF NOT EXISTS world_tags (
  world_id UUID NOT NULL REFERENCES worlds(world_id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (world_id, tag_id)
);

-- 建立角色標籤關聯表
CREATE TABLE IF NOT EXISTS character_tags (
  character_id UUID NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (character_id, tag_id)
);

-- 建立故事標籤關聯表
CREATE TABLE IF NOT EXISTS story_tags (
  story_id UUID NOT NULL REFERENCES stories(story_id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, tag_id)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_tags_user_type ON tags(user_id, tag_type);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- RLS 政策
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_tags ENABLE ROW LEVEL SECURITY;

-- tags 表的 RLS
CREATE POLICY "Users can view own tags" ON tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" ON tags
  FOR DELETE USING (auth.uid() = user_id);

-- world_tags 的 RLS
CREATE POLICY "Users can manage world_tags" ON world_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM worlds WHERE worlds.world_id = world_tags.world_id AND worlds.user_id = auth.uid())
  );

-- character_tags 的 RLS
CREATE POLICY "Users can manage character_tags" ON character_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM characters WHERE characters.character_id = character_tags.character_id AND characters.user_id = auth.uid())
  );

-- story_tags 的 RLS
CREATE POLICY "Users can manage story_tags" ON story_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM stories WHERE stories.story_id = story_tags.story_id AND stories.user_id = auth.uid())
  );

-- 資料遷移：從現有 tags_json 遷移到新結構
-- 遷移 worlds 的 tags
DO $$
DECLARE
  r RECORD;
  tag_name TEXT;
  new_tag_id UUID;
BEGIN
  FOR r IN SELECT world_id, user_id, tags_json FROM worlds WHERE tags_json IS NOT NULL AND tags_json != '' AND tags_json != '[]'
  LOOP
    BEGIN
      FOR tag_name IN SELECT jsonb_array_elements_text(r.tags_json::jsonb)
      LOOP
        -- 取得或建立 tag
        INSERT INTO tags (user_id, tag_type, name)
        VALUES (r.user_id, 'world', tag_name)
        ON CONFLICT (user_id, tag_type, name) DO NOTHING;
        
        SELECT tag_id INTO new_tag_id FROM tags 
        WHERE user_id = r.user_id AND tag_type = 'world' AND name = tag_name;
        
        -- 建立關聯
        INSERT INTO world_tags (world_id, tag_id)
        VALUES (r.world_id, new_tag_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      -- 跳過無效的 JSON
      NULL;
    END;
  END LOOP;
END $$;

-- 遷移 characters 的 tags
DO $$
DECLARE
  r RECORD;
  tag_name TEXT;
  new_tag_id UUID;
BEGIN
  FOR r IN SELECT character_id, user_id, tags_json FROM characters WHERE tags_json IS NOT NULL AND tags_json != '' AND tags_json != '[]'
  LOOP
    BEGIN
      FOR tag_name IN SELECT jsonb_array_elements_text(r.tags_json::jsonb)
      LOOP
        INSERT INTO tags (user_id, tag_type, name)
        VALUES (r.user_id, 'character', tag_name)
        ON CONFLICT (user_id, tag_type, name) DO NOTHING;
        
        SELECT tag_id INTO new_tag_id FROM tags 
        WHERE user_id = r.user_id AND tag_type = 'character' AND name = tag_name;
        
        INSERT INTO character_tags (character_id, tag_id)
        VALUES (r.character_id, new_tag_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- 遷移 stories 的 tags
DO $$
DECLARE
  r RECORD;
  tag_name TEXT;
  new_tag_id UUID;
BEGIN
  FOR r IN SELECT story_id, user_id, tags_json FROM stories WHERE tags_json IS NOT NULL AND tags_json != '' AND tags_json != '[]'
  LOOP
    BEGIN
      FOR tag_name IN SELECT jsonb_array_elements_text(r.tags_json::jsonb)
      LOOP
        INSERT INTO tags (user_id, tag_type, name)
        VALUES (r.user_id, 'story', tag_name)
        ON CONFLICT (user_id, tag_type, name) DO NOTHING;
        
        SELECT tag_id INTO new_tag_id FROM tags 
        WHERE user_id = r.user_id AND tag_type = 'story' AND name = tag_name;
        
        INSERT INTO story_tags (story_id, tag_id)
        VALUES (r.story_id, new_tag_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;
