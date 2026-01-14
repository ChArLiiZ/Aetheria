-- 資料庫遷移腳本：為 worlds 和 stories 表新增 tags_json 欄位
-- 請在 Supabase Dashboard > SQL Editor 中執行此腳本

-- 為 worlds 表新增 tags_json 欄位
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS tags_json TEXT DEFAULT '';

-- 為 stories 表新增 tags_json 欄位
ALTER TABLE stories ADD COLUMN IF NOT EXISTS tags_json TEXT DEFAULT '';

-- 驗證欄位是否已新增
SELECT 
    table_name, 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name IN ('worlds', 'stories') 
    AND column_name = 'tags_json';
