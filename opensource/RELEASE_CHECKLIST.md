# InnoClaw 开源发布检查清单

> 发布前逐项确认，确保所有关键事项已完成。

---

## P0 — 发布阻断项

### 安全审计
- [x] 确认 `.env.local` 未曾提交到 git 历史
- [x] 搜索 git 历史中无泄露的 API key / token / 密码
- [x] 搜索代码中无硬编码的内部 IP 地址
- [ ] 使用 `git-filter-repo` 清理任何需要移除的敏感提交（如需要）
- [ ] 确认 `.env.local` 中的所有真实密钥已轮换（revoke & regenerate）

### 许可证与元数据
- [x] 添加 `LICENSE` 文件（Apache 2.0）
- [x] 更新 `package.json`：添加 description、repository、homepage、bugs、keywords、author、license、engines
- [x] 确认 `package.json` 中 repository/homepage/bugs URL 指向新仓库

### 仓库配置
- [x] `.gitignore` 移除 `opensource/` 忽略规则
- [x] 确定新仓库名称和 GitHub 组织 → `zjowowen/InnoClaw`
- [x] 更新 `docs/conf.py` 中的仓库 URL（第 48、56、60-61、70 行）
- [x] 更新 `README.md` 中的仓库 URL（git clone 地址、文档链接等）
- [x] 更新 `.github/ISSUE_TEMPLATE/config.yml` 中的 URL
- [x] 更新 `docs/` 下其他文件中的仓库 URL（contributing.md、faq.md、installation.md）
- [x] 更新 `docs/locales/` 翻译文件中的仓库 URL

---

## P1 — 重要项

### 治理文件
- [x] 添加 `CODE_OF_CONDUCT.md`（Contributor Covenant v2.1）
- [x] 添加 `SECURITY.md`（漏洞上报政策）

### CI/CD
- [x] 添加 `.github/workflows/ci.yml`（lint + test + build）
- [ ] 确认 CI 工作流在新仓库首次 push 后通过

### 社区模板
- [x] 添加 `.github/ISSUE_TEMPLATE/bug_report.yml`
- [x] 添加 `.github/ISSUE_TEMPLATE/feature_request.yml`
- [x] 添加 `.github/ISSUE_TEMPLATE/config.yml`
- [x] 添加 `.github/PULL_REQUEST_TEMPLATE.md`

### 版本管理
- [x] 添加 `CHANGELOG.md`（v0.1.0 初始版本）
- [x] 创建 git tag `v0.1.0`
- [x] 创建 GitHub Release（v0.1.0）→ https://github.com/zjowowen/InnoClaw/releases/tag/v0.1.0

---

## P2 — 后续迭代

### Docker 支持
- [ ] 创建 `Dockerfile`（多阶段构建）
- [ ] 创建 `docker-compose.yml`
- [ ] 创建 `.dockerignore`

### CI/CD 增强
- [ ] 添加自动发布工作流 `.github/workflows/release.yml`
- [ ] 集成代码覆盖率报告（Codecov 等）

### README 增强
- [ ] 添加 License 徽章
- [ ] 添加 CI Build Status 徽章
- [ ] 添加 Node.js 版本徽章

### 文档（持续开发中）
- [ ] 完善所有文档内容
- [ ] 确认文档站点在新 URL 正常部署

---

## 发布执行

- [x] 创建新 GitHub 仓库 → https://github.com/zjowowen/InnoClaw
- [x] 推送代码（含完整 git 历史）
- [ ] 配置 GitHub Pages（Settings → Pages → Source: GitHub Actions）
- [ ] 设置 branch protection rules（main 分支）
- [ ] 开启 GitHub Discussions（可选）
- [ ] 在旧仓库 README 添加迁移说明和新仓库链接
- [ ] 发布公告
