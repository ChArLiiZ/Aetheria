-- 圖片上傳功能
-- Migration: 013_image_upload.sql

-- =====================================================
-- 1. 資料庫欄位變更
-- =====================================================

-- 為 characters 表新增 image_url 欄位
ALTER TABLE characters ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- 為 worlds 表新增 image_url 欄位
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- =====================================================
-- 2. Storage Bucket 設置
-- =====================================================

-- 建立 images bucket (如果不存在)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  5242880,  -- 5MB 限制
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- 3. Storage RLS 政策
-- =====================================================

-- 刪除舊政策（如果存在）
DROP POLICY IF EXISTS "Users can upload own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;

-- 用戶可以上傳圖片到自己的目錄
-- 路徑格式: {entity_type}/{user_id}/{entity_id}.webp
CREATE POLICY "Users can upload own images" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'images' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

-- 用戶可以更新自己的圖片
CREATE POLICY "Users can update own images" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'images' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

-- 用戶可以刪除自己的圖片
CREATE POLICY "Users can delete own images" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'images' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

-- 公開讀取（因為 bucket 設為 public）
CREATE POLICY "Public can view images" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'images');
