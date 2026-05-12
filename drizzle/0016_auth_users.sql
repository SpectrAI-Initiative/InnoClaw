-- Local authentication and user ownership

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_token_hash_unique_idx ON user_sessions(token_hash);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS user_sessions_expires_idx ON user_sessions(expires_at);
--> statement-breakpoint
ALTER TABLE workspaces ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS workspaces_owner_user_idx ON workspaces(owner_user_id);
--> statement-breakpoint
ALTER TABLE skills ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS skills_owner_user_idx ON skills(owner_user_id);
--> statement-breakpoint
ALTER TABLE scheduled_tasks ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS scheduled_tasks_owner_user_idx ON scheduled_tasks(owner_user_id);
--> statement-breakpoint
ALTER TABLE hf_datasets ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS hf_datasets_owner_user_idx ON hf_datasets(owner_user_id);
