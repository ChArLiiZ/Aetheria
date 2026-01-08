-- Diagnostic script to check authentication status
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check auth.users (Supabase Auth users)
SELECT
  'auth.users' as table_name,
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. Check public.users (Application users)
SELECT
  'public.users' as table_name,
  user_id,
  email,
  display_name,
  created_at,
  last_login_at
FROM public.users
ORDER BY created_at DESC;

-- 3. Check for orphaned records (in public.users but not in auth.users)
SELECT
  'orphaned_in_public' as issue,
  u.user_id,
  u.email,
  u.display_name,
  u.created_at
FROM public.users u
LEFT JOIN auth.users a ON u.user_id = a.id
WHERE a.id IS NULL;

-- 4. Check for missing profiles (in auth.users but not in public.users)
SELECT
  'missing_profile' as issue,
  a.id,
  a.email,
  a.created_at
FROM auth.users a
LEFT JOIN public.users u ON a.id = u.user_id
WHERE u.user_id IS NULL;
