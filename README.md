# InnoClaw

一个可自托管的 AI 研究助手。将服务器文件夹作为工作空间，基于 RAG 与 AI 对话，内置 206 个科学技能。

A self-hostable AI research assistant. Turn server-side folders into workspaces, chat with AI grounded in your documents via RAG, and leverage 206 built-in scientific skills.

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
- 🗂️ **多 Agent 会话** — 标签式多会话管理，支持重命名、独立上下文
- 📚 **论文研读** — 跨 arXiv / HuggingFace / Semantic Scholar 搜索，AI 智能扩展查询，一键摘要
- 🎓 **论文讨论模式** — 5 角色多智能体结构化讨论（主持人/文献专家/质疑者/复现者/记录员），6 阶段确定性流程
- 💡 **研究灵感生成** — 多智能体 AI 头脑风暴，基于论文生成跨学科研究方向与创新点
- 📑 **多标签预览** — 同时打开多篇论文和文件，标签式切换，一键从文件预览转为论文研读模式
- 🧪 **研究执行工作区** — 13 阶段自动化实验工作流：代码审查 → 补丁提议 → 远程同步 → 任务提交 → 智能监控 → 结果收集 → 分析推荐。支持 Shell / Slurm / rjob 三种调度后端，5 个 AI Agent 角色协作，权限细粒度管控

**适用人群：** 研究人员 · 开发者 · 自托管爱好者 · 学生和教育工作者

---

## 快速开始 / Quick Start

> **前置要求 / Prerequisites：** Node.js >=20.0.0, npm, Git, C++ 编译工具链（用于编译 `better-sqlite3` 原生模块）

---

### 各系统安装前置依赖 / Install Prerequisites by OS

<details>
<summary><b>🪟 Windows</b></summary>

#### 1. 安装 Node.js

从 [Node.js 官网](https://nodejs.org/) 下载 LTS 版本（>=20.0.0）的 Windows 安装包（`.msi`），运行安装程序，勾选 **"Automatically install the necessary tools"**（自动安装必要工具）。

或使用 [nvm-windows](https://github.com/coreybutler/nvm-windows)：
```powershell
nvm install 20
nvm use 20
```

验证安装：
```powershell
node -v   # 应显示 v20.x.x 或更高
npm -v
```

#### 2. 安装 Git

从 [Git 官网](https://git-scm.com/download/win) 下载安装。安装过程中保持默认选项即可。

```powershell
git --version
```

#### 3. 安装 C++ 编译工具链

本项目依赖 `better-sqlite3`，需要 C++ 编译环境。**选择以下任一方式：**

**方式 A：通过 npm 自动安装（推荐）**
```powershell
npm install -g windows-build-tools
```

**方式 B：手动安装 Visual Studio Build Tools**
1. 下载 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. 安装时选择 **"Desktop development with C++"** 工作负载
3. 确保勾选了 **MSVC** 和 **Windows SDK**

#### 4. 安装 Python（如未自动安装）

部分 Node.js 原生模块编译需要 Python 3。从 [Python 官网](https://www.python.org/downloads/) 安装，并确保勾选 **"Add Python to PATH"**。

```powershell
python --version   # 应显示 Python 3.x
```

</details>

<details>
<summary><b>🐧 Linux (Ubuntu/Debian)</b></summary>

#### 1. 安装 Node.js

**方式 A：使用 NodeSource（推荐）**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**方式 B：使用 nvm**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

验证安装：
```bash
node -v   # 应显示 v20.x.x 或更高
npm -v
```

#### 2. 安装 Git 和 C++ 编译工具链

```bash
sudo apt-get update
sudo apt-get install -y git build-essential python3
```

- `build-essential` 包含 `gcc`、`g++`、`make` 等编译工具，用于编译 `better-sqlite3` 原生模块
- `python3` 部分 Node.js 原生模块编译需要

验证安装：
```bash
git --version
gcc --version
python3 --version
```

</details>

<details>
<summary><b>🐧 Linux (CentOS/RHEL/Fedora)</b></summary>

#### 1. 安装 Node.js

**方式 A：使用 NodeSource（推荐）**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs       # CentOS/RHEL
# 或
sudo dnf install -y nodejs       # Fedora
```

**方式 B：使用 nvm**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

#### 2. 安装 Git 和 C++ 编译工具链

```bash
sudo yum groupinstall -y "Development Tools"   # CentOS/RHEL
sudo yum install -y git python3
# 或
sudo dnf groupinstall -y "Development Tools"   # Fedora
sudo dnf install -y git python3
```

</details>

<details>
<summary><b>🍎 macOS</b></summary>

#### 1. 安装 Xcode 命令行工具

macOS 编译原生模块需要 Xcode 命令行工具（包含 `clang`、`make` 等）：

```bash
xcode-select --install
```

在弹出的对话框中点击 **"Install"** 并等待完成。

#### 2. 安装 Node.js

**方式 A：使用 Homebrew（推荐）**
```bash
# 如果还没有安装 Homebrew：
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install node@20
```

**方式 B：使用 nvm**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.zshrc    # 或 source ~/.bashrc
nvm install 20
nvm use 20
```

**方式 C：从官网下载**

从 [Node.js 官网](https://nodejs.org/) 下载 macOS 安装包（`.pkg`）。

验证安装：
```bash
node -v   # 应显示 v20.x.x 或更高
npm -v
```

#### 3. 安装 Git

macOS 安装 Xcode 命令行工具后已包含 Git，也可通过 Homebrew 更新：
```bash
brew install git
git --version
```

</details>

---

### 方式一：手动安装（通用） / Manual Setup (Universal)

适用于所有用户，无额外依赖。确保已按上面的指引安装好前置依赖。

Works for all users with no extra dependencies. Make sure you've installed the prerequisites above.

#### 第 1 步：克隆并安装 / Clone & Install

```bash
git clone https://github.com/zjowowen/InnoClaw.git
cd InnoClaw
npm install
```

> **💡 提示：** 如果 `npm install` 因网络问题失败，可使用镜像源：
> ```bash
> npm install --registry=https://registry.npmmirror.com
> ```

> **💡 Windows 用户注意：** 如果遇到 `better-sqlite3` 编译错误，请确认已安装 Visual Studio Build Tools（见上方 Windows 前置依赖）。

#### 第 2 步：最小配置 / Minimal Configuration

**Linux / macOS：**
```bash
cp .env.example .env.local
```

**Windows (PowerShell)：**
```powershell
Copy-Item .env.example .env.local
```

**Windows (CMD)：**
```cmd
copy .env.example .env.local
```

编辑 `.env.local`，只需设置两项即可启动：

Edit `.env.local`, only two settings are required to start:

```env
# [必填/Required] 工作空间根目录（逗号分隔的绝对路径，目录必须已存在）
# Workspace root directories (comma-separated absolute paths, directories must exist)

# Linux/macOS 示例：
WORKSPACE_ROOTS=/home/yourname/research,/home/yourname/projects

# Windows 示例：
# WORKSPACE_ROOTS=D:/Data/research,D:/Data/projects

# [推荐/Recommended] 至少配置一个 AI API Key（不配置也能启动，但 AI 功能不可用）
# At least one AI API Key (app starts without it, but AI features won't work)
OPENAI_API_KEY=sk-xxx
# 或/or ANTHROPIC_API_KEY=sk-ant-xxx
# 或/or GEMINI_API_KEY=xxx
```

> 完整环境变量列表见 [环境变量参考](#环境变量参考--environment-variables)。
>
> For the full list of environment variables, see [Environment Variables](#环境变量参考--environment-variables).

#### 第 3 步：初始化并启动 / Init & Start

**Linux / macOS：**
```bash
# 创建数据目录 + 初始化数据库
mkdir -p ./data && npx drizzle-kit migrate

# 启动开发服务器
npm run dev
```

**Windows (PowerShell)：**
```powershell
# 创建数据目录 + 初始化数据库
if (-not (Test-Path ./data)) { New-Item -ItemType Directory -Path ./data }
npx drizzle-kit migrate

# 启动开发服务器
npm run dev
```

**Windows (CMD)：**
```cmd
if not exist data mkdir data
npx drizzle-kit migrate
npm run dev
```

打开 **http://localhost:3000** 即可使用。如看到工作空间列表页面，说明安装成功。

Open **http://localhost:3000** in your browser. If you see the workspace list page, the installation is successful.

---

### 方式二：Claude Code 自动安装（可选） / Auto Setup via Claude Code (Optional)

> **前提条件 / Prerequisites:**
> - 需要已安装 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI 工具
> - Claude Code 目前有**地区限制**，部分地区无法安装或使用
> - 如果你无法安装或使用 Claude Code，请使用上面的**方式一手动安装**

如果你已安装 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)，按照以下步骤操作：

If you have [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed, follow these steps:

**第 1 步：克隆仓库 / Step 1: Clone the Repository**

```bash
git clone https://github.com/zjowowen/InnoClaw.git
cd InnoClaw
```

**第 2 步：启动 Claude Code / Step 2: Launch Claude Code**

```bash
claude
```

**第 3 步：在 Claude Code 中运行安装向导 / Step 3: Run the Setup Wizard Inside Claude Code**

在 Claude Code 交互界面中输入：

Type the following in the Claude Code interactive prompt:

```
/setup
```

> **注意 / Note:**
> - 请勿直接在终端运行 `claude /setup`，这不会触发安装向导。
> - Do NOT run `claude /setup` directly in the terminal — this will not trigger the setup wizard.
> - 正确的做法是先用 `claude` 命令进入 Claude Code，再在其中输入 `/setup`。
> - The correct approach is to first enter Claude Code with the `claude` command, then type `/setup` inside it.

`/setup` 会交互式引导你完成：依赖安装 → 环境配置（工作空间路径、AI API Key 等）→ 数据库初始化 → 启动服务。

The `/setup` command interactively guides you through: dependency installation → environment configuration (workspace paths, AI API keys, etc.) → database initialization → server startup.

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

## 新增特性 / What's New

<!-- whats-new-start -->

#### 2026-03-14
- **Research Execution Engine / 研究执行引擎**: New AI-driven research orchestration system with remote profiles, capability toggles, run history, and agent tools
- **Auto-updating README "What's New" / 自动更新 README 新功能板块**: GitHub Actions workflow that automatically generates and commits a bilingual What's New section daily

*暂无条目。当 CI 检测到重大新功能时会自动更新此栏目。*



<!-- whats-new-end -->

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
- **多 Agent 会话** — 标签式多会话管理，独立上下文，支持重命名和两步确认关闭
- **论文研读** — 跨 arXiv / HuggingFace / Semantic Scholar 三源搜索，AI 查询扩展，批量摘要生成
- **论文讨论模式** — 多智能体结构化论文评审：5 个专家角色（Moderator / Librarian / Skeptic / Reproducer / Scribe）经过 6 个阶段（议程→证据→批判→复现→共识→报告）生成结构化评审报告，支持快速/完整两种模式
- **研究灵感生成** — 多智能体 AI 头脑风暴：基于论文摘要，多个 AI 专家角色从不同视角（方法论创新、跨学科融合、应用拓展等）生成研究方向与创新点，支持交互式深入探讨
- **多标签预览面板** — 支持同时打开多篇论文和文件，标签式切换管理。文件预览中提供 "Study Paper" 按钮，一键将 PDF/MD/TXT 文件转为论文研读模式（含摘要、讨论、笔记、讨论、灵感生成五个标签页）
- **论文笔记管理** — 本地笔记目录集成，讨论保存到文件，AI 智能关联笔记
- **主题风格** — 默认 / 卡通 / 赛博像素 / 复古掌机四种视觉风格
- **研究执行工作区 (Research Execution Workspace)** — 端到端自动化实验管理：
  - **13 阶段工作流**：代码审查 → 补丁提议 → 审批 → 应用 → 同步预览 → 同步执行 → 任务准备 → 提交 → 监控 → 审批收集 → 收集结果 → 分析 → 推荐下一步
  - **5 个 AI Agent 角色**：Repo Agent（代码分析）、Patch Agent（补丁生成）、Remote Agent（远程操作）、Result Analyst（结果分析）、Research Planner（策略规划）
  - **3 种调度后端**：Shell (nohup)、Slurm (sbatch)、rjob（容器化任务，支持 GPU/内存/镜像/挂载配置）
  - **智能任务监控**：SSH 单命令批量检查（调度器状态 + 标志文件 + 心跳 + 日志），自动状态推断与冲突检测
  - **SSH 快速配置**：粘贴 SSH 命令自动解析主机、用户名、端口、密钥
  - **8 项权限管控**：读代码 / 写代码 / 本地终端 / SSH / 远程同步 / 任务提交 / 收集结果 / 自动应用
  - **人工审批门控**：补丁审批、同步执行、任务提交、结果收集四个关键节点需人工确认

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

### 6. 论文研读 / Paper Study
访问 `/paper` 页面，搜索 arXiv、HuggingFace Daily Papers 和 Semantic Scholar 的学术论文：
- **关键词搜索**：添加关键词标签后点击 **"Search"** 进行精确搜索
- **AI 智能搜索**：在任意输入框输入自然语言描述（如 "diffusion models for video generation"），点击 **"AI Search"** → AI 自动提取优化关键词并跨三源搜索
- **论文摘要**：勾选论文后点击 **"Summarize"** 生成 AI 结构化摘要
- **论文讨论**：点击论文预览后可与 AI 讨论论文细节
- **多智能体论文讨论**：在论文预览的 **"Discussion"** 标签页，启动 5 角色结构化讨论（主持人/文献专家/质疑者/复现者/记录员），经过 6 个阶段自动生成评审报告。支持 Quick（简洁）和 Full（完整）两种模式，可导出 Markdown 或保存到笔记
- **研究灵感生成**：在论文预览的 **"Ideation"** 标签页，AI 多专家角色从不同视角（方法论创新、跨学科融合、应用拓展等）进行头脑风暴，基于论文生成研究方向与创新点
- **论文笔记**：在 **"Notes"** 标签页管理本地笔记目录，保存讨论记录，AI 自动发现关联笔记
- **Study Paper 一键研读**：在文件预览面板中，PDF/MD/TXT 文件会显示 **"Study Paper"** 按钮，点击后自动提取论文元数据并打开研读模式（含摘要、讨论、笔记、Discussion、Ideation 五个标签页），原文件预览保持打开

### 7. 多 Agent 会话 / Multi-Agent Sessions
在工作空间的 Agent 面板中，点击 **"+"** 按钮创建新会话。每个会话独立维护对话上下文和记忆：
- 标签栏显示所有活跃会话，点击切换
- 双击标签或点击铅笔图标重命名
- 关闭标签需两步确认（防止误操作）

### 8. 研究执行工作区 / Research Execution Workspace
在工作空间侧边栏打开 **Research Execution** 面板，管理远程实验全流程：

**配置远程目标：**
1. 在 **"Remotes"** 标签页添加远程执行配置（或粘贴 SSH 命令自动解析）
2. 选择调度类型：Shell (nohup) / Slurm (sbatch) / rjob (容器)
3. 在 **"Capabilities"** 标签页启用所需权限

**运行实验：**
1. Agent 自动分析代码库结构（Repo Agent）
2. 提议并审批实验代码变更（Patch Agent）
3. 同步代码到远程目标并提交任务（Remote Agent）
4. 智能监控任务状态：通过 SSH 批量检查调度器状态、标志文件、心跳、日志
5. 人工审批后收集结果，AI 分析并推荐下一步实验方向

**rjob 容器任务示例：**
rjob 后端支持指定容器镜像、GPU 数量、内存、挂载路径等参数，适合需要容器化环境的深度学习实验。

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

> **注意：** 生产部署通常在 Linux 服务器上进行。Windows 用户建议使用 WSL2 或 Docker 部署。

### 方式一：直接部署

**Linux / macOS：**
```bash
npm install
cp .env.example .env.local  # 编辑配置
mkdir -p ./data && npx drizzle-kit migrate
npm run build
npm run start               # 默认端口 3000，PORT=8080 可自定义
```

**Windows (PowerShell)：**
```powershell
npm install
Copy-Item .env.example .env.local   # 编辑配置
if (-not (Test-Path ./data)) { New-Item -ItemType Directory -Path ./data }
npx drizzle-kit migrate
npm run build
$env:PORT=3000; npm run start       # 默认端口 3000
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
│       ├── paper-study/             # 论文研读 API（搜索/摘要/讨论/AI 查询扩展/灵感生成）
│       ├── research-exec/           # 研究执行 API（配置/运行/监控）
│       ├── skills/               # Skills CRUD + 导入
│       ├── bot/feishu/           # 飞书 webhook + 推送
│       ├── generate/             # 笔记生成
│       └── settings/             # 设置
├── components/                   # React 组件
│   ├── ui/                       # shadcn/ui 基础组件
│   ├── agent/                    # Agent 面板（多会话标签）
│   ├── paper-study/              # 论文研读组件
│   ├── preview/                  # 预览面板（多标签、文件预览）
│   ├── research-exec/            # 研究执行组件（工作流/配置/监控/历史）
│   ├── skills/                   # Skills 管理组件
│   ├── chat/                     # 对话组件
│   └── files/                    # 文件浏览器
├── lib/                          # 核心逻辑
│   ├── ai/                       # AI 提供商、Agent 工具、提示词
│   ├── article-search/           # 论文搜索（arXiv / HuggingFace / Semantic Scholar）
│   ├── paper-discussion/         # 多智能体论文讨论（角色/提示词/编排器）
│   ├── research-ideation/        # 多智能体研究灵感生成（角色/提示词/编排器）
│   ├── research-exec/            # 研究执行引擎（类型/编排器/监控/角色/权限/提示词）
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

### Claude Code 相关

**`/setup` 报 `unknown skill` 或找不到？**
`/setup` 是通过项目目录下 `.claude/commands/setup.md` 定义的 Claude Code 自定义命令。请确认：① 在项目根目录下运行 `claude` 进入交互界面后再输入 `/setup`（不要直接在终端运行 `claude /setup`）；② Claude Code 版本足够新（运行 `claude --version` 检查）。如果版本过旧，请升级 Claude Code 或直接使用**方式一手动安装**。

**Claude Code 安装提示地区不支持？**
Claude Code CLI 目前有地区可用性限制，部分地区即使通过 VPN 也可能因账号注册地区等原因无法安装。遇到此问题请直接使用**方式一手动安装**，功能完全相同，只是需要手动编辑 `.env.local` 配置文件。

### 安装问题

**`better-sqlite3` 编译失败？**
需要 C++ 编译工具链（详见上方"各系统安装前置依赖"章节）：
- **Windows**：安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，选择 "Desktop development with C++" 工作负载
- **macOS**：运行 `xcode-select --install`
- **Linux (Debian/Ubuntu)**：运行 `sudo apt-get install -y build-essential python3`
- **Linux (CentOS/RHEL)**：运行 `sudo yum groupinstall -y "Development Tools" && sudo yum install -y python3`

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

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=zjowowen/InnoClaw&type=Date)](https://star-history.com/#zjowowen/InnoClaw&Date)
