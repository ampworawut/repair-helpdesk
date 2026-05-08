-- Run this in Supabase Dashboard → SQL Editor
-- Add category column to repair_cases
ALTER TABLE repair_cases ADD COLUMN IF NOT EXISTS category text;
