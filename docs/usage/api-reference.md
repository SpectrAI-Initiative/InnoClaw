# API Reference

InnoClaw provides a set of REST API endpoints served by Next.js API routes. All endpoints are under the `/api/` path.

## Workspaces

### List Workspaces

```
GET /api/workspaces
```

Returns all workspaces.

**Response:**

```json
[
  {
    "id": "workspace-uuid",
    "name": "my-project",
    "rootPath": "/data/research/my-project",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

### Create Workspace

```
POST /api/workspaces
```

**Request Body:**

```json
{
  "path": "/data/research/my-project"
}
```

### Delete Workspace

```
DELETE /api/workspaces/[workspaceId]
```

Removes the workspace record from the database. Files on disk are **not** deleted.

## Files

### Browse Directory

```
GET /api/files/browse?workspaceId={id}&path={relativePath}
```

Returns the file listing for a directory within a workspace.

### Read File

```
GET /api/files/read?workspaceId={id}&path={relativePath}
```

Returns the content of a file.

### Write File

```
POST /api/files/write
```

**Request Body:**

```json
{
  "workspaceId": "workspace-uuid",
  "path": "relative/path/to/file.txt",
  "content": "file content here"
}
```

### Upload File

```
POST /api/files/upload
```

Accepts `multipart/form-data` with `file`, `workspaceId`, and `path` fields.

### Delete File

```
DELETE /api/files/delete
```

**Request Body:**

```json
{
  "workspaceId": "workspace-uuid",
  "path": "relative/path/to/file.txt"
}
```

### Rename File

```
POST /api/files/rename
```

**Request Body:**

```json
{
  "workspaceId": "workspace-uuid",
  "oldPath": "old/name.txt",
  "newPath": "new/name.txt"
}
```

### Create Directory

```
POST /api/files/mkdir
```

**Request Body:**

```json
{
  "workspaceId": "workspace-uuid",
  "path": "relative/path/to/new-dir"
}
```

## Chat

### Send Message (Streaming)

```
POST /api/chat
```

Sends a message and receives a streaming AI response via RAG.

**Request Body:**

```json
{
  "messages": [
    { "role": "user", "content": "What is this project about?" }
  ],
  "workspaceId": "workspace-uuid"
}
```

**Response:** Server-Sent Events (SSE) stream with AI response tokens.

## Agent

### Agent Chat (Streaming)

```
POST /api/agent
```

Sends a message to the autonomous AI agent with tool-calling capability.

**Request Body:**

```json
{
  "messages": [],
  "workspaceId": "workspace-uuid",
  "cwd": "/data/research/my-project",
  "skillId": "optional-skill-id",
  "paramValues": {},
  "mode": "agent"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | `UIMessage[]` | Yes | Chat message history |
| `workspaceId` | `string` | Yes | Workspace identifier |
| `cwd` | `string` | Yes | Current working directory for tool execution |
| `skillId` | `string` | No | Skill ID to use for this request |
| `paramValues` | `object` | No | Skill parameter values |
| `mode` | `string` | No | `"agent"`, `"plan"`, or `"ask"` (default: `"agent"`) |

**Response:** Streaming response with tool calls and text.

### Summarize Agent Conversation

```
POST /api/agent/summarize
```

Summarizes agent conversation history and optionally saves as a note.

**Request Body:**

```json
{
  "workspaceId": "workspace-uuid",
  "messages": [],
  "trigger": "clear",
  "preview": false,
  "locale": "en"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `workspaceId` | `string` | Yes | Workspace identifier |
| `messages` | `array` | Yes | Message array with parts and roles |
| `trigger` | `string` | No | `"clear"` or `"overflow"` |
| `preview` | `boolean` | No | If `true`, returns summary without saving |
| `locale` | `string` | No | `"en"` or `"zh"` (default: `"en"`) |

## Notes

### List Notes

```
GET /api/notes?workspaceId={id}
```

### Create Note

```
POST /api/notes
```

**Request Body:**

```json
{
  "workspaceId": "workspace-uuid",
  "title": "My Note",
  "content": "Note content here"
}
```

### Update Note

```
PUT /api/notes/[noteId]
```

### Delete Note

```
DELETE /api/notes/[noteId]
```

## Generate

### Generate Note Content

```
POST /api/generate
```

**Request Body:**

```json
{
  "workspaceId": "workspace-uuid",
  "type": "summary"
}
```

Supported types: `summary`, `faq`, `brief`, `timeline`, `memory`, `daily_report`, `weekly_report`.

## Daily Report

### Generate Daily Report

```
POST /api/daily-report
```

Generates a daily activity report for a workspace.

**Request Body:**

```json
{
  "workspaceId": "workspace-uuid",
  "date": "2025-03-01",
  "locale": "en"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `workspaceId` | `string` | Yes | Workspace identifier |
| `date` | `string` | No | YYYY-MM-DD format (defaults to today) |
| `locale` | `string` | No | `"en"` or `"zh"` (default: `"en"`) |

**Response:** Returns note object (201) or `{ skipped: true, reason: "..." }` (200) if no activities found.

## Weekly Report

### Generate Weekly Report

```
POST /api/weekly-report
```

Generates a weekly activity report for a workspace.

**Request Body:**

```json
{
  "workspaceId": "workspace-uuid",
  "locale": "en"
}
```

**Response:** Returns note object (201) or `{ skipped: true, reason: "..." }` (200) if no activities found.

## Datasets

### List Datasets

```
GET /api/datasets
```

Returns all datasets ordered by creation date (newest first).

### Create Dataset (Start Download)

```
POST /api/datasets
```

Creates a dataset record and initiates background download.

**Request Body:**

```json
{
  "repoId": "username/dataset-name",
  "repoType": "dataset",
  "revision": "main",
  "name": "My Dataset",
  "allowPatterns": ["*.parquet"],
  "ignorePatterns": ["*.bin"],
  "source": "huggingface"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `repoId` | `string` | Yes | HuggingFace or ModelScope repository ID |
| `repoType` | `string` | No | `"dataset"`, `"model"`, or `"space"` (default: `"dataset"`) |
| `revision` | `string` | No | Specific branch or tag |
| `name` | `string` | No | Display name |
| `allowPatterns` | `string[]` | No | File glob patterns to include |
| `ignorePatterns` | `string[]` | No | File glob patterns to exclude |
| `source` | `string` | No | `"huggingface"` or `"modelscope"` (default: `"huggingface"`) |

### Get Dataset

```
GET /api/datasets/[datasetId]
```

Returns complete dataset information including parsed manifest and stats.

### Delete Dataset

```
DELETE /api/datasets/[datasetId]?deleteFiles=true
```

Removes dataset from database. Set `deleteFiles=true` to also delete local files.

### Get Download Status

```
GET /api/datasets/[datasetId]/status
```

Returns live download progress.

**Response:**

```json
{
  "datasetId": "dataset-uuid",
  "status": "downloading",
  "progress": 45,
  "phase": "downloading",
  "downloadedBytes": 1048576,
  "totalBytes": 2097152,
  "downloadedFiles": 3,
  "totalFiles": 10
}
```

### Pause Download

```
POST /api/datasets/[datasetId]/pause
```

### Resume / Retry Download

```
POST /api/datasets/[datasetId]/retry
```

### Cancel Download

```
POST /api/datasets/[datasetId]/cancel
```

### Refresh Manifest

```
POST /api/datasets/[datasetId]/refresh
```

Recalculates manifest and stats from disk for ready datasets.

### Preview Dataset

```
GET /api/datasets/[datasetId]/preview?split=default&n=20
```

Returns sample data from ready datasets. `n` is capped at 1000.

### Manage Workspace Links

```
GET /api/datasets/[datasetId]/workspaces
POST /api/datasets/[datasetId]/workspaces
DELETE /api/datasets/[datasetId]/workspaces?workspaceId={id}
```

Link/unlink datasets to workspaces (many-to-many relationship).

### Import Local Dataset

```
POST /api/datasets/import-local
```

**Request Body:**

```json
{
  "localPath": "/data/my-local-dataset",
  "name": "My Local Dataset"
}
```

### Get HuggingFace Repo Info

```
GET /api/datasets/repo-info?repoId={repoId}&repoType=dataset
```

### Get ModelScope Repo Info

```
GET /api/datasets/modelscope-info?repoId={repoId}&repoType=dataset
```

## Paper Study

### Search Papers

```
POST /api/paper-study/search
```

**Request Body:**

```json
{
  "keywords": ["transformer", "attention"],
  "maxResults": 10,
  "dateFrom": "2025-01-01",
  "dateTo": "2025-03-01",
  "sources": ["arxiv", "huggingface"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `keywords` | `string[]` | Yes | At least one keyword required |
| `maxResults` | `number` | No | Max 30 (default: 10) |
| `dateFrom` | `string` | No | Start date filter |
| `dateTo` | `string` | No | End date filter |
| `sources` | `string[]` | No | `"arxiv"` and/or `"huggingface"` (default: both) |

## Scheduled Tasks

### List Scheduled Tasks

```
GET /api/scheduled-tasks
```

### Create Scheduled Task

```
POST /api/scheduled-tasks
```

**Request Body:**

```json
{
  "name": "Daily Git Sync",
  "taskType": "git_sync",
  "schedule": "0 0 * * *",
  "workspaceId": "workspace-uuid",
  "isEnabled": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Task display name |
| `taskType` | `string` | Yes | `"daily_report"`, `"weekly_report"`, `"git_sync"`, `"source_sync"`, or `"custom"` |
| `schedule` | `string` | Yes | Valid cron expression (e.g. `"0 0 * * *"`) |
| `workspaceId` | `string` | No | Workspace to bind (null = global) |
| `config` | `object` | No | Task-specific JSON configuration |
| `isEnabled` | `boolean` | No | Default: `true` |

### Get / Update / Delete Scheduled Task

```
GET    /api/scheduled-tasks/[taskId]
PUT    /api/scheduled-tasks/[taskId]
DELETE /api/scheduled-tasks/[taskId]
```

## Terminal

### Execute Command

```
POST /api/terminal/exec
```

Executes a shell command in the workspace directory.

**Request Body:**

```json
{
  "command": "ls -la",
  "cwd": "/data/research/my-project"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | `string` | Yes | Shell command (max 4096 chars) |
| `cwd` | `string` | Yes | Working directory (validated against allowed roots) |

**Response:**

```json
{
  "stdout": "...",
  "stderr": "...",
  "exitCode": 0,
  "cwd": "/data/research/my-project"
}
```

Timeout: 30 seconds. Max output: 1MB.

## Cluster

### Get Cluster Status

```
GET /api/cluster/status
```

Returns Kubernetes cluster overview (nodes, jobs, pods). Returns `{ configured: false }` if `KUBECONFIG_PATH` is not set.

**Response:**

```json
{
  "configured": true,
  "nodes": [{ "name": "...", "ready": true, "roles": "...", "cpu": "...", "memory": "...", "gpu": "..." }],
  "jobs": [{ "name": "...", "namespace": "...", "active": 1, "succeeded": 0, "failed": 0 }],
  "pods": [{ "name": "...", "namespace": "...", "phase": "Running", "nodeName": "..." }],
  "timestamp": "2025-03-01T00:00:00.000Z"
}
```

### Get Cluster Operations

```
GET /api/cluster/operations?workspaceId={id}&limit=50&offset=0
```

Returns paginated cluster operation audit log. `limit` max: 200.

## Models

### List Available Models

```
GET /api/models?provider=openai
```

Fetches available models from the configured provider's API.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `provider` | `string` | No | `"openai"` or `"anthropic"` (default: `"openai"`) |

**Response:**

```json
{
  "models": [
    { "id": "gpt-4o", "name": "gpt-4o" }
  ]
}
```

## System

### Network Speed

```
GET /api/system/network
```

Returns current network speed measurement.

## Feishu Push

### Push Message to Feishu

```
POST /api/bot/feishu/push
```

Pushes a message or interactive card to a Feishu chat.

**Headers:**

```
Authorization: Bearer <FEISHU_PUSH_SECRET>
```

**Request Body:**

```json
{
  "chatId": "oc_xxxxxxxxxxxx",
  "title": "Agent Message",
  "content": "Message content here",
  "type": "card"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chatId` | `string` | Yes | Feishu chat/group ID |
| `title` | `string` | No | Card title (default: `"Agent Message"`) |
| `content` | `string` | Yes | Message content |
| `type` | `string` | No | `"text"` or `"card"` (default: `"card"`) |

## Git

### Clone Repository

```
POST /api/git/clone
```

**Request Body:**

```json
{
  "url": "https://github.com/user/repo.git",
  "rootPath": "/data/research"
}
```

### Pull Repository

```
POST /api/git/pull
```

**Request Body:**

```json
{
  "workspaceId": "workspace-uuid"
}
```

### Get Git Status

```
GET /api/git/status?workspaceId={id}
```

## Settings

### Get Settings

```
GET /api/settings
```

### Update Settings

```
PUT /api/settings
```

## Skills

### List Skills

```
GET /api/skills?workspaceId={id}
```

### Create Skill

```
POST /api/skills
```

### Import Skill

```
POST /api/skills/import
```

### Export Skill

```
GET /api/skills/[skillId]/export
```

### Update / Delete Skill

```
PUT    /api/skills/[skillId]
DELETE /api/skills/[skillId]
```

## Error Handling

All API endpoints return standard HTTP status codes:

| Status | Description |
|--------|-------------|
| `200` | Success |
| `201` | Created (new resource) |
| `400` | Bad request (missing or invalid parameters) |
| `401` | Unauthorized (invalid authentication) |
| `404` | Resource not found |
| `500` | Internal server error |
| `503` | Service unavailable (AI not configured) |

Error responses include a JSON body:

```json
{
  "error": "Description of the error"
}
```
