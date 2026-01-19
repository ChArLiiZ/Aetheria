-- 新增 Fork 功能所需欄位
-- original_author_id: 原作者 ID（NULL = user_id 就是原作者）
-- forked_from_id: 來源 ID（可追溯）

ALTER TABLE worlds 
ADD COLUMN IF NOT EXISTS original_author_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS forked_from_id UUID REFERENCES worlds(world_id);

ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS original_author_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS forked_from_id UUID REFERENCES characters(character_id);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_worlds_original_author ON worlds(original_author_id);
CREATE INDEX IF NOT EXISTS idx_worlds_forked_from ON worlds(forked_from_id);
CREATE INDEX IF NOT EXISTS idx_characters_original_author ON characters(original_author_id);
CREATE INDEX IF NOT EXISTS idx_characters_forked_from ON characters(forked_from_id);
