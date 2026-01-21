-- 新增 last_synced_at 欄位追蹤已同步的版本時間
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- 初始化：將現有複製品的 last_synced_at 設為當前時間（視為已同步）
UPDATE worlds SET last_synced_at = NOW() WHERE forked_from_id IS NOT NULL AND last_synced_at IS NULL;
UPDATE characters SET last_synced_at = NOW() WHERE forked_from_id IS NOT NULL AND last_synced_at IS NULL;
