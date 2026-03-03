# Core Features

NotebookLM provides a rich set of features for AI-powered research and file management.

## Workspace Management

Workspaces map server-side folders into the application. Each workspace is a persistent container for files, chat history, and notes.

- **Create** workspaces from any allowed root directory (configured via `WORKSPACE_ROOTS`)
- **Open** existing workspaces from the home page
- **Delete** workspaces (removes only the database record; files on disk are preserved)
- **GitHub Clone** — Clone a GitHub repository directly as a new workspace

## File Browser

The file browser provides full file management within a workspace:

- **Tree View** — Hierarchical directory browsing with expand/collapse
- **Upload** — Drag-and-drop or click to upload files
- **Create** — New files and folders
- **Edit** — Open files in the built-in editor
- **Rename / Delete** — Right-click context menu
- **Preview** — Preview images, PDFs, 3D models (STL, OBJ, GLTF, etc.), and more
- **Sync** — Trigger RAG indexing to enable AI-powered search

## RAG Chat

The AI chat interface uses Retrieval-Augmented Generation to answer questions based on your workspace files:

1. **Sync** your workspace to index files into the vector store
2. **Ask questions** in the chat panel
3. **Receive answers** with `[Source: filename]` citations pointing to the relevant files
4. **Multi-turn conversations** — Context is maintained across messages

### Supported File Types for RAG

The following file types are supported for text extraction and indexing:

| Category | Extensions |
|----------|------------|
| Documents | `.pdf`, `.txt`, `.md`, `.html` |
| Data | `.json`, `.csv` |
| Code | `.js`, `.ts`, `.py`, `.java`, `.go`, `.rs`, `.cpp`, `.c`, `.rb`, `.php`, and more |

## Note Generation

Automatically generate structured notes from your workspace content:

| Type | Description |
|------|-------------|
| **Summary** | Concise overview of key points |
| **FAQ** | Frequently asked questions with answers |
| **Brief** | Executive-style briefing document |
| **Timeline** | Chronological sequence of events |

Notes can also be created and edited manually.

## Agent Mode

The Agent mode provides an autonomous AI assistant with access to system tools:

- **Bash** — Execute shell commands
- **File Operations** — Read, write, and list directory contents
- **Grep** — Search file contents with regular expressions
- **kubectl** — Kubernetes cluster management (when configured)

Agent mode is useful for tasks that require interacting with the file system or running commands.

## Skills

Skills are reusable prompt templates for common tasks:

- Create custom skills with specific instructions
- Configure which tools a skill can access
- Skills can be triggered from the chat interface
- Built-in skills for common operations

## Multi-LLM Support

Switch between different AI providers and models:

| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-4o, GPT-4, GPT-3.5, and compatible models |
| **Anthropic** | Claude 3.5, Claude 3, and compatible models |

Custom endpoints are supported via `OPENAI_BASE_URL` and `ANTHROPIC_BASE_URL` for third-party providers.

## Bilingual UI

The user interface supports both Chinese and English:

- Click the **language toggle** in the top navigation bar
- All UI elements, labels, and messages are translated
- Language preference is persisted across sessions

## Dark Mode

Toggle between light and dark themes:

- Click the **theme toggle** in the top navigation bar
- Applies to all panels including the file browser, chat, and editor
- Theme preference is persisted across sessions
