-- 確保 original_author_id 引用的用戶資訊可以被讀取
-- 這允許查詢公開內容時能夠獲取原作者的顯示名稱和頭像

-- 更新 users 表的 RLS，允許讀取任何在 worlds/characters 中被引用為 original_author_id 的用戶
CREATE OR REPLACE FUNCTION public.is_referenced_as_original_author(user_id_param uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM worlds WHERE original_author_id = user_id_param AND visibility = 'public'
    ) OR EXISTS (
        SELECT 1 FROM characters WHERE original_author_id = user_id_param AND visibility = 'public'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 新增策略：允許讀取原作者資訊
DROP POLICY IF EXISTS "Allow read original author info" ON users;
CREATE POLICY "Allow read original author info" ON users
    FOR SELECT TO authenticated
    USING (is_referenced_as_original_author(user_id));
