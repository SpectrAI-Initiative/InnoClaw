# Local Development

This guide covers running, debugging, and iterating on InnoClaw locally.

## Starting the Development Server

```bash
npm run dev
```

This starts the Next.js development server with hot module replacement (HMR). The application is available at **http://localhost:3000**.

### Development Features

- **Hot Reload** — Changes to components and pages are reflected immediately
- **API Route Reload** — Server-side API changes take effect on the next request
- **Error Overlay** — Build errors and runtime errors are displayed in the browser

## Dev Helper Scripts

Three shell scripts are provided for managing the development server in the background:

### Start the Dev Server

```bash
bash dev-start.sh
```

This script checks for port conflicts, installs dependencies if needed, runs database migrations, and starts the dev server in the background. Logs are written to `logs/dev.log` and the server PID is tracked for later use.

### Check Server Status

```bash
bash dev-status.sh
```

Reports whether the dev server is currently running.

### Stop the Dev Server

```bash
bash dev-stop.sh
```

Stops the dev server using the stored PID.

## Common Development Tasks

### Running Type Checks

```bash
npx tsc --noEmit
```

### Running Lint

```bash
npm run lint
```

Uses ESLint with the project's configured rules.

### Building for Production

```bash
npm run build
```

Creates an optimized production build. This also performs type checking.

### Database Operations

```bash
# Run migrations (apply schema changes)
npx drizzle-kit migrate

# Generate new migration files (after modifying schema.ts)
npx drizzle-kit generate

# Explore the database interactively
npx drizzle-kit studio
```

## Debugging

### Server-Side Debugging

1. Start the dev server with the Node.js inspector:
   ```bash
   NODE_OPTIONS='--inspect' npm run dev
   ```
2. Open `chrome://inspect` in Chrome and connect to the Node.js process
3. Set breakpoints in API routes and server-side code

### Client-Side Debugging

Use the browser's built-in developer tools:
- **React DevTools** — Inspect component hierarchy and state
- **Network Tab** — Monitor API requests and responses
- **Console** — View logs and errors

## Environment Setup Tips

### Without AI API Keys

You can develop most features without configuring AI API keys:
- Workspace management, file browser, and UI components work without any API key
- AI chat and note generation features will show a "not configured" message

### Multiple Root Directories

For testing workspace management with multiple roots:

```ini
WORKSPACE_ROOTS=/tmp/workspace-a,/tmp/workspace-b
```

### Using a Local AI Proxy

If you run a local LLM (e.g., via Ollama or LM Studio) with an OpenAI-compatible API:

```ini
OPENAI_API_KEY=dummy-key
OPENAI_BASE_URL=http://localhost:11434/v1
```
