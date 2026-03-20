ALTER TABLE deep_research_sessions ADD COLUMN remote_profile_id TEXT REFERENCES remote_profiles(id) ON DELETE SET NULL;
