-- Deep Research: Requirement State tracking
-- Phase 1 of 24-section spec refactoring

CREATE TABLE IF NOT EXISTS deep_research_requirements (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES deep_research_sessions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS dr_requirements_session_idx ON deep_research_requirements(session_id);
CREATE INDEX IF NOT EXISTS dr_requirements_version_idx ON deep_research_requirements(session_id, version);

-- Add requirement_version column to deep_research_nodes
ALTER TABLE deep_research_nodes ADD COLUMN requirement_version INTEGER DEFAULT 0;
