# InnoClaw 开源发布计划

## 项目概况

- **名称**: InnoClaw
- **定位**: 可自托管的 AI 研究助手，灵感来自 Google NotebookLM
- **技术栈**: Next.js 16 + React 19 + TypeScript 5.9 + SQLite (Drizzle ORM) + Vitest
- **许可证**: Apache 2.0
- **当前版本**: 0.1.0
- **新仓库地址**: https://github.com/zjowowen/InnoClaw

---

## 已完成事项

| # | 事项 | 文件 |
|---|------|------|
| 1 | 安全审计（git 历史无密钥泄露、无硬编码内部 IP） | — |
| 2 | .gitignore 修正（移除 opensource/ 忽略） | `.gitignore` |
| 3 | 添加 Apache 2.0 许可证 | `LICENSE` |
| 4 | 补全 package.json 元数据 | `package.json` |
| 5 | 添加行为准则 | `CODE_OF_CONDUCT.md` |
| 6 | 添加安全策略 | `SECURITY.md` |
| 7 | 添加应用 CI 工作流（lint + test + build） | `.github/workflows/ci.yml` |
| 8 | 添加 Bug 报告模板 | `.github/ISSUE_TEMPLATE/bug_report.yml` |
| 9 | 添加功能请求模板 | `.github/ISSUE_TEMPLATE/feature_request.yml` |
| 10 | 添加 Issue 模板配置 | `.github/ISSUE_TEMPLATE/config.yml` |
| 11 | 添加 PR 模板 | `.github/PULL_REQUEST_TEMPLATE.md` |
| 12 | 添加变更日志 | `CHANGELOG.md` |
| 13 | 创建发布检查清单 | `opensource/RELEASE_CHECKLIST.md` |
| 14 | 创建发布计划 | `opensource/RELEASE_PLAN.md`（本文件） |

---

## 待办事项

1. ~~**更新所有仓库 URL**~~ ✅ 已完成
2. ~~**Git 历史清理**~~ ✅ 已验证无敏感信息
3. ~~**创建新仓库**~~ ✅ https://github.com/zjowowen/InnoClaw
4. ~~**推送代码到新仓库**~~ ✅ 已推送 main 分支
5. ~~**创建 git tag `v0.1.0`**~~ ✅ 已创建并推送
6. ~~**创建 GitHub Release**~~ ✅ https://github.com/zjowowen/InnoClaw/releases/tag/v0.1.0
7. **配置 GitHub Pages 和 branch protection** — 需在仓库 Settings 中手动操作
8. **旧仓库添加迁移说明**

---

## 后续迭代路线图

### v0.2.0（计划）
- [ ] Docker 支持（Dockerfile + docker-compose.yml）
- [ ] 自动发布工作流（GitHub Releases）
- [ ] 代码覆盖率集成
- [ ] README 徽章（License / CI / Node.js 版本）

### 文档（持续）
- [ ] 完善文档体系（当前开发中）
- [ ] 文档站点在新 URL 部署

---

## 项目原有优势（无需额外工作）

- README.md：双语（中/英），502 行，含完整快速开始指南
- .env.example：80 行，覆盖所有环境变量
- 贡献指南：`docs/development/contributing.md`
- 文档体系：15 个 Sphinx 文档文件，双语，CI 自动部署
- 测试：12 个 Vitest 测试文件
- TypeScript strict mode + ESLint
- i18n：next-intl 中英双语支持
