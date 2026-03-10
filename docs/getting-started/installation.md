# Installation

This guide walks you through setting up InnoClaw locally for development or self-hosting.

## Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 18+ (20+ recommended) | Runtime environment |
| **npm** | Included with Node.js | Package manager |
| **Git** | Any recent version | Required for GitHub clone/pull features |

Optional:

| Requirement | Notes |
|-------------|-------|
| **AI API Key** | At least one (OpenAI, Anthropic, or Gemini) for AI chat and note generation |
| **GitHub Token** | For cloning/pulling private repositories |

## Step 1: Clone the Repository

```bash
git clone https://github.com/zjowowen/InnoClaw.git
cd InnoClaw
```

## Step 2: Install Dependencies

```bash
npm install
```

This installs all required Node.js packages including Next.js, the AI SDK, database drivers, and UI components.

## Step 3: Configure Environment Variables

Copy the example environment file and edit it:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```ini
# [Required] Workspace root paths (comma-separated absolute paths)
WORKSPACE_ROOTS=/data/research,/data/projects

# [Optional] OpenAI API Key
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# [Optional] Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx

# [Optional] Gemini API Key
GEMINI_API_KEY=your-gemini-key
```

See [Environment Variables](environment-variables.md) for a complete reference of all available options.

## Step 4: Create Workspace Directories

Ensure the directories specified in `WORKSPACE_ROOTS` exist on your system:

```bash
# Linux / macOS
mkdir -p /data/research /data/projects

# Windows (PowerShell)
mkdir D:/Data/research
mkdir D:/Data/projects
```

:::{important}
The application will **not** automatically create these directories. They must exist before starting the server.
:::

## Step 5: Initialize the Database

Run the database migration to create the SQLite database:

```bash
npx drizzle-kit migrate
```

This creates the database file at `./data/innoclaw.db` with all required tables.

## Step 6: Start the Development Server

```bash
npm run dev
```

Open your browser and navigate to **http://localhost:3000** to start using InnoClaw.

## Verifying Your Setup

After starting the server, you should be able to:

1. See the workspace list on the home page
2. Create a new workspace from one of your configured root directories
3. Browse and manage files in the workspace
4. If an API key is configured, chat with AI about your files (after clicking "Sync")

:::{tip}
If you don't configure any API keys, workspace management, file browsing, uploading, editing, and GitHub cloning features will still work. Only AI chat and note generation will be disabled.
:::
