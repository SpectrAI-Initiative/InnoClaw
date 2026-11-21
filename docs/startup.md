# 启动说明

InnoClaw 只通过 Docker 启动。镜像是 Ubuntu Server 24.04 LTS 64 位。可提交的是 `config/secrets/` 里的两份配置，其中的秘钥只保存腾讯云 SSM 引用。`.env.docker.local` 和 `.env.docker.online` 由启动脚本生成，不要提交。

| 环境 | 配置文件 | 启动 | 访问 |
|------|----------|------|------|
| 本地 | `.env.docker.local` | Windows：`.\scripts\docker-up-local.ps1`；Ubuntu：`./scripts/docker-up-local.sh` | http://127.0.0.1:3000 |
| 线上 | `.env.docker.online` | `./scripts/docker-up-online.sh` | http://&lt;虚拟机IP&gt;:3000 |

## 本地

在仓库根目录执行：

```powershell
.\scripts\docker-up-local.ps1
```

Ubuntu 本机：

```bash
chmod +x scripts/docker-up-local.sh
./scripts/docker-up-local.sh
```

仓库里已有 `config/secrets/docker.local.env` 时，启动脚本会用腾讯云凭据管理把 `AUTH_SECRET` 和 `DEEPSEEK_API_KEY` 取回，写入 `.env.docker.local`。解密凭据来自环境变量 `TENCENTCLOUD_SECRET_ID`、`TENCENTCLOUD_SECRET_KEY`，否则读取桌面上的 `SecretKey.csv`。不要把这组 API 密钥写进仓库。浏览器打开 http://127.0.0.1:3000。

两份环境文件的配置项相同。本地和线上可以填不同的值。

本地端口只绑定 `127.0.0.1`，端口号来自 `PUBLISH_PORT`。工作区目录默认是仓库里的 `./workspace`，容器内路径是 `/research`。线上把同一端口发布到虚拟机网卡。

停止：

```powershell
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose.local.yml down
```

## 线上

在 Ubuntu 虚拟机上安装 Docker Engine 24+ 和 Compose v2，把仓库放到虚拟机后执行：

```bash
chmod +x scripts/docker-up-online.sh
./scripts/docker-up-online.sh
```

仓库里已有 `config/secrets/docker.online.env` 时，启动脚本会从 SSM 凭据 `innoclaw-docker-online` 取回秘钥并写入 `.env.docker.online`。虚拟机上需要能调用 SSM 的腾讯云 API 密钥。没有这份密封配置时，第一次运行会生成 `.env.docker.online`。至少填写：

- `DEEPSEEK_API_KEY`
- `HOST_WORKSPACE_PATH`：虚拟机上的目录，默认 `/data/innoclaw/research`
- `PUBLISH_PORT`：默认 `3000`

改完后再执行一次启动脚本。浏览器打开 `http://<虚拟机IP>:3000`。

当前按明文 HTTP 部署，`AUTH_COOKIE_SECURE` 保持 `false`。前面加上 HTTPS 之后，再把它改成 `true`。

停止：

```bash
docker compose --env-file .env.docker.online -f docker-compose.yml -f docker-compose.online.yml down
```

## 文档分别看哪里

| 要做的事 | 看 |
|----------|----|
| 启动、停止 | 本页 |
| 数据卷、备份、升级、容器日志 | `docs/docker.md` |
| HTTPS、登录限流、管理员账号 | `docs/getting-started/deployment.md` |
| 变量全表 | `docs/getting-started/environment-variables.md` |
| 改代码 | 仓库根目录 `AGENTS.md` |

英文文档站的安装页是 `docs/getting-started/installation.md`，步骤和本页相同。

## 验证记录

2026-11-21 本地容器启动后：

- http://127.0.0.1:3000 返回 200，并进入登录页
- 注册账号后进入工作区
- 智能体对话「1+1等于几？」返回「1+1 等于 2。」
- 请求日志为 `provider=deepseek model=deepseek-v4.1-flash`
