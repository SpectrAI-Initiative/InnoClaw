# API Reference

VibeLab provides a set of REST API endpoints served by Next.js API routes. All endpoints are under the `/api/` path.

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

Sends a message and receives a streaming AI response.

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

Supported types: `summary`, `faq`, `brief`, `timeline`.

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

## Error Handling

All API endpoints return standard HTTP status codes:

| Status | Description |
|--------|-------------|
| `200` | Success |
| `400` | Bad request (missing or invalid parameters) |
| `404` | Resource not found |
| `500` | Internal server error |

Error responses include a JSON body:

```json
{
  "error": "Description of the error"
}
```
