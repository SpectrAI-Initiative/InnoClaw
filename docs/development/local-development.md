# Local Development

Run the application with Docker. `npm run dev` and `npm run dev:no-auth` are not supported startup paths.

```powershell
.\scripts\docker-up-local.ps1
```

```bash
./scripts/docker-up-local.sh
```

The app is at **http://127.0.0.1:3000**. Change keys in `.env.docker.local`, then run the script again. For a trusted single-user container without login, set `AUTH_MODE=disabled` in that file. Anyone who can reach the service then has administrator access.

`npm` is for checks, not for serving the app:

```bash
npm install
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Container logs:

```bash
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose.local.yml logs -f innoclaw
```

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

Read the container log with the compose command above. For a type error, run `npx tsc --noEmit` on the host. API behavior belongs in the colocated `route.test.ts` files.

### Client-Side Debugging

Use the browser's built-in developer tools:
- **React DevTools** — Inspect component hierarchy and state
- **Network Tab** — Monitor API requests and responses
- **Console** — View logs and errors

## Environment Setup Tips

### Without an API key

Workspace management and the file browser work without `DEEPSEEK_API_KEY`. Chat shows that AI is not configured.

### Workspace path

Inside the container, `WORKSPACE_ROOTS` is `/research`. The host directory is `HOST_WORKSPACE_PATH` in `.env.docker.local`.
