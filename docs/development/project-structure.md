# Project Structure

This page describes the directory layout and module organization of VibeLab.

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
    end

    subgraph Lib["src/lib/ — Core Business Logic"]
        DB["db/ (Drizzle ORM)"]
        AILib["ai/ (Provider Config)"]
        RAGLib["rag/ (Pipeline)"]
        FilesLib["files/ (FS Operations)"]
        GitLib["git/ (GitHub)"]
        BotLib["bot/ (Feishu, WeChat)"]
        Hooks["hooks/ (SWR)"]
    end

    Pages --> Components
    APIRoutes --> Lib
    Components --> Hooks
    Hooks --> APIRoutes
```

## Directory Layout

```
vibelab/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Home page (workspace list)
│   │   ├── layout.tsx                # Root layout
│   │   ├── globals.css               # Global styles
│   │   ├── settings/page.tsx         # Settings page
│   │   ├── workspace/[workspaceId]/  # Workspace page (3-panel layout)
│   │   ├── skills/                   # Skills management page
│   │   └── api/                      # API routes
│   │       ├── workspaces/           # Workspace CRUD
│   │       ├── files/                # File operations
│   │       ├── git/                  # Git clone/pull/status
│   │       ├── chat/                 # AI chat (streaming)
│   │       ├── generate/             # Note generation
│   │       ├── notes/                # Note CRUD
│   │       ├── settings/             # Settings management
│   │       ├── skills/               # Skills CRUD
│   │       ├── bot/                  # Bot webhook endpoints
│   │       └── terminal/             # Terminal command execution
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
│   │   ├── preview/                  # File preview (images, PDF, 3D)
│   │   └── terminal/                 # Terminal emulator UI
│   ├── lib/                          # Core business logic
│   │   ├── db/                       # Database (Drizzle ORM + SQLite)
│   │   │   ├── schema.ts            # Database schema definitions
│   │   │   └── index.ts             # Database connection
│   │   ├── ai/                       # AI provider configuration
│   │   │   ├── providers.ts          # OpenAI/Anthropic setup
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
│   │   │   ├── feishu/               # Feishu adapter
│   │   │   └── wechat/               # WeChat adapter
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
├── config/                           # Configuration files
├── docs/                             # Documentation (Sphinx)
├── data/                             # SQLite database (runtime)
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

SQLite database managed by Drizzle ORM. The schema defines tables for workspaces, sources, source chunks, chunk embeddings, chat messages, notes, settings, and skills.

### RAG Pipeline (`src/lib/rag/`)

The Retrieval-Augmented Generation pipeline handles text chunking, vector embedding, storage, and similarity search. Uses pure JavaScript cosine similarity — no external vector database needed.

### Bot Integrations (`src/lib/bot/`)

Implements the `BotAdapter` interface for Feishu (Lark) and WeChat Enterprise. Each adapter handles webhook verification, message parsing, and response formatting.
