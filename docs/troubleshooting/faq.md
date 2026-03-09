# Troubleshooting & FAQ

## Frequently Asked Questions

### Can I use VibeLab without an API key?

**Yes.** Workspace management, file browsing, uploading, editing, and GitHub cloning features work without any API key. Only AI chat and note generation features require an API key. The UI will display a prompt indicating that AI features are unavailable.

### How do I use third-party compatible services (proxies, self-hosted models)?

Set `OPENAI_BASE_URL` or `ANTHROPIC_BASE_URL` in your `.env.local` file to point to any API-compatible endpoint:

```ini
OPENAI_BASE_URL=https://api.your-proxy.com/v1
OPENAI_API_KEY=sk-your-key
```

If your proxy doesn't support the embedding endpoint, configure a separate embedding service:

```ini
EMBEDDING_API_KEY=sk-your-embedding-key
EMBEDDING_BASE_URL=https://api.your-embedding-proxy.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

### What file formats are supported for RAG indexing?

| Category | Extensions |
|----------|------------|
| Documents | `.pdf`, `.txt`, `.md`, `.html` |
| Data | `.json`, `.csv` |
| Code | `.js`, `.ts`, `.py`, `.java`, `.go`, `.rs`, `.cpp`, `.c`, `.rb`, `.php`, and more |

### Is indexing slow for large workspaces?

The first sync processes all files (extract text → chunk → generate embeddings), which depends on the number and size of files. Subsequent syncs only process new or modified files (based on file hash comparison), making them significantly faster.

### Can I run VibeLab on Linux?

**Yes.** Set `WORKSPACE_ROOTS` to Linux paths:

```ini
WORKSPACE_ROOTS=/home/user/research,/home/user/projects
```

### GitHub clone fails — what should I check?

1. Verify that `git` is installed: `git --version`
2. Check that `GITHUB_TOKEN` is set correctly in `.env.local`
3. Ensure the token has the `repo` scope for private repositories
4. Check network connectivity to `github.com`

### How do I reset the database?

```bash
# Remove the database file
rm ./data/vibelab.db

# Re-run migrations
npx drizzle-kit migrate
```

This creates a fresh database. All workspaces, chat history, notes, and settings will be lost, but workspace files on disk are not affected.

### How do I back up my data?

Back up the following:

| Item | Location |
|------|----------|
| Database | `./data/vibelab.db` |
| Configuration | `.env.local` |
| Workspace files | Directories listed in `WORKSPACE_ROOTS` |

### The development server won't start

1. Ensure Node.js 18+ is installed: `node --version`
2. Ensure dependencies are installed: `npm install`
3. Ensure the database is initialized: `npx drizzle-kit migrate`
4. Ensure `WORKSPACE_ROOTS` directories exist on disk
5. Check for port conflicts on port 3000

### Build fails with font-related errors

If `npm run build` fails with errors about fetching Google Fonts, this is a network issue. Ensure your build environment has internet access, or configure Next.js to use local fonts.

### How do I change the port?

```bash
# Development
PORT=8080 npm run dev

# Production
PORT=8080 npm run start
```

## Getting Help

- **GitHub Issues** — [Report bugs or request features](https://github.com/zjowowen/notebooklm/issues) (when enabled)
- **Documentation** — You're reading it! Check other sections for specific topics
- **Source Code** — The code is well-structured and documented; see [Project Structure](../development/project-structure.md)
