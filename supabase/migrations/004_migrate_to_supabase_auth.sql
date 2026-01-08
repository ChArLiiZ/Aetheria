-- ==================== Migrate to Supabase Auth ====================
-- This migration prepares the database for using Supabase Auth
-- instead of custom authentication

-- Step 1: Drop old RLS policies on users table
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Anyone can create users" ON users;

-- Step 2: Modify users table to work with Supabase Auth
-- Keep user_id as UUID (will sync with auth.users.id)
-- Remove password_hash as Supabase Auth handles passwords

ALTER TABLE users
  DROP COLUMN IF EXISTS password_hash;

-- Add auth_id to link with Supabase Auth (if not using user_id directly)
-- We'll use user_id directly as it's already UUID type

-- Step 3: Create new RLS policies using auth.uid()
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Step 4: Create trigger to auto-create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (user_id, email, display_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'active'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Re-enable RLS on main tables with auth.uid()
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_state_schema ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_settings ENABLE ROW LEVEL SECURITY;

-- Recreate policies for main tables
DROP POLICY IF EXISTS "Users can CRUD own worlds" ON worlds;
CREATE POLICY "Users can CRUD own worlds"
  ON worlds FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own world state schema" ON world_state_schema;
CREATE POLICY "Users can CRUD own world state schema"
  ON world_state_schema FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own characters" ON characters;
CREATE POLICY "Users can CRUD own characters"
  ON characters FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own provider settings" ON provider_settings;
CREATE POLICY "Users can CRUD own provider settings"
  ON provider_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
