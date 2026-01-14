-- Migration: Remove story status column
-- Description: Removes the status column from stories table as stories no longer have active/ended states

-- Drop the index first
DROP INDEX IF EXISTS idx_stories_status;

-- Drop the status column from stories table
ALTER TABLE stories DROP COLUMN IF EXISTS status;
