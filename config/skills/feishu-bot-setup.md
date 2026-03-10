---
name: Feishu Bot Setup Guide
description: Step-by-step guide for connecting a Feishu (Lark) bot to NotebookLM using persistent WebSocket connection mode. Covers app creation, credentials, event subscription, permissions, and troubleshooting the "App connection info not detected" error.
allowed-tools: Bash(cat:*), Bash(echo:*), Bash(grep:*), readFile, writeFile, listDirectory
---

# Feishu (Lark) Bot Connection Skill

You are an expert assistant for setting up and troubleshooting Feishu (Lark) bot integration with NotebookLM. Follow this guide to help users configure the persistent WebSocket connection.

## Prerequisites

- A Feishu (飞书) organization account
- Access to the [Feishu Developer Console](https://open.feishu.cn/app)
- NotebookLM project cloned and dependencies installed (`npm install`)

## Step 1: Create a Feishu Application

1. Log in to the [Feishu Developer Console](https://open.feishu.cn/app)
2. Click **"Create Enterprise Self-Built App"** (创建企业自建应用)
3. Fill in the app name (e.g., "NotebookLM Agent") and description
4. Complete the creation

## Step 2: Obtain App Credentials

Navigate to the newly created app → **Credentials & Basic Info** (凭证与基础信息) page.

Record the following values:

| Field | Environment Variable |
|-------|---------------------|
| App ID | `FEISHU_APP_ID` |
| App Secret | `FEISHU_APP_SECRET` |

## Step 3: Configure Event Subscription

1. Go to app → **Events & Callbacks** (事件与回调) → **Event Configuration** (事件配置)
2. Click **"Edit"** to add the following event:
   - `im.message.receive_v1` — Receive messages
3. Under **Encryption Strategy** (加密策略), record:

| Field | Environment Variable |
|-------|---------------------|
| Verification Token | `FEISHU_VERIFICATION_TOKEN` |
| Encrypt Key | `FEISHU_ENCRYPT_KEY` |

## Step 4: Enable Persistent Connection

1. On the **Events & Callbacks** → **Event Configuration** page
2. Select **"Use persistent connection to receive events"** (使用长连接接收事件) — NOT the Webhook URL method
3. **IMPORTANT**: You must start the NotebookLM service FIRST and confirm the connection before saving this configuration in the Feishu console

### Connection Verification

After starting the service (`npm run dev`), watch the terminal logs for the actual connection status:

```
[feishu-ws] WSClient starting...
[feishu-ws] WSClient start() initiated — waiting for connection...
[feishu-ws] ✅ WSClient connected successfully — Feishu Developer Console should now detect the connection.
```

**Only after seeing the ✅ indicator**, go back to the Feishu Developer Console and save the persistent connection configuration.

### Common Pitfall: "App connection info not detected"

If the Feishu console shows: `未检测到应用连接信息，请确保长连接建立成功后再保存配置` (App connection info not detected)

The `@larksuiteoapi/node-sdk` `WSClient.start()` resolves its promise **before** the WebSocket is actually connected. Look for the ✅ or ❌ indicators in the logs — NOT just the "start() initiated" message.

Possible causes and fixes:
1. **Wrong credentials** — Double-check `FEISHU_APP_ID` and `FEISHU_APP_SECRET` match the Developer Console exactly
2. **Service not started** — Run `npm run dev` and wait for ✅ before saving config
3. **Bot not enabled** — Ensure `FEISHU_BOT_ENABLED=true` in `.env.local`
4. **Network issues** — The service must be able to reach `open.feishu.cn` over HTTPS

For detailed SDK logs, set `FEISHU_LOG_LEVEL=debug` in `.env.local`.

## Step 5: Enable Bot Capability

1. Go to app → **App Capabilities** (应用能力) → **Bot** (机器人)
2. Enable the bot capability

## Step 6: Configure Permissions

Go to app → **Permission Management** (权限管理) and enable these permissions:

| Permission | Description |
|-----------|-------------|
| `im:message` | Read and send messages |
| `im:message:send_as_bot` | Send messages as bot identity |
| `im:resource` | Access message resource files |
| `im:chat` | Access group chat info |

## Step 7: Publish the Application

1. Go to app → **Version Management & Release** (版本管理与发布)
2. Create a version and submit for review
3. After admin approval in the [Feishu Admin Console](https://feishu.cn/admin), the app is ready

## Step 8: Configure Environment Variables

Add the following to `.env.local`:

```env
# Feishu (Lark) Bot configuration
FEISHU_BOT_ENABLED=true
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_VERIFICATION_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_ENCRYPT_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: SDK log verbosity (error, warn, info, debug, trace)
# FEISHU_LOG_LEVEL=info
```

**Note**: Do NOT set `FEISHU_PUSH_SECRET` when using persistent connection mode. That variable is only needed for the Webhook callback mode.

## Step 9: Start and Verify

```bash
npm run dev
```

Watch for the ✅ connection success indicator in the terminal logs, then open a chat with the bot in Feishu and send a message.

## Bot Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help information |
| `/workspace <path>` | Bind a workspace directory (must be under `WORKSPACE_ROOTS`) |
| `/workspace` | Show current workspace binding |
| `/mode <agent\|plan\|ask>` | Switch Agent mode |
| `/status` | Show current chat status (including Chat ID) |
| `/clear` | Clear conversation history |

### Agent Modes

| Mode | Access Level | Use Case |
|------|-------------|----------|
| `agent` | Full tool access (bash, readFile, writeFile, grep, etc.) | Code editing, running commands |
| `plan` | Read-only (readFile, listDirectory, grep) | Code analysis, planning |
| `ask` | Read-only | Asking questions about the codebase |

## Push API (Web → Feishu)

Send messages from your web application to Feishu chats:

```bash
# Send text message
curl -X POST http://localhost:3000/api/bot/feishu/push \
  -H "Content-Type: application/json" \
  -d '{"chatId": "oc_xxx", "content": "Hello from web!", "type": "text"}'

# Send card message
curl -X POST http://localhost:3000/api/bot/feishu/push \
  -H "Content-Type: application/json" \
  -d '{"chatId": "oc_xxx", "title": "Task Complete", "content": "Build succeeded!"}'
```

Use `/status` in a Feishu chat to get the `chatId`.

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FEISHU_BOT_ENABLED` | Yes | `false` | Enable Feishu bot integration |
| `FEISHU_APP_ID` | Yes | — | Application ID from Developer Console |
| `FEISHU_APP_SECRET` | Yes | — | Application Secret |
| `FEISHU_VERIFICATION_TOKEN` | Yes | — | Token from event subscription config |
| `FEISHU_ENCRYPT_KEY` | No | — | Encryption key for encrypted event payloads |
| `FEISHU_LOG_LEVEL` | No | `info` | SDK log level: error, warn, info, debug, trace |
| `WORKSPACE_ROOTS` | No | — | Workspace paths for Agent file/tool access |
