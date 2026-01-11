-- =====================================================
-- 008: 故事流程簡化遷移
-- 
-- 變更內容：
-- 1. 新增 provider_settings.default_context_turns
-- 2. 新增 stories.context_turns_override
-- 3. 移除 story_turns.dialogue_json (對話改為 Markdown 格式嵌入 narrative_text)
-- 4. 移除 story_turns.scene_tags_json (已棄用)
-- 5. 刪除 story_relationships 表 (關係功能改用 state schema 實現)
-- 6. 清理 change_log 中的 relationship 相關欄位
-- =====================================================

-- 1. 新增預設上下文回合數欄位到 provider_settings
ALTER TABLE provider_settings 
ADD COLUMN IF NOT EXISTS default_context_turns INTEGER DEFAULT 5;

-- 2. 新增上下文回合數覆蓋欄位到 stories
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS context_turns_override INTEGER;

-- 3. 移除 story_turns 中已棄用的欄位
ALTER TABLE story_turns DROP COLUMN IF EXISTS dialogue_json;
ALTER TABLE story_turns DROP COLUMN IF EXISTS scene_tags_json;

-- 4. 刪除 story_relationships 表
DROP TABLE IF EXISTS story_relationships;

-- 5. 清理 change_log 中的 relationship 相關欄位
ALTER TABLE change_log DROP COLUMN IF EXISTS from_story_character_id;
ALTER TABLE change_log DROP COLUMN IF EXISTS to_story_character_id;

-- 6. 更新 change_log 的 entity_type 約束（如果有的話）
-- 注意：這假設 entity_type 是 TEXT 類型，如果有 CHECK 約束需要另外處理
-- 移除 'relationship' 類型的舊記錄（可選）
DELETE FROM change_log WHERE entity_type = 'relationship';
