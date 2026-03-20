-- =============================================================
-- Deep Research v2: Add columns for literature rounds, reviewer
-- battles, execution tracking, and message enrichment.
-- =============================================================

-- Sessions: track round/loop counters
ALTER TABLE deep_research_sessions ADD COLUMN literature_round INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deep_research_sessions ADD COLUMN reviewer_round INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deep_research_sessions ADD COLUMN execution_loop INTEGER NOT NULL DEFAULT 0;

-- Messages: link to nodes and artifacts
ALTER TABLE deep_research_messages ADD COLUMN related_node_id TEXT;
ALTER TABLE deep_research_messages ADD COLUMN related_artifact_ids_json TEXT; -- JSON: string[]

-- Nodes: track which phase spawned them
ALTER TABLE deep_research_nodes ADD COLUMN phase TEXT;

-- Artifacts: add type index for efficient filtering
CREATE INDEX IF NOT EXISTS dr_artifacts_type_idx ON deep_research_artifacts(artifact_type);
