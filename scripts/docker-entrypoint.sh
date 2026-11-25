#!/bin/sh
set -e

echo "==> Innobuddy startup checks"

# 1. Writable data directory
if [ ! -w "/app/data" ]; then
  echo "ERROR: /app/data is not writable. Check your volume mount permissions."
  exit 1
fi
echo "  [ok] /app/data is writable"

# 2. Workspace roots
if [ -z "$WORKSPACE_ROOTS" ]; then
  echo "  [warn] WORKSPACE_ROOTS is not set - users won't be able to open workspaces"
else
  IFS=',' ; for root in $WORKSPACE_ROOTS; do
    root=$(echo "$root" | xargs)  # trim whitespace
    if [ -d "$root" ]; then
      echo "  [ok] workspace root exists: $root"
    else
      echo "  [warn] workspace root missing: $root - mount it as a volume"
    fi
  done
  unset IFS
fi

# 3. API key check
has_key=false
for var in OPENAI_API_KEY ANTHROPIC_API_KEY GEMINI_API_KEY MOONSHOT_API_KEY DEEPSEEK_API_KEY QWEN_API_KEY SHLAB_API_KEY MINIMAX_API_KEY ZHIPU_API_KEY; do
  eval val=\$$var
  if [ -n "$val" ] && [ "$val" != "sk-..." ] && [ "$val" != "sk-ant-..." ] && [ "$val" != "..." ] && [ "$val" != "none" ]; then
    has_key=true
    break
  fi
done
if [ "$has_key" = true ]; then
  echo "  [ok] at least one AI API key is configured"
else
  echo "  [warn] no AI API key detected - chat features will not work"
fi

# 4. Database connection and migrations
# Relational data lives in MySQL. The app runs Drizzle migrations during
# startup via src/lib/db/migrate.ts.
case "$DATABASE_URL" in
  mysql://*) echo "  [ok] DATABASE_URL points to MySQL" ;;
  "") echo "ERROR: DATABASE_URL is not set. Set it to mysql://user:password@host:3306/database"; exit 1 ;;
  *) echo "ERROR: DATABASE_URL must start with mysql:// (SQLite is no longer supported)"; exit 1 ;;
esac
echo "==> Database migrations will run during app startup"

# 5. Start the server
echo "==> Starting Innobuddy on port ${PORT:-3000}"
exec node server.js
