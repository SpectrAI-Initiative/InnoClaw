# Notifications & Bot Integrations

InnoClaw supports integration with messaging platforms through bot adapters. This allows users to interact with their workspaces directly from chat applications.

## Supported Channels

| Platform | Status | Webhook Endpoint |
|----------|--------|-----------------|
| **Feishu (Lark)** | Supported | `/api/bot/feishu` |
| **WeChat Enterprise** | Supported | `/api/bot/wechat` |

## Architecture

```{mermaid}
sequenceDiagram
    participant User
    participant Platform as Feishu / WeChat
    participant Webhook as InnoClaw Webhook
    participant Processor as Bot Processor
    participant AI as AI Provider

    User->>Platform: Send message
    Platform->>Webhook: POST webhook event
    Webhook->>Processor: Parse & validate
    Processor->>AI: Process with RAG
    AI->>Processor: AI response
    Processor->>Platform: Reply message
    Platform->>User: Show response
```

## Feishu (Lark) Bot

### Setup

1. Create a Feishu application at the [Feishu Open Platform](https://open.feishu.cn/)
2. Configure the following environment variables:

```ini
FEISHU_BOT_ENABLED=true
FEISHU_APP_ID=cli_your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_VERIFICATION_TOKEN=your_verification_token
FEISHU_ENCRYPT_KEY=your_encrypt_key
FEISHU_PUSH_SECRET=your_push_secret
```

3. Set the webhook URL in your Feishu app configuration:
   ```
   https://your-domain.com/api/bot/feishu
   ```

### Connection Modes

Feishu supports two connection modes:

| Mode | Description |
|------|-------------|
| **HTTP Webhook** | Feishu sends HTTP POST events to your webhook URL. Requires public URL. |
| **WebSocket** | Long-lived connection using `@larksuiteoapi/node-sdk` WSClient. Started automatically in `instrumentation.ts`. No public URL needed. |

### Features

- Receive and respond to text messages
- Download and process file attachments (text files < 100 KB)
- Audio message transcription
- Interactive card responses with real-time agent progress tracking
- Agent mode integration (full tool access)
- Support for encrypted event payloads
- Automatic webhook verification

### Bot Commands

Users can interact with the bot using slash commands:

| Command | Parameters | Description |
|---------|------------|-------------|
| `/workspace` | `<path>` (optional) | Bind a workspace directory, or show the current binding |
| `/mode` | `<agent\|plan\|ask>` | Switch the agent mode for this chat |
| `/status` | — | Show chat state (workspace, mode, history count, chat ID) |
| `/clear` | — | Clear conversation history (preserves workspace and mode) |
| `/help` | — | Show available commands and modes |

### Agent Modes in Feishu

| Mode | Tools Available | Description |
|------|----------------|-------------|
| **agent** | All tools (bash, readFile, writeFile, grep, kubectl, etc.) | Full autonomous execution |
| **plan** | readFile, listDirectory, grep | Read-only analysis and planning |
| **ask** | readFile, listDirectory, grep | Simple question answering |

### Interactive Cards

The Feishu bot uses interactive cards for rich progress display:

- **Progress Card** — Shows real-time agent execution progress with tool call status
- **Final Card** — Displays completed execution with tool call summary and response text
- **Error Card** — Shows agent execution error with details
- **Command Response Card** — Used for slash command responses

### Push API

The Push API enables sending messages from the web application to Feishu chats:

```
POST /api/bot/feishu/push
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

This enables bidirectional communication between the web UI and Feishu. The `chatId` can be obtained via the `/status` command.

### Event Handling

The Feishu bot handles the following event types:

| Event | Description |
|-------|-------------|
| `url_verification` | Initial webhook URL verification |
| `im.message.receive_v1` | Incoming message from a user |

## WeChat Enterprise Bot

### Setup

1. Create an application in the [WeChat Enterprise Admin Console](https://work.weixin.qq.com/)
2. Configure the following environment variables:

```ini
WECHAT_BOT_ENABLED=true
WECHAT_CORP_ID=your_corp_id
WECHAT_CORP_SECRET=your_corp_secret
WECHAT_TOKEN=your_token
WECHAT_ENCODING_AES_KEY=your_aes_key
WECHAT_AGENT_ID=your_agent_id
```

3. Set the webhook URL in your WeChat Enterprise app configuration:
   ```
   https://your-domain.com/api/bot/wechat
   ```

### Features

- Receive and respond to text messages
- Support for both plaintext and encrypted message modes
- Webhook signature verification
- Automatic access token management

### Verification Modes

WeChat Enterprise supports two webhook verification modes:

| Mode | Parameters Used |
|------|----------------|
| **Plaintext** | `msg_signature`, `timestamp`, `nonce` with SHA-1 signature |
| **Encrypted** | AES-256-CBC encrypted message body |

## Common Configuration

### Workspace Binding

Bot integrations process messages using the RAG pipeline from a configured workspace. The bot processor routes incoming messages to the appropriate workspace and AI provider.

For Feishu, use the `/workspace <path>` command to bind a workspace. New chats are automatically bound to the first directory in `WORKSPACE_ROOTS`.

### Security

- All webhook requests are verified using platform-specific signature/token validation
- Encrypted message modes are supported for both platforms
- API keys and secrets are stored server-side only and never exposed to clients

### Notification Payload Format

Bot responses follow each platform's native message format:

**Feishu (Interactive Card):**
```json
{
  "msg_type": "interactive",
  "card": {
    "header": { "title": { "tag": "plain_text", "content": "Agent Response" } },
    "elements": [{ "tag": "markdown", "content": "AI response content" }]
  }
}
```

**Feishu (Text):**
```json
{
  "msg_type": "text",
  "content": {
    "text": "AI response based on your workspace files"
  }
}
```

**WeChat Enterprise:**
```xml
<xml>
  <MsgType>text</MsgType>
  <Content>AI response based on your workspace files</Content>
</xml>
```
