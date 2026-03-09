# Notifications & Bot Integrations

VibeLab supports integration with messaging platforms through bot adapters. This allows users to interact with their workspaces directly from chat applications.

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
    participant Webhook as VibeLab Webhook
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
```

3. Set the webhook URL in your Feishu app configuration:
   ```
   https://your-domain.com/api/bot/feishu
   ```

### Features

- Receive and respond to text messages
- Download and process file attachments
- Support for encrypted event payloads
- Automatic webhook verification

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

### Security

- All webhook requests are verified using platform-specific signature/token validation
- Encrypted message modes are supported for both platforms
- API keys and secrets are stored server-side only and never exposed to clients

### Notification Payload Format

Bot responses follow each platform's native message format:

**Feishu:**
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
