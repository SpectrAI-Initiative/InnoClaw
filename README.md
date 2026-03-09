# InnoClaw

一个可自托管的 AI 研究助手，灵感来自 Google NotebookLM。将服务器文件夹作为工作空间，基于 RAG 与 AI 对话，内置 206 个科学技能。

A self-hostable AI research assistant inspired by Google NotebookLM. Turn server-side folders into workspaces, chat with AI grounded in your documents via RAG, and leverage 206 built-in scientific skills.

📖 **[完整文档 / Full Documentation](https://zjowowen.github.io/InnoClaw/)** (English & 简体中文)

---

## 概览 / Overview

**核心亮点 / Key Highlights:**
- 🗂️ **工作空间 + 文件管理** — 映射服务器文件夹，支持浏览、上传、编辑
- 🤖 **RAG 增强对话** — AI 基于文档内容回答问题，附带来源引用
- 📝 **智能笔记生成** — 自动生成摘要、FAQ、简报、时间线
- 🔀 **多模型 & 多语言** — OpenAI / Anthropic / Gemini，中英双语，暗色模式
- 💬 **飞书机器人** — WebSocket 长连接，Agent 工具调用，交互卡片实时更新
- 🧠 **上下文管理** — MAX 模式自动摘要防止上下文溢出
- 🔬 **206 个 SCP 科学技能** — 覆盖药物发现、基因组学、蛋白质工程等 8 大领域
- 🛠️ **Skills 系统** — 通过导入 Skills 快速配置飞书机器人、SCP 科学技能等高级功能

**适用人群：** 研究人员 · 开发者 · 自托管爱好者 · 学生和教育工作者

---

## 快速开始 / Quick Start

> **前置要求：** Node.js >=20.9.0, npm, Git

### 方式一：Claude Code 自动安装（推荐） / Auto Setup via Claude Code (Recommended)

如果你已安装 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)，只需 3 条命令即可完成全部配置：

If you have [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed, just 3 commands to get everything configured:

```bash
git clone https://github.com/zjowowen/InnoClaw.git
cd InnoClaw
claude /setup
```

`/setup` 会交互式引导你完成：依赖安装 → 环境配置（工作空间路径、AI API Key 等）→ 数据库初始化 → 启动服务。

The `/setup` skill interactively guides you through: dependency installation → environment configuration (workspace paths, AI API keys, etc.) → database initialization → server startup.

### 方式二：手动安装 / Manual Setup

#### 第 1 步：克隆并安装 / Clone & Install

```bash
git clone https://github.com/zjowowen/InnoClaw.git
cd InnoClaw
npm install
```

#### 第 2 步：最小配置 / Minimal Configuration

```bash
cp .env.example .env.local
```

编辑 `.env.local`，只需设置两项即可启动：

```env
# [必填] 工作空间根目录（逗号分隔的绝对路径，目录必须已存在）
WORKSPACE_ROOTS=/path/to/your/research,/path/to/your/projects

# [推荐] 至少配置一个 AI API Key（不配置也能启动，但 AI 功能不可用）
OPENAI_API_KEY=sk-xxx
# 或 ANTHROPIC_API_KEY=sk-ant-xxx
# 或 GEMINI_API_KEY=xxx
```

> 完整环境变量列表见 [环境变量参考](#环境变量参考--environment-variables)。

#### 第 3 步：初始化并启动 / Init & Start

```bash
# 创建数据目录 + 初始化数据库
mkdir -p ./data && npx drizzle-kit migrate

# 启动开发服务器
npm run dev
```

打开 **http://localhost:3000** 即可使用。如看到工作空间列表页面，说明安装成功。

---

## 通过 Skills 配置高级功能 / Setup Advanced Features via Skills

InnoClaw 的 **Skills 系统**是配置和扩展高级功能的首选方式。启动应用后，访问 `/skills` 页面即可导入和管理技能。

The **Skills system** is the preferred way to configure and extend advanced features. After starting the app, visit `/skills` to import and manage skills.

### 导入方式 / How to Import Skills

**方式一：Web UI（推荐）**
1. 访问 `/skills` 页面 → 点击 **"导入技能"**
2. 输入 GitHub 仓库 URL 或 JSON URL → 确认导入
3. 系统自动发现并批量导入所有技能

**方式二：API**
```bash
curl -X POST http://localhost:3000/api/skills/import \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/InternScience/scp/tree/main"}'
```

**方式三：本地脚本**
```bash
node scripts/import-local-skills.mjs
```

---

### 配置 SCP 科学技能 / SCP Scientific Skills

[SCP (Science Context Protocol)](https://github.com/InternScience/scp) 提供 **206 个预置科学技能**，通过 [Intern-Discovery 平台](https://scphub.intern-ai.org.cn/) 连接到真实的科学计算服务端点。

| 领域 | 技能数 | 代表性能力 |
|------|:------:|------|
| 💊 药物发现与药理学 | 71 | 靶点识别、ADMET 预测、虚拟筛选、分子对接 |
| 🧬 基因组学与遗传分析 | 41 | 变异致病性评估、癌症基因组学、群体遗传学 |
| 🧬 蛋白质科学与工程 | 38 | 结构预测（ESMFold/AlphaFold）、结合位点分析 |
| 🧪 化学与分子科学 | 24 | 结构分析、分子指纹、构效关系 |
| ⚙️ 物理与工程计算 | 18 | 电路分析、热力学、光学 |
| 🔬 实验自动化与文献挖掘 | 7 | 实验方案生成、PubMed 搜索 |
| 🌍 地球与环境科学 | 5 | 大气科学、海洋学 |

**配置步骤：**

1. 在 [SCP Platform](https://scphub.intern-ai.org.cn/) 注册并获取 API Key
2. 在 `.env.local` 中添加 `SCP_HUB_API_KEY=sk-your-key`，重启服务
3. 访问 `/skills` → 导入 `https://github.com/InternScience/scp/tree/main`

导入完成后，在 Agent 面板用自然语言描述研究目标即可自动调用对应技能：

```
> 识别肺癌的潜在药物靶点，找到 TOP 靶点后从 ChEMBL 获取详细信息
> 分析 p53 蛋白的结构（PDB: 1TUP），计算结构几何参数并评估质量指标
```

---

### 配置飞书机器人 / Feishu Bot Setup

飞书机器人通过 WebSocket 长连接实时接收消息，让用户在飞书中直接与 Agent 交互。

**第 1 步：创建飞书应用**

1. 登录 [飞书开发者后台](https://open.feishu.cn/app) → 创建企业自建应用
2. 记录 **App ID** 和 **App Secret**（凭证与基础信息页面）
3. **应用能力** → 启用 **机器人**
4. **权限管理** → 开通：`im:message`, `im:message:send_as_bot`, `im:resource`, `im:chat`

> **注意：** 此时**不要**配置长连接和事件回调，需要先建立连接后才能保存这些配置。

**第 2 步：发布应用**

**版本管理与发布** → 创建版本并提交审核，等待审核通过。

**第 3 步：配置环境变量并建立长连接**

在 `.env.local` 中添加：

```env
FEISHU_BOT_ENABLED=true
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

启动（或重启）服务，确认终端输出：

```
[feishu-ws] WSClient connected successfully
```

**第 4 步：配置长连接和事件回调**

回到飞书开发者后台：

1. **事件与回调** → 选择 **"使用长连接接收事件"** 并保存
2. **事件与回调** → 添加事件 `im.message.receive_v1`
3. 在 **事件与回调** → **加密策略** 中记录 **Verification Token** 和 **Encrypt Key**
4. **版本管理与发布** → 创建新版本并重新发布

**第 5 步：补充环境变量并验证**

将获取到的值补充到 `.env.local`：

```env
FEISHU_VERIFICATION_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_ENCRYPT_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# 可选：用于 Web → 飞书推送 API 的自定义密钥
# FEISHU_PUSH_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

重启服务，在飞书中搜索并打开机器人对话，发送消息验证通讯正常。

**飞书机器人命令：**

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/workspace <path>` | 绑定/查看工作空间目录 |
| `/mode <agent\|plan\|ask>` | 切换 Agent 模式（完整/只读/问答） |
| `/status` | 查看当前聊天状态，获取 Chat ID |
| `/clear` | 清空对话历史 |

**Web → 飞书推送 API：**

```bash
curl -X POST http://localhost:3000/api/bot/feishu/push \
  -H "Content-Type: application/json" \
  -d '{"chatId": "oc_xxx", "content": "Hello!", "type": "text"}'
```

---

### 配置 K8s 集群任务 / K8s Job Submission

Agent 面板支持向 Kubernetes 集群提交 GPU 计算任务。

1. 安装 `kubectl`（[官方安装指南](https://kubernetes.io/docs/tasks/tools/)）
2. 在 `.env.local` 中配置 `KUBECONFIG_PATH=/path/to/your/kubeconfig`
3. 重启服务后，在 Agent 面板中即可使用 `submitK8sJob` 和 `kubectl` 工具

---

## 功能 / Features

- **工作空间管理** — 映射服务器文件夹，持久化存储
- **文件浏览器** — 树形目录、上传、新建、编辑、Markdown 渲染
- **GitHub 集成** — 克隆/拉取仓库（支持私有仓库）
- **RAG 对话** — AI 基于文件内容回答问题，带来源引用
- **笔记生成** — 摘要、FAQ、简报、时间线
- **多 LLM** — OpenAI GPT / Anthropic Claude / Google Gemini
- **中英双语 + 暗色模式**
- **上下文溢出保护** — MAX 模式自动摘要，可选保守/标准/扩展策略
- **飞书机器人** — WebSocket 长连接，Agent 工具调用，交互卡片
- **SCP 科学技能** — 206 个技能，覆盖 8 大科学领域
- **Skills 系统** — 导入/导出/自定义技能，通过 `/skills` 页面管理

---

## 使用指南 / Usage Guide

### 1. 创建工作空间
访问首页 → **"打开工作空间"** → 选择目录 → 确认。也可通过 **"从 GitHub 克隆"** 导入仓库。

### 2. 管理文件
左侧文件浏览器：展开目录、上传、新建、右键操作。点击 **"同步"** 触发 RAG 索引。

### 3. AI 对话
中间面板输入问题，AI 基于工作空间文件回答，附带 `[Source: 文件名]` 来源引用。首次使用前请先点击"同步"。

### 4. 生成笔记
右侧面板 → **"生成"** → 选择类型（摘要/FAQ/简报/时间线）。

### 5. 设置
访问 `/settings`：切换 AI 提供商和模型、MAX 模式开关、上下文策略、API Key 状态。

---

## 环境变量参考 / Environment Variables

所有变量在 `.env.local` 中配置，仅在服务器端使用，不会暴露给浏览器。

### 核心配置

| 变量 | 必填 | 说明 | 默认值 |
|------|:----:|------|--------|
| `WORKSPACE_ROOTS` | ✅ | 工作空间根目录（逗号分隔绝对路径，目录必须已存在） | — |
| `DATABASE_URL` | | SQLite 数据库路径。网络文件系统（NFS/CIFS）上建议指向本地路径 | `./data/innoclaw.db` |
| `NEXT_BUILD_DIR` | | Next.js 构建目录。网络文件系统上建议指向本地路径 | `.next` |

### AI 模型

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API Key（至少配置一个 AI Key 才能使用对话功能） |
| `ANTHROPIC_API_KEY` | Anthropic API Key |
| `GEMINI_API_KEY` | Google Gemini API Key |
| `LLM_PROVIDER` | 默认提供商：`openai` / `anthropic` / `gemini`（可在 Settings UI 切换） |
| `LLM_MODEL` | 默认模型名称（可在 Settings UI 切换） |
| `OPENAI_BASE_URL` | OpenAI 兼容 API 地址（用于第三方代理/自部署服务） |
| `ANTHROPIC_BASE_URL` | Anthropic 兼容 API 地址 |
| `GEMINI_BASE_URL` | Gemini 兼容 API 地址 |

### Embedding（向量嵌入）

> 默认使用 `OPENAI_API_KEY` + `OPENAI_BASE_URL`。若对话代理不支持 embedding 接口，可单独配置。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `EMBEDDING_API_KEY` | Embedding API 密钥 | 回退至 `OPENAI_API_KEY` |
| `EMBEDDING_BASE_URL` | Embedding API 地址 | 回退至 `OPENAI_BASE_URL` |
| `EMBEDDING_MODEL` | Embedding 模型 | `text-embedding-3-small` |

### 集成服务

| 变量 | 说明 |
|------|------|
| `GITHUB_TOKEN` | GitHub Personal Access Token（克隆私有仓库需要，需 `repo` scope） |
| `SCP_HUB_API_KEY` | SCP Hub API Key（科学技能需要） |
| `KUBECONFIG_PATH` | Kubernetes kubeconfig 路径（K8s 任务提交需要） |
| `AGENT_MAX_STEPS` | Agent 每次请求最大工具调用步数（默认 10，最大 100） |
| `HF_TOKEN` | HuggingFace Token（下载数据集需要，也可在 Settings UI 设置） |

### 飞书机器人

| 变量 | 说明 |
|------|------|
| `FEISHU_BOT_ENABLED` | 启用飞书机器人（`true`/`false`） |
| `FEISHU_APP_ID` | 飞书应用 App ID |
| `FEISHU_APP_SECRET` | 飞书应用 App Secret |
| `FEISHU_VERIFICATION_TOKEN` | 事件订阅 Verification Token |
| `FEISHU_ENCRYPT_KEY` | 事件订阅 Encrypt Key |
| `FEISHU_PUSH_SECRET` | 推送 API 密钥（可选） |

### 网络代理

> 内网环境中 Node.js 无法直接访问外部 API 时配置。Node.js `fetch()` 不会自动读取系统代理设置。

| 变量 | 说明 |
|------|------|
| `HTTP_PROXY` | HTTP 代理地址 |
| `HTTPS_PROXY` | HTTPS 代理地址 |
| `NO_PROXY` | 不走代理的地址列表 |

### 备份

只需备份 `./data/` 目录（数据库）和 `.env.local` 文件。

---

## 生产部署 / Production Deployment

### 方式一：直接部署

```bash
npm install
cp .env.example .env.local  # 编辑配置
mkdir -p ./data && npx drizzle-kit migrate
npm run build
npm run start               # 默认端口 3000，PORT=8080 可自定义
```

### 方式二：PM2

```bash
npm install -g pm2
npm run build
pm2 start npm --name "innoclaw" -- start
pm2 startup && pm2 save     # 开机自启
```

### 方式三：Docker

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache git python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /app/data
EXPOSE 3000
CMD ["sh", "-c", "npx drizzle-kit migrate && npm run start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  innoclaw:
    build: .
    ports: ["3000:3000"]
    volumes:
      - ./data:/app/data
      - /path/to/research:/data/research
    environment:
      - WORKSPACE_ROOTS=/data/research
      - OPENAI_API_KEY=sk-xxx
    restart: unless-stopped
```

---

## 项目结构 / Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # 首页（工作空间列表）
│   ├── settings/page.tsx         # 设置页面
│   ├── skills/page.tsx           # Skills 管理页面
│   ├── workspace/[workspaceId]/  # 工作空间页面
│   └── api/                      # API 路由
│       ├── workspaces/           # 工作空间 CRUD
│       ├── files/                # 文件操作
│       ├── chat/                 # AI 对话（流式）
│       ├── agent/                # Agent 面板 API
│       ├── skills/               # Skills CRUD + 导入
│       ├── bot/feishu/           # 飞书 webhook + 推送
│       ├── generate/             # 笔记生成
│       └── settings/             # 设置
├── components/                   # React 组件
│   ├── ui/                       # shadcn/ui 基础组件
│   ├── agent/                    # Agent 面板
│   ├── skills/                   # Skills 管理组件
│   ├── chat/                     # 对话组件
│   └── files/                    # 文件浏览器
├── lib/                          # 核心逻辑
│   ├── ai/                       # AI 提供商、Agent 工具、提示词
│   ├── db/                       # Drizzle ORM + SQLite
│   ├── rag/                      # RAG 管道（分块/嵌入/检索）
│   ├── bot/feishu/               # 飞书适配器
│   └── files/                    # 文件系统操作
├── i18n/messages/                # 中英翻译文件
└── types/                        # TypeScript 类型
```

**技术栈：** Next.js 16 · TypeScript · Tailwind CSS 4 · shadcn/ui · Vercel AI SDK 6 · SQLite (better-sqlite3 + Drizzle ORM) · next-intl · next-themes

---

## RAG 管道架构 / RAG Pipeline Architecture

```
索引阶段（点击"同步"）:  文件 → 文本提取 → 分块 → 向量嵌入 → SQLite 存储
查询阶段（用户提问）:    问题 → 向量化 → 余弦相似度搜索 → Top-8 文本块
生成阶段:               系统提示 + 文本块 + 问题 → LLM → 流式回答（附来源引用）
```

**索引流程：**
1. 遍历工作空间，筛选支持的文件类型（`.pdf`, `.txt`, `.md`, `.html`, `.json`, `.csv`, 代码文件等）
2. MD5 哈希比对，仅处理新增/修改的文件
3. 文本提取 → 分块 → 调用 Embedding API 生成向量 → 存入 SQLite

**Embedding 配置：** Embedding 和对话模型可使用不同服务商。见 [环境变量参考](#embedding向量嵌入) 中的 `EMBEDDING_*` 变量。

---

## 常见问题 / Troubleshooting

### 安装问题

**`better-sqlite3` 编译失败？**
需要 C++ 编译工具链：Windows 安装 [VS Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)；macOS 运行 `xcode-select --install`；Linux 运行 `sudo apt-get install -y build-essential python3`。

**`npm install` 网络错误？**
使用镜像源：`npm install --registry=https://registry.npmmirror.com`

**`npx drizzle-kit migrate` 报错？**
确认 `./data/` 目录已存在（`mkdir -p ./data`）。数据库损坏可删除后重建：`rm -f ./data/innoclaw.db && npx drizzle-kit migrate`。

**`SQLITE_IOERR_SHMMAP` / `disk I/O error`？**
项目位于网络文件系统（NFS/CIFS）时常见。在 `.env.local` 中设置 `DATABASE_URL=/tmp/innoclaw/innoclaw.db`，然后 `mkdir -p /tmp/innoclaw && npx drizzle-kit migrate`。

**`Persisting failed` / `No such device`？**
Turbopack 在网络文件系统上的缓存警告，不影响功能。可设置 `NEXT_BUILD_DIR=/tmp/innoclaw-next` 消除。

**端口被占用？**
`PORT=3001 npm run dev`

### 功能问题

**不配置 API Key 可以使用吗？**
可以。工作空间、文件管理、GitHub 克隆等不需要 API Key。仅 AI 对话和笔记生成需要至少一个 Key。

**如何使用第三方 API 代理？**
设置 `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL` / `GEMINI_BASE_URL`。若代理不支持 embedding，可单独配置 `EMBEDDING_*` 变量。

**AI 对话报 `Connect Timeout Error`？**
内网环境需配置 HTTP 代理：设置 `HTTP_PROXY` 和 `HTTPS_PROXY`。

**SCP 技能导入报 "No skills found"？**
确保 URL 包含 `/tree/main`：`https://github.com/InternScience/scp/tree/main`。私有仓库需配置 `GITHUB_TOKEN`。

**飞书开发者后台提示 "未检测到应用连接信息"？**
确保服务已启动且终端显示 `[feishu-ws] WSClient connected successfully`。检查 `FEISHU_BOT_ENABLED=true` 和凭证配置。

**Agent 面板 K8s 任务失败？**
确保已安装 `kubectl`（`kubectl version --client`），且 `KUBECONFIG_PATH` 配置正确。

**如何重置数据库？**
`rm -f ./data/innoclaw.db && npx drizzle-kit migrate`

---

## 开发 / Development

```bash
npm run dev              # 开发模式（热更新）
npm run build            # 类型检查 + 构建
npm run lint             # 代码检查
npx drizzle-kit generate # 生成迁移（修改 schema 后）
mkdir -p ./data && npx drizzle-kit migrate  # 执行迁移
```
