# Project Structure

This page describes the directory layout and module organization of InnoClaw.

## High-Level Structure

```{mermaid}
graph TB
    subgraph App["src/app/ — Pages & API Routes"]
        Pages["Pages<br/>(page.tsx)"]
        APIRoutes["API Routes<br/>(route.ts)"]
    end

    subgraph Components["src/components/ — React Components"]
        UI["ui/ (shadcn/ui)"]
        Layout["layout/"]
        Workspace["workspaces/"]
        FileBrowser["files/"]
        Chat["chat/"]
        Notes["notes/"]
        Agent["agent/"]
        Skills["skills/"]
        Datasets["datasets/"]
        PaperStudy["paper-study/"]
        Cluster["cluster/"]
        Report["report/"]
        ScheduledTasks["scheduled-tasks/"]
        Terminal["terminal/"]
        Preview["preview/"]
    end

    subgraph Lib["src/lib/ — Core Business Logic"]
        DB["db/ (Drizzle ORM)"]
        AILib["ai/ (Provider Config)"]
        RAGLib["rag/ (Pipeline)"]
        FilesLib["files/ (FS Operations)"]
        GitLib["git/ (GitHub)"]
        BotLib["bot/ (Feishu, WeChat)"]
        ArticleSearchLib["article-search/"]
        ClusterLib["cluster/"]
        HFDatasetsLib["hf-datasets/"]
        ModelScopeLib["modelscope/"]
        ReportLib["report/"]
        SchedulerLib["scheduler"]
        Hooks["hooks/ (SWR)"]
    end

    Pages --> Components
    APIRoutes --> Lib
    Components --> Hooks
    Hooks --> APIRoutes
```

## Directory Layout

```
innoclaw/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Home page (workspace list)
│   │   ├── layout.tsx                # Root layout
│   │   ├── globals.css               # Global styles
│   │   ├── settings/page.tsx         # Settings page
│   │   ├── workspace/[workspaceId]/  # Workspace page (3-panel layout)
│   │   ├── skills/                   # Skills management page
│   │   ├── datasets/                 # Dataset management page
│   │   └── api/                      # API routes
│   │       ├── workspaces/           # Workspace CRUD
│   │       ├── files/                # File operations
│   │       ├── git/                  # Git clone/pull/status
│   │       ├── chat/                 # AI chat (streaming)
│   │       ├── agent/                # Agent chat + summarize
│   │       ├── generate/             # Note generation
│   │       ├── notes/                # Note CRUD
│   │       ├── settings/             # Settings management
│   │       ├── skills/               # Skills CRUD + import/export
│   │       ├── bot/                  # Bot webhook endpoints
│   │       │   ├── feishu/           # Feishu webhook + push API
│   │       │   └── wechat/           # WeChat webhook
│   │       ├── terminal/             # Terminal command execution
│   │       ├── datasets/             # Dataset CRUD + download lifecycle
│   │       ├── paper-study/          # Paper search/fetch/summarize/chat
│   │       ├── scheduled-tasks/      # Scheduled task CRUD
│   │       ├── daily-report/         # Daily report generation
│   │       ├── weekly-report/        # Weekly report generation
│   │       ├── cluster/              # K8s status + operations
│   │       ├── models/               # Model listing from providers
│   │       └── system/               # System info (network speed)
│   ├── components/                   # React components
│   │   ├── ui/                       # shadcn/ui base components
│   │   ├── layout/                   # Header, theme toggle, language toggle
│   │   ├── workspaces/               # Workspace list and creation
│   │   ├── files/                    # File browser, file tree, upload
│   │   ├── chat/                     # Chat messages and input
│   │   ├── notes/                    # Notes list and editor
│   │   ├── git/                      # Git clone/pull dialogs
│   │   ├── agent/                    # Agent mode panel
│   │   ├── skills/                   # Skills form and list
│   │   ├── preview/                  # File preview (images, PDF, 3D, MOL)
│   │   ├── terminal/                 # Terminal emulator UI
│   │   ├── datasets/                 # Dataset download/management UI
│   │   ├── paper-study/              # Paper search and study UI
│   │   ├── cluster/                  # K8s cluster status and operations UI
│   │   ├── report/                   # Report generation UI
│   │   └── scheduled-tasks/          # Scheduled task management UI
│   ├── lib/                          # Core business logic
│   │   ├── db/                       # Database (Drizzle ORM + SQLite)
│   │   │   ├── schema.ts            # Database schema definitions
│   │   │   └── index.ts             # Database connection
│   │   ├── ai/                       # AI provider configuration
│   │   │   ├── providers.ts          # Provider routing (OpenAI/Anthropic/Gemini)
│   │   │   ├── models.ts             # Model definitions and defaults
│   │   │   ├── agent-tools.ts        # Agent mode tools
│   │   │   └── tool-names.ts         # Tool name constants
│   │   ├── rag/                      # RAG pipeline
│   │   │   ├── chunker.ts            # Text chunking
│   │   │   ├── embeddings.ts         # Vector embedding generation
│   │   │   ├── retriever.ts          # Similarity search
│   │   │   └── vector-store.ts       # Vector storage
│   │   ├── files/                    # File system operations
│   │   │   ├── workspace.ts          # Workspace file operations
│   │   │   └── text-extractor.ts     # Text extraction from files
│   │   ├── git/                      # GitHub operations
│   │   ├── bot/                      # Bot integrations
│   │   │   ├── types.ts              # BotAdapter interface
│   │   │   ├── processor.ts          # Message processing
│   │   │   ├── feishu/               # Feishu adapter (client, commands, cards, state)
│   │   │   └── wechat/               # WeChat adapter
│   │   ├── article-search/           # Paper search engine
│   │   │   ├── arxiv.ts              # arXiv API integration
│   │   │   ├── huggingface.ts        # HuggingFace Daily Papers
│   │   │   ├── cache.ts              # Search result caching
│   │   │   └── index.ts              # Unified search interface
│   │   ├── cluster/                  # Kubernetes operations
│   │   │   ├── operations.ts         # Cluster operation recording
│   │   │   └── validators.ts         # K8s input validation
│   │   ├── hf-datasets/              # HuggingFace dataset downloading
│   │   │   ├── downloader.ts         # Download orchestration
│   │   │   ├── manifest.ts           # Manifest computation
│   │   │   ├── metadata.ts           # Repository metadata
│   │   │   ├── preview.ts            # Dataset preview
│   │   │   └── progress.ts           # Progress tracking
│   │   ├── modelscope/               # ModelScope integration
│   │   │   ├── downloader.ts         # Download orchestration
│   │   │   └── metadata.ts           # Repository metadata
│   │   ├── report/                   # Report utilities
│   │   │   ├── download-utils.ts     # Report download helpers
│   │   │   └── extract-report.ts     # Report data extraction
│   │   ├── markdown/                 # Markdown processing
│   │   ├── system/                   # System utilities
│   │   ├── scheduler.ts              # Cron task scheduler engine
│   │   ├── scheduler-handlers.ts     # Task type handlers
│   │   ├── daily-report.ts           # Daily report generation logic
│   │   ├── weekly-report.ts          # Weekly report generation logic
│   │   ├── daily-report-scheduler.ts # Daily report cron handler
│   │   ├── weekly-report-scheduler.ts# Weekly report cron handler
│   │   ├── env.ts                    # Environment variable utilities
│   │   ├── fetcher.ts                # SWR fetch helper
│   │   ├── hooks/                    # SWR data fetching hooks
│   │   └── utils/                    # Utility functions
│   ├── i18n/                         # Internationalization
│   │   ├── request.ts                # Language detection
│   │   └── messages/                 # Translation files
│   │       ├── en.json               # English translations
│   │       └── zh.json               # Chinese translations
│   └── types/                        # TypeScript type definitions
├── public/                           # Static assets
├── drizzle/                          # Database migrations
├── config/                           # Configuration files (skills, etc.)
├── docs/                             # Documentation (Sphinx)
├── data/                             # SQLite database (runtime)
├── dev-start.sh                      # Dev server start script
├── dev-stop.sh                       # Dev server stop script
├── dev-status.sh                     # Dev server status check
├── package.json                      # Node.js dependencies
├── tsconfig.json                     # TypeScript configuration
├── next.config.ts                    # Next.js configuration
├── drizzle.config.ts                 # Drizzle ORM configuration
├── vitest.config.ts                  # Vitest test configuration
└── .env.example                      # Environment variable template
```

## Key Modules

### App Router (`src/app/`)

Next.js 16 App Router with file-based routing. Pages are server components by default; client components use the `"use client"` directive.

### Components (`src/components/`)

React components organized by feature area. Uses shadcn/ui as the base component library with Tailwind CSS for styling.

### Database (`src/lib/db/`)

SQLite database managed by Drizzle ORM. The schema defines 11 tables: workspaces, sources, source chunks, chat messages, notes, app settings, skills, scheduled tasks, cluster operations, HF datasets, and dataset-workspace links.

### RAG Pipeline (`src/lib/rag/`)

The Retrieval-Augmented Generation pipeline handles text chunking, vector embedding, storage, and similarity search. Uses pure JavaScript cosine similarity — no external vector database needed.

### AI Providers (`src/lib/ai/`)

Configures and routes requests to OpenAI, Anthropic, and Gemini providers. Includes model definitions, agent tool implementations, and skill system integration.

### Bot Integrations (`src/lib/bot/`)

Implements the `BotAdapter` interface for Feishu (Lark) and WeChat Enterprise. Each adapter handles webhook verification, message parsing, response formatting, and interactive card-based progress tracking.

### Article Search (`src/lib/article-search/`)

Search engine for academic papers across arXiv and Hugging Face Daily Papers. Supports keyword search, date filtering, related article discovery, and result caching.

### Cluster Operations (`src/lib/cluster/`)

Kubernetes cluster integration for GPU-accelerated workloads. Records operation audit trail and validates kubectl/vcctl inputs.

### Dataset Management (`src/lib/hf-datasets/` and `src/lib/modelscope/`)

Download orchestration for datasets from HuggingFace Hub and ModelScope. Supports pause/resume/cancel, progress tracking, manifest computation, and dataset preview.

### Report Generation (`src/lib/daily-report.ts`, `src/lib/weekly-report.ts`)

AI-powered report generation that analyzes workspace activity (git commits, file changes, chat history) to produce structured daily and weekly summaries.

### Task Scheduler (`src/lib/scheduler.ts`)

Cron-based task execution engine. Polls every 60 seconds and dispatches handlers for each task type (daily_report, weekly_report, git_sync, source_sync, custom).
