-- ==================== Global State Scope ====================
-- Add scope field to world_state_schema to support global (non-character) state fields
-- e.g., current_time, weather, world_events

ALTER TABLE world_state_schema
ADD COLUMN scope TEXT NOT NULL DEFAULT 'character'
CHECK (scope IN ('character', 'global'));

-- Create index for scope filtering
CREATE INDEX idx_world_state_schema_scope ON world_state_schema(world_id, scope);
