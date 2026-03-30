# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-11

### Added / 新增

- **Multi-Agent System / 多智能体系统**: Multi-agent sessions with adjustable dialogue panels and agent display (PR #201, #203, #206)
  多智能体会话，支持可调节对话面板和智能体展示
- **Paper Study Panel / 论文研究面板**: Paper study with notes management, AI-powered roast review, AI search, and Semantic Scholar integration (PR #202)
  论文研究面板，支持笔记管理、AI 吐槽式审稿、AI 搜索及 Semantic Scholar 集成
- **Style Theme System / 风格主题系统**: Cartoon, cyberpunk-pixel, and retro-handheld visual themes (PR #199)
  新增卡通、赛博像素、复古掌机三种视觉主题
- **Cluster & Paper Pages / 集群与论文页面**: Cluster management pages and enhanced UI with particle effects (PR #190)
  新增集群管理页面，增强 UI 粒子特效
- **Fuzzy Matching / 模糊匹配**: Fuzzy search support for improved content discovery (PR #197)
  模糊搜索支持，提升内容检索体验
- **Font Customization / 字体自定义**: Configurable font type and size with shared font constants (PR #191)
  可配置字体类型与大小，抽取共享字体常量
- **Agent Panel Cluster UI / 智能体面板集群 UI**: Left-panel cluster layout for agent management (PR #192-#196)
  智能体管理左侧集群面板布局

### Changed / 变更

- **Rename: LabClaw → InnoClaw / 项目更名**: Full project rename from LabClaw to InnoClaw across the entire codebase
  全项目范围从 LabClaw 更名为 InnoClaw
- **Agent Panel Improvements / 智能体面板改进**: Auto-wrap support, adjustable dialogue, UI beautification (PR #189, #200)
  智能体面板自动换行、可调节对话、UI 美化
- **README & Docs / 文档改进**: Improved setup instructions, default docs language set to Chinese (PR #205)
  改进安装说明，文档默认语言设为中文
- **File Tree / 文件树**: Support for directory deletion (PR #198)
  支持目录删除操作

### Fixed / 修复

- **HuggingFace Search / HuggingFace 搜索**: Fix tests failing on empty keywords and API errors
  修复空关键词和 API 错误导致的测试失败
- **Context Overflow / 上下文溢出**: Improved detection counting tool payloads and sanitizing malformed tool_use
  改进上下文溢出检测，计算工具负载并清理格式错误的 tool_use
- **CI/CD**: Update Node.js to v22, fix lockfile sync, use `npm install` for cross-version compatibility
  升级 Node.js 至 v22，修复锁文件同步，使用 npm install 以兼容不同版本
- **Lint Fixes / 代码检查修复**: Resolve react-hooks, paper-study components, and i18n key lint errors
  修复 react-hooks、论文研究组件及 i18n 键的代码检查错误
- **Repo Sync / 仓库同步**: Add workflow to sync public repo to private repo (CI)
  新增公有仓库到私有仓库的同步工作流

## [0.1.0] - 2025-12-01

### Added

- **Workspace & File Management**: Map server-side folders as workspaces with file browsing, uploading, editing, and Git integration
- **RAG-enhanced Chat**: AI conversations grounded in document content with source citations
- **Smart Note Generation**: Auto-generate summaries, FAQs, briefings, timelines, daily and weekly reports
- **Multi-LLM Support**: OpenAI, Anthropic (Claude), and Google Gemini with configurable providers and models
- **Agent System**: AI agent with tool-calling capabilities including file operations, web search, and paper lookup
- **Skills System**: Import/export skill configurations for advanced workflows
- **206 SCP Scientific Skills**: Built-in skills covering drug discovery, genomics, protein engineering, and more
- **Feishu (Lark) Bot**: WebSocket-based bot integration with interactive card messages and agent tool calls
- **WeChat Enterprise Bot**: Enterprise WeChat bot integration for team collaboration
- **Article Search**: ArXiv and HuggingFace daily papers search with caching
- **HuggingFace Dataset Management**: Browse, download, and manage datasets from HuggingFace Hub
- **Scheduled Tasks**: Cron-based task scheduling for automated daily/weekly reports
- **Internationalization**: Full Chinese and English bilingual support (UI and documentation)
- **Dark Mode**: Theme toggle with system preference detection
- **Kubernetes Integration**: K8s cluster management for job submission
- **Resizable Panel Layout**: Customizable workspace layout with drag-to-resize panels
- **Context Management**: MAX mode with automatic summarization to prevent context overflow
- **Sphinx Documentation**: Bilingual documentation site with GitHub Pages deployment
