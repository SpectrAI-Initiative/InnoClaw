-- Deep Research: Execution Records (persisted)
-- Phase 5 of 24-section spec refactoring

CREATE TABLE IF NOT EXISTS deep_research_execution_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES deep_research_sessions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  record_type TEXT NOT NULL DEFAULT 'local',
  status TEXT NOT NULL DEFAULT 'pending',
  remote_job_id TEXT,
  remote_host TEXT,
  command TEXT NOT NULL DEFAULT '',
  config_json TEXT,
  result_json TEXT,
  submitted_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS dr_exec_records_session_idx ON deep_research_execution_records(session_id);
CREATE INDEX IF NOT EXISTS dr_exec_records_status_idx ON deep_research_execution_records(status);
CREATE INDEX IF NOT EXISTS dr_exec_records_node_idx ON deep_research_execution_records(node_id);
