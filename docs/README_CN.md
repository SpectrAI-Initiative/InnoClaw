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
  <a href="../package.json"><img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white" alt="Node.js 20+"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/actions/workflows/ci.yml"><img src="https://github.com/SpectrAI-Initiative/InnoClaw/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://SpectrAI-Initiative.github.io/InnoClaw/"><img src="https://img.shields.io/badge/Docs-Online-blue?logo=gitbook&logoColor=white" alt="Online Docs"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/stargazers"><img src="https://img.shields.io/github/stars/SpectrAI-Initiative/InnoClaw?style=flat&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/issues"><img src="https://img.shields.io/github/issues/SpectrAI-Initiative/InnoClaw" alt="GitHub Issues"></a>
</p>

<p align="center">
  <a href="../README.md">English</a> · <b>简体中文</b> · <a href="README_JA.md">日本語</a> · <a href="README_FR.md">Français</a> · <a href="README_DE.md">Deutsch</a>
</p>

<p align="center">
  <a href="https://SpectrAI-Initiative.github.io/InnoClaw/">完整文档</a> · <a href="#cn-quick-start">快速开始</a> · <a href="#cn-community-support">社区交流</a>
</p>

> 此翻译页可能会略晚于英文主页 `README.md` 更新。

InnoClaw 将服务器文件夹变成 AI 原生工作空间，用于基于文档的问答、论文研读、科学工作流和研究执行。

它面向研究人员、开发者、实验室团队和自托管用户：不只是提供聊天界面，而是提供基于真实文件的引用回答、可复用技能，以及从阅读走向执行的完整路径。

> 工作流：打开工作空间 -> 同步文件进入 RAG -> 基于文档提问 -> 研读论文 -> 运行多智能体讨论 -> 生成笔记和灵感 -> 执行远程研究任务

---

## 🔥 新增特性

### 最近更新

<!-- whats-new-start -->

#### 2026-03-20
- **深度研究模块**: 完整的 AI 驱动科学研究流程，支持多阶段编排、评审员辩论、执行规划与工作流可视化界面
- **执行流水线**: 自动化实验执行系统，支持 Slurm 作业提交、数据集管理、预处理与远程执行器


#### 2026-03-19
- **ClawHub 技能导入**: 新增从 ClawHub 直接导入技能的集成功能，包含专用 API 端点和导入对话框
- **代码预览面板**: 新增编辑器内代码预览组件，支持语法高亮及保存状态追踪
- **论文学习缓存**: 为论文学习会话新增持久化缓存层，提升重载性能与状态连续性



#### 2026-03-18
- **论文分析多模态视觉支持**: 在论文讨论和研究创意生成过程中，现可提取并视觉分析 PDF 中的图像内容
- **Claude Code 技能集成**: 新增专属导入流程，可直接从本地文件夹或 Claude Code 项目中导入技能




#### 2026-03-18
- **论文讨论与灵感生成支持多模态视觉**: 支持视觉的 AI 提供商现在会同时接收提取出的 PDF 页面图像和文本，使讨论与灵感生成智能体可以直接分析论文中的图表、表格与示意图。
- **论文页面图库界面**: Discussion 和 Ideation 面板新增可折叠的论文页面缩略图库，并支持点击查看大图预览。
- **供应商视觉能力检测**: 提供商配置新增视觉支持标记，路由会根据当前模型能力自动切换多模态或纯文本论文上下文。




#### 2026-03-17
- **远程作业配置管理与 SSH 安全加固**: 支持安全的远程配置文件创建、编辑及 SSH 加固的研究作业提交
- **智能体面板富文本渲染**: 智能体消息支持表格、LaTeX 数学公式及代码高亮渲染
- **API 提供商设置界面**: 可在设置页面直接配置 AI 提供商的 API 密钥与端点





#### 2026-03-17
- **rjob 配置与提交加固**: 远程配置现支持完整 rjob 默认值（镜像、GPU、CPU、内存、挂载、charged-group、私有机器、环境变量、host-network、示例命令）。`submitRemoteJob` 从存储配置内部构建 rjob 命令 - Agent 无法修改 `--charged-group` 或 `--image` 等参数。SSH 传输修复：`-o StrictHostKeyChecking=no -tt`、init 脚本加载及双引号包装。
- **远程配置编辑**: Remotes 标签页中远程配置新增编辑按钮（铅笔图标），点击可将配置加载到表单进行更新，包含所有 rjob 配置字段。
- **直接任务提交捷径**: Agent-Long 模式可跳过 inspect/patch/sync 阶段直接提交简单任务：`listRemoteProfiles -> prepareJobSubmission -> approval -> submitRemoteJob`。





#### 2026-03-16
- **论文讨论与灵感生成稳定性提升**: 分角色 token 预算（提升 2-2.5 倍），空/短回复自动重试，UI 中显示错误信息。修复推理型模型（SH-Lab、Qwen 等）返回空或截断输出的问题
- **全文送入讨论智能体**: 讨论和灵感生成智能体现可接收最多 30k 字符的论文全文（本地文件），而非仅摘要，支持更深入的方法论、实验和结果分析
- **摘要提取修复**: 基于启发式正则的摘要提取，改进 AI 提示词以防止将作者名误提取为摘要





#### 2026-03-14
- **研究执行引擎**: 全新 AI 驱动的研究编排系统，支持远程配置、能力开关、运行历史和 Agent 工具
- **自动更新 README 新功能板块**: GitHub Actions 工作流每日自动生成并提交新功能板块

*暂无条目。当 CI 检测到重大新功能时会自动更新此栏目。*







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

```bash
git clone https://github.com/SpectrAI-Initiative/InnoClaw.git
cd InnoClaw
npm install
npm run dev
```

- 打开 `http://localhost:3000`
- 在 Settings 页面配置至少一个 AI 提供商
- 打开或克隆一个工作空间后，点击 `Sync` 建立 RAG 索引
- 需要系统依赖或生产部署说明？见 `getting-started/installation.md`

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
