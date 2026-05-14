-- ============================================
-- 006_fix_profiles_rls.sql
-- Fix: allow all authenticated users to read user_profiles
-- so case detail page can join created_by/assigned_to/closed_by profiles
-- ============================================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS profiles_select_self ON user_profiles;

-- Allow all authenticated users to read profiles (display names are not sensitive)
CREATE POLICY profiles_select_authenticated ON user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');
