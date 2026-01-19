-- 允許任何人讀取公開內容創建者的公開資訊（display_name, avatar_url）
CREATE POLICY "Anyone can read public user info for public content"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM worlds WHERE worlds.user_id = users.user_id AND worlds.visibility = 'public'
  )
  OR
  EXISTS (
    SELECT 1 FROM characters WHERE characters.user_id = users.user_id AND characters.visibility = 'public'
  )
);

-- 允許讀取公開世界觀的標籤關聯
CREATE POLICY "Anyone can read tags for public worlds"
ON public.world_tags
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM worlds WHERE worlds.world_id = world_tags.world_id AND worlds.visibility = 'public'
  )
);

-- 允許讀取公開角色的標籤關聯
CREATE POLICY "Anyone can read tags for public characters"
ON public.character_tags
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM characters WHERE characters.character_id = character_tags.character_id AND characters.visibility = 'public'
  )
);

-- 允許讀取用於公開內容的標籤
CREATE POLICY "Anyone can read tags used in public content"
ON public.tags
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM world_tags wt
    JOIN worlds w ON w.world_id = wt.world_id
    WHERE wt.tag_id = tags.tag_id AND w.visibility = 'public'
  )
  OR
  EXISTS (
    SELECT 1 FROM character_tags ct
    JOIN characters c ON c.character_id = ct.character_id
    WHERE ct.tag_id = tags.tag_id AND c.visibility = 'public'
  )
);
