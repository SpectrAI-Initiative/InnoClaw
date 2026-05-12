---
orphan: true
---

# InnoClaw

<p align="center">
  <img src="../site/logos/20260316-112548.png" alt="InnoClaw Logo" width="200" />
</p>

<p align="center">
  <b>一个可自托管的 AI 研究工作台，用于基于文档的问答、论文研读、科学技能调用与研究执行。</b>
</p>

<p align="center">
  <i>以你的文件为依据，围绕论文组织流程，并能够继续走向执行。</i>
</p>

<p align="center">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="Apache 2.0 License"></a>
  <a href="../package.json"><img src="https://img.shields.io/badge/Node.js-24%2B%20(LTS)%20%7C%2025%20Current-339933?logo=node.js&logoColor=white" alt="Node.js 24+ LTS or 25 Current"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/actions/workflows/ci.yml"><img src="https://github.com/SpectrAI-Initiative/InnoClaw/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://SpectrAI-Initiative.github.io/InnoClaw/"><img src="https://img.shields.io/badge/Docs-Online-blue?logo=gitbook&logoColor=white" alt="Online Docs"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/stargazers"><img src="https://img.shields.io/github/stars/SpectrAI-Initiative/InnoClaw?style=flat&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/issues"><img src="https://img.shields.io/github/issues/SpectrAI-Initiative/InnoClaw" alt="GitHub Issues"></a>
</p>

<p align="center">
  <a href="../README.md">English</a> · <b>简体中文</b> · <a href="README_JA.md">日本語</a> · <a href="README_FR.md">Français</a> · <a href="README_DE.md">Deutsch</a>
</p>

<p align="center">
  <a href="https://SpectrAI-Initiative.github.io/InnoClaw/">完整文档</a> · <a href="#cn-quick-start">安装与使用</a> · <a href="#cn-community-support">社区交流</a>
</p>

> 此翻译页可能会略晚于英文主页 `README.md` 更新。

InnoClaw 将服务器文件夹变成 AI 原生工作空间，用于基于文档的问答、论文研读、科学工作流和研究执行。

它面向研究人员、开发者、实验室团队和自托管用户：不只是提供聊天界面，而是提供基于真实文件的引用回答、可复用技能，以及从阅读走向执行的完整路径。

> 工作流：打开工作空间 -> 同步文件进入 RAG -> 基于文档提问 -> 研读论文 -> 运行多智能体讨论 -> 生成笔记和灵感 -> 执行远程研究任务

---

## 🔥 新增特性

### 最近更新

<!-- whats-new-start -->

#### 2026-04-17
- **InnoClaw 命令行工具**: 可在终端运行应用、管理工作区，并创建/运行/导出 Deep Research 会话
- **Deep Research 检查点**: 研究流程现可在关键节点暂停，支持继续、修订、分支、拒绝或停止
- **角色工作室**: 新增 Deep Research 角色页，可查看专家角色并向 Researcher 或各工作角色定向下达指令


#### 2026-04-12
- **Docker 部署支持**: 现在可通过 Docker 和 docker-compose 自托管 InnoClaw，并提供部署、挂载与升级指南
- **200+ 内置技能**: 大幅扩展可直接使用的科研技能，覆盖生物信息、化学、基因组学与物理等领域
- **技能创建框架**: 新增元技能，可用于创建、自测、基准评估和校验自定义技能



<details>
<summary>显示更早的更新</summary>

#### 2026-04-02
- **Docker 部署支持**: 新增 Dockerfile、docker-compose.yml 及完整 Docker 部署指南，支持自托管生产环境部署
- **200+ 内置技能扩充**: 大幅扩展技能库，涵盖生物信息学、化学信息学、基因组学、物理学及药物发现流程
- **技能创建框架**: 新增元技能，提供评估、基准测试与验证工具，用于构建和测试自定义技能




#### 2026-04-01
- **自然语言转 CAD 技能**: 新增 Agent 技能，通过 CadQuery 将自然语言描述转换为 3D CAD 模型（STL/STEP），并自动配置运行环境
- **工作区图片选择器**: Agent 面板新增对话框 UI，支持浏览并选取工作区中的图片附加到对话





#### 2026-03-31
- **粘贴图片支持**: 用户现在可以直接将图片粘贴到聊天输入框中，进行多模态 AI 对话
- **深度研究角色工作室**: 新增角色工作室面板，支持在深度研究工作流中配置和管理自定义研究员角色
- **论文搜索源扩展**: Paper Study 新增支持 BioRxiv、PubMed 和 PubChem 作为可检索的论文来源






#### 2026-03-26
- **动态模型发现**: Agent 面板现可自动从每个已配置的 AI 提供商获取可用模型列表，并与内置模型合并展示
- **单模型 Base URL 路由**: 国内 AI 提供商（shlab、qwen、moonshot、deepseek、minimax、zhipu）支持通过 `<PROVIDER>_<MODEL>_BASE_URL` 环境变量为单个模型配置独立接入地址
- **运行时工具调用开关**: 可通过 `<PROVIDER>_TOOLS_ENABLED=true/false` 环境变量按提供商动态开关工具调用能力，无需修改代码







#### 2026-03-26
- **Node.js 运行时更新**: InnoClaw 现以 Node.js 24+ 为目标运行时，并已验证兼容 Node.js 24 LTS 与最新的 Node.js 25 Current 版本。CI 与本地版本提示也已同步更新。








#### 2026-03-24
- **多模态大模型支持**: 论文研究与智能体工作流现支持标准 LLM 与多模态 LLM（mLLM），可在设置页面和模型选择器中按上下文切换








#### 2026-03-23
- **GitHub 技能导入预览**: 新增导入前预览流程，支持浏览 GitHub 仓库中的技能列表并按需选择性导入









#### 2026-03-22
- **Obsidian 笔记导出**: 在论文学习面板中直接生成带有丰富 YAML 元数据、图片和 Wikilink 的结构化 Obsidian 兼容笔记
- **按任务选择模型**: 新增模型选择器 UI 组件，支持为各个论文学习任务（摘要、评审、笔记等）单独覆盖默认 AI 模型
- **笔记讨论视图**: 新增论文笔记全页讨论视图，支持围绕生成笔记内容进行多轮 AI 辅助对话










</details>


<!-- whats-new-end -->

---

## 🧭 InnoClaw 是什么？

InnoClaw 是一个面向研究工作的可自托管 Web 应用，把工作空间管理、RAG 对话、论文搜索与评审、可复用科学技能，以及 Agent 执行能力整合到同一个产品中。

你不需要在文件浏览器、笔记工具、论文阅读器和自动化终端之间来回切换。打开一个工作空间后，就可以在同一上下文里同步内容、提问、研读论文，并推进多步研究任务。

## ✨ 为什么用 InnoClaw

- **工作空间优先** - 把服务器目录变成长期可用的研究工作区，承载文件、笔记、会话和执行上下文
- **有依据的 AI 回答** - 基于 RAG 和来源引用，让回答建立在你的文档和代码之上
- **研究原生工作流** - 论文研读、多智能体结构化讨论、研究灵感生成都内建在产品里
- **科学技能可复用** - 可导入并使用 206 个 SCP 科学技能，覆盖药物发现、基因组学、蛋白质工程等领域
- **不仅能聊，还能执行** - 从阅读和规划走向任务提交、监控、结果收集与下一步建议
- **自托管且多模型友好** - 支持 OpenAI、Anthropic、Gemini 及兼容接口

<a id="cn-quick-start"></a>

## 🚀 快速开始

如果你是自托管或线上部署，建议优先使用 Git tag/release，而不是直接跟随持续变化的 `main` 分支：
运行时要求：
- 需要 Node.js `24+`
- 稳定部署推荐使用 Node.js `24 LTS`
- 也支持 Node.js `25 Current`

如果你使用 `nvm`，可以直接跟随仓库默认版本：

```bash
nvm install
nvm use
```

```bash
git clone https://github.com/SpectrAI-Initiative/InnoClaw.git
cd InnoClaw
git fetch --tags
# 生产环境建议固定版本：
# git checkout vX.Y.Z
```

InnoClaw 需要 Node.js 24+，以 `package.json` 中的要求为准。

### 1. 安装

```bash
npm install
cp .env.example .env.local
mkdir -p ./data /absolute/path/to/workspaces
npx drizzle-kit migrate
```

在 `.env.local` 中至少配置工作空间路径和一个模型提供商，例如：

```ini
WORKSPACE_ROOTS=/absolute/path/to/workspaces
OPENAI_API_KEY=sk-...
```

注意：

- `WORKSPACE_ROOTS` 中的目录需要提前创建，应用不会自动创建
- `npx drizzle-kit migrate` 会初始化或升级默认位于 `./data/innoclaw.db` 的 SQLite 数据库
- 如果项目放在 NFS/CIFS 或其他禁用了本地文件锁的挂载上，InnoClaw 现在会自动关闭 Next 的 dist-dir 锁，让 `npm run dev` 能启动；但 SQLite 仍然建议把 `DATABASE_URL` 指到本地磁盘。`NEXT_BUILD_DIR` 如果要设置，必须仍然位于仓库内，例如 `.next-local`。

### 2. 启动

```bash
npm run dev
```

浏览器打开 `http://localhost:3000`。

### 3. 首次使用

进入界面后，建议按这个顺序操作：

1. 在 `Settings` 中配置至少一个 AI 提供商
2. 从 `WORKSPACE_ROOTS` 下打开已有目录，或创建一个新的 workspace
3. 点击 `Sync`，让 InnoClaw 为当前工作空间建立 RAG 索引
4. 先从基于文件的问答开始，再进入论文研读、笔记、技能或研究执行流程

### 4. 常见使用路径

- **基于文件的对话**：对本地文件和代码提问，回答会附带引用
- **论文研读**：搜索论文、生成摘要，并进一步运行多智能体讨论
- **技能导入与调用**：导入可复用科学技能，在 Agent 面板中触发
- **研究执行**：审查代码、准备任务、提交到 Shell/Slurm/`rjob`，并跟踪产物

### 5. 版本更新与升级

版本升级不只是拉代码，还可能涉及依赖变化、环境变量新增和数据库迁移。

- 生产环境建议固定 release tag，不建议直接长期跟 `main`
- 每次升级前先看 `CHANGELOG.md`
- 拉取新版本后，用 `.env.example` 对照检查 `.env.local` 是否需要补新变量
- 每次版本升级后，都重新执行 `npm install` 和 `npx drizzle-kit migrate`

推荐升级流程：

```bash
git fetch --tags
git checkout vX.Y.Z
npm install
npx drizzle-kit migrate
npm run build
```

如果你明确选择跟随 `main`，升级流程至少应为：

```bash
git pull
npm install
npx drizzle-kit migrate
```

如果新版本提高了 Node.js 主版本要求，请先切换到对应 Node 版本，再重新安装依赖后启动。

需要更完整的系统依赖、部署或配置说明，可继续看 `getting-started/installation.md`、`getting-started/deployment.md` 和 `../CHANGELOG.md`。

## 🛠️ 你可以用它做什么

- 基于本地文件和代码进行带引用的 AI 对话
- 在同一工作区中搜索、摘要和研读论文
- 运行 5 角色结构化论文讨论，做批判和复现思考
- 从工作空间内容中生成摘要、FAQ、简报、时间线和研究灵感
- 导入科学技能，在 Agent 面板中触发可复用的领域工作流
- 通过审批门控、任务监控和结果分析来管理研究执行

## 🗺️ 选择你的入口

| 如果你想... | 从这里开始 | 接下来会发生什么 |
|-------------|------------|-------------------|
| 和自己的文件对话 | **工作空间 + RAG 对话** | 打开文件夹、点击 `Sync`，然后基于引用提问 |
| 阅读并拆解论文 | **论文研读** | 搜索论文、生成摘要，再进入讨论或笔记 |
| 用多视角审视想法 | **多智能体讨论** | 运行基于角色的评审流程，做批判、证据梳理和复现思考 |
| 把阅读转成新方向 | **研究灵感生成** | 生成方向、比较方案，并把结果保存到笔记 |
| 在远程基础设施上执行研究任务 | **研究执行工作区** | 审查代码、审批修改、提交任务、监控运行并收集结果 |

## 🧩 它们如何协同工作

| 层级 | 在工作流中的作用 |
|------|------------------|
| **Workspace** | 承载文件、笔记、会话上下文和项目状态 |
| **Knowledge** | 将文件同步到 RAG 索引，让回答更有依据 |
| **Paper Workbench** | 负责文献搜索、摘要、讨论和灵感生成 |
| **Skills** | 提供可复用的领域工作流和工具引导能力 |
| **Execution** | 把流程延伸到远程任务和实验循环 |

## 🔄 核心工作流

### 📄 论文研读

搜索文献、预览论文、生成摘要，并直接切换到讨论或灵感生成。

- 在一个界面里跨源搜索论文
- 使用 AI 扩展查询，覆盖更广的相关文献
- 在工作空间上下文中直接打开论文预览
- 将输出保存到笔记，便于复用

### 🧠 多智能体论文讨论

通过主持人、文献专家、质疑者、复现者、记录员等角色开展结构化论文讨论。

- 使用确定性的阶段式讨论流程
- 对比证据、方法、局限性和可复现性问题
- 生成比普通聊天更易扫描的评审记录
- 利用全文上下文做更深入的分析

### 🧪 研究执行工作区

从代码检查到任务提交与结果分析，在一个引导式执行流程中完成。

- 借助 Agent 审查仓库并提出补丁建议
- 对高风险步骤设置明确的人工审批点
- 通过 Shell、Slurm 或 `rjob` 后端提交任务
- 监控状态、收集结果，并生成下一步建议

## 📦 功能速览

| 功能 | 能力说明 |
|------|----------|
| 工作空间管理 | 将服务器文件夹映射为持久化 AI 工作区 |
| 文件浏览器 | 浏览、上传、创建、编辑、预览和同步文件 |
| RAG 对话 | 基于已索引文件进行带引用的问答 |
| 论文研读 | 在一个界面中搜索、摘要和检查论文 |
| 讨论模式 | 运行结构化多角色论文讨论 |
| 研究灵感生成 | 生成新方向和跨学科想法 |
| Skills 系统 | 导入可复用的科学技能和工作流 |
| 研究执行 | 带审批门控、监控和结果收集的实验编排 |
| 多 Agent 会话 | 在不同项目和标签中维护独立上下文 |
| 多模型支持 | 使用 OpenAI、Anthropic、Gemini 及兼容接口 |

## 📚 文档入口

- **先从这里开始** - [概览](getting-started/overview.md), [安装指南](getting-started/installation.md)
- **配置与部署** - [部署说明](getting-started/deployment.md), [环境变量](getting-started/environment-variables.md), [配置说明](usage/configuration.md)
- **使用产品** - [功能说明](usage/features.md), [API 参考](usage/api-reference.md)
- **排查与贡献** - [故障排查](troubleshooting/faq.md), [开发指南](development/contributing.md)

<a id="cn-community-support"></a>

## 💬 社区与支持

- **想查看安装、使用和部署说明？** 先看完整文档：https://SpectrAI-Initiative.github.io/InnoClaw/
- **想反馈 Bug 或提出功能建议？** 访问 GitHub Issues：https://github.com/SpectrAI-Initiative/InnoClaw/issues
- **想直接交流？** 可加入下方飞书体验群

<img src="../site/social/飞书体验群.png" alt="InnoClaw 飞书体验群" width="200" />

> 扫码加入飞书体验群，与开发者和其他用户直接交流。欢迎反馈 Bug、提出功能建议或分享使用经验。

## ℹ️ 项目信息

- **许可证** - Apache-2.0，详见 `../LICENSE`
- **仓库地址** - https://github.com/SpectrAI-Initiative/InnoClaw
- **文档站点** - https://SpectrAI-Initiative.github.io/InnoClaw/

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=SpectrAI-Initiative/InnoClaw&type=Date)](https://star-history.com/#SpectrAI-Initiative/InnoClaw&Date)
