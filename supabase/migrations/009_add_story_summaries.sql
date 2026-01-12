-- Migration: Add story_summaries table for rolling summary feature
-- This table stores summary history to support story rollback

CREATE TABLE story_summaries (
  summary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(story_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id),
  generated_at_turn INTEGER NOT NULL,  -- 摘要生成時的回合數
  summary_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient lookup: find summary for a specific turn
CREATE INDEX idx_story_summaries_story_turn 
  ON story_summaries(story_id, generated_at_turn DESC);

-- Enable RLS for security
ALTER TABLE story_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own summaries
CREATE POLICY "Users can manage their own summaries"
  ON story_summaries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

