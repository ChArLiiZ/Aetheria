-- ==================== Disable RLS Temporarily ====================
-- Since we're using custom authentication instead of Supabase Auth,
-- auth.uid() returns null and blocks all operations.
--
-- Temporary solution: Disable RLS on main tables
-- Long-term solution: Use Supabase Auth or route all operations through API

-- Disable RLS on main tables
ALTER TABLE worlds DISABLE ROW LEVEL SECURITY;
ALTER TABLE world_state_schema DISABLE ROW LEVEL SECURITY;
ALTER TABLE characters DISABLE ROW LEVEL SECURITY;
ALTER TABLE provider_settings DISABLE ROW LEVEL SECURITY;

-- Keep RLS enabled on users table for security
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Note: Application-level security is still enforced by checking user_id
-- in all service functions. This is not ideal but works for development.
