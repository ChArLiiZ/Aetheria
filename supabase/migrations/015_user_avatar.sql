-- ==================== User Avatar ====================
-- Add avatar_url column to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Allow users to update their own avatar_url
-- Note: The existing RLS policy for users table should already allow updates to own rows
