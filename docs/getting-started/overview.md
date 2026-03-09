# Overview

## What is VibeLab?

VibeLab is an AI-powered research assistant web application similar to Google NotebookLM. It lets you open server-side folders as **workspaces**, browse and manage files, and chat with AI grounded in your workspace files via **RAG** (Retrieval-Augmented Generation).

## Key Features

- **Workspace Management** — Map server folders as persistent workspaces
- **File Browser** — Tree view with upload, create, edit, rename, and delete
- **GitHub Integration** — Clone and pull GitHub repositories (including private ones)
- **RAG Chat** — AI answers questions based on workspace file content with source citations
- **Note Generation** — Auto-generate summaries, FAQs, briefs, and timelines
- **Multi-LLM Support** — Switch between OpenAI GPT and Anthropic Claude
- **Bilingual UI** — Chinese / English toggle
- **Dark Mode** — Light and dark theme support
- **Bot Integrations** — Feishu (Lark) and WeChat Enterprise bot support
- **Agent Mode** — Autonomous AI agent with tool usage (bash, file operations, kubectl)
- **Skills** — Reusable prompt templates for common tasks

## Architecture

The following diagram shows the high-level architecture of VibeLab:

```{mermaid}
graph TB
    subgraph Client["Browser Client"]
        UI["Next.js App Router<br/>(React + Tailwind CSS)"]
        I18N["next-intl<br/>(EN / ZH)"]
        Theme["next-themes<br/>(Light / Dark)"]
    end

    subgraph Server["Next.js Server"]
        API["API Routes"]
        RAG["RAG Pipeline"]
        DB["SQLite + Drizzle ORM"]
        FS["File System"]
        Git["Git Operations"]
    end

    subgraph AI["AI Providers"]
        OpenAI["OpenAI API"]
        Anthropic["Anthropic API"]
        Embed["Embedding API"]
    end

    subgraph Bots["Bot Integrations"]
        Feishu["Feishu / Lark"]
        WeChat["WeChat Enterprise"]
    end

    UI --> API
    API --> RAG
    API --> DB
    API --> FS
    API --> Git
    RAG --> Embed
    RAG --> DB
    API --> OpenAI
    API --> Anthropic
    Bots --> API
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS 4 + shadcn/ui + Radix UI |
| AI | Vercel AI SDK 6 + OpenAI + Anthropic |
| Database | SQLite (better-sqlite3 + Drizzle ORM) |
| Vector Search | Pure JS cosine similarity (no extensions needed) |
| i18n | next-intl (Chinese / English) |
| Theme | next-themes |

## RAG Pipeline

The core feature of VibeLab is RAG-based AI chat. The pipeline works in three stages:

```{mermaid}
flowchart LR
    subgraph Index["Indexing (Sync)"]
        Files["Workspace Files"] --> Extract["Text Extraction"]
        Extract --> Chunk["Text Chunking"]
        Chunk --> Embedding["Vector Embedding"]
        Embedding --> Store["SQLite Storage"]
    end

    subgraph Query["Query (Chat)"]
        Question["User Question"] --> QEmbed["Question Embedding"]
        QEmbed --> Search["Cosine Similarity Search"]
        Store --> Search
        Search --> TopK["Top-K Relevant Chunks"]
    end

    subgraph Generate["Generation"]
        TopK --> Prompt["System Prompt + Chunks + Question"]
        Prompt --> LLM["LLM (GPT / Claude)"]
        LLM --> Answer["Streaming Answer with Source Citations"]
    end
```

1. **Indexing** — When the user clicks "Sync", files are scanned, text is extracted, chunked, and embedded into vectors stored in SQLite.
2. **Retrieval** — When the user asks a question, the question is embedded and compared against all stored vectors using cosine similarity to find the top 8 most relevant chunks.
3. **Generation** — The relevant chunks and the user's question are sent to the LLM, which generates a streaming answer with source citations.
