# 数据库（MySQL）

关系型数据都在 MySQL 里，通过 Drizzle 访问。原来的本地 SQLite 已经不再支持：换机器或换部署方式时，SQLite 文件跟着容器卷走，容易丢数据。

工作区文件、Hugging Face 数据集缓存等不是关系型数据，仍在卷 `innobuddy-data`（容器内 `/app/data`）和 `HOST_WORKSPACE_PATH` 里，备份时要一起考虑。

## 连接配置

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 必填。`mysql://用户:密码@主机:3306/库名`。密码里有 `@`、`:`、`/` 等字符时要做 URL 编码 |
| `DATABASE_POOL_SIZE` | 可选，连接池大小，默认 `10` |

`DATABASE_URL` 不是 `mysql://` 开头时，应用和容器入口脚本都会直接报错退出。旧的 SQLite 文件路径不会再被接受。

要求 MySQL 8.0.13 及以上（列默认值用了表达式）。首个迁移会把库的默认排序规则改成 `utf8mb4_bin`，所以账号需要对该库有 `ALTER` 权限。

## 线上：腾讯云 MySQL

线上用的是腾讯云 MySQL，和应用所在的 CVM 在同一个 VPC，只走内网，没有开外网地址。实例的内网地址、账号和密码不写进仓库。

把连接串放进线上环境：

1. 在虚拟机的 `.env.docker.online` 里加一行 `DATABASE_URL=mysql://...`。
2. 用 `scripts/ssm-env.sh publish` 把它和其他秘钥一起封进 SSM，并提交更新后的 `config/secrets/docker.online.env`（里面只会是 `DATABASE_URL=ssm:DATABASE_URL`）。`DATABASE_URL` 已经在脚本的秘钥白名单里。

在 `config/secrets/docker.online.env` 里写 `DATABASE_URL=ssm:DATABASE_URL` 之前，SSM 里必须已经有这个值，否则线上启动脚本取不到秘钥会失败。

腾讯云 MySQL 自带自动备份，在控制台的「备份恢复」里查看和恢复。

## 本地开发

本地 Docker：`docker-compose.local.yml` 会顺带起一个 MySQL 8.0 容器（卷 `innobuddy-mysql`，不映射到宿主机端口）。`.env.docker.local` 里没写 `DATABASE_URL` 时，应用自动连这个容器。想连别的库，就在 `.env.docker.local` 里写 `DATABASE_URL`。

宿主机上跑单元测试不需要数据库，测试里会 mock 掉。想连真实 MySQL 跑集成测试：

```bash
TEST_DATABASE_URL=mysql://user:password@127.0.0.1:3306/innoclaw_test npm test
```

- 每个测试文件会删掉并重建自己的库 `<库名>_<后缀>`，账号需要对 `<库名>_%` 有建库和删库权限。
- 库名里必须带 `test`，防止误删正式数据。
- 不设 `TEST_DATABASE_URL` 时，这些集成测试会被跳过。

## 迁移

- 表结构以 `src/lib/db/schema.ts` 为准。改完后执行 `npx drizzle-kit generate`，提交 `drizzle/` 下新生成的文件。
- 应用启动时会自动执行未执行过的迁移。多个实例同时启动时，用 MySQL 的 `GET_LOCK` 保证只有一个在跑迁移。
- `drizzle/0000_init_mysql.sql` 是 MySQL 的基线迁移。以前的 SQLite 迁移已经删除，需要的话可以在 git 历史里找到。

写表结构时注意：

- 要建索引、做主键或外键的字符串列用 `varchar`。MySQL 不能给不限长度的 `TEXT` 建索引。正文和 JSON 用 `longtext`。
- `longtext` 列不能写字面量默认值，要写成 `sql\`('')\``。
- 约束和索引名最长 64 个字符。Drizzle 自动生成的外键名可能超长，这时用 `foreignKey({ name })` 指定一个短名字。
- 时间列沿用 SQLite 时期的字符串格式。默认值是 UTC 的 `YYYY-MM-DD HH:MM:SS`；代码写入的大多是 ISO 字符串。
- 排序规则是 `utf8mb4_bin`：相等比较和唯一索引区分大小写（和 SQLite 一样），`LIKE` 也区分大小写。需要不区分大小写的模糊匹配时，用 `src/lib/db/sql-helpers.ts` 里的 `likeIgnoreCase`。
- MySQL 不支持 `RETURNING`。插入或更新后需要拿到整行时，再查一次。唯一冲突用 `src/lib/db/errors.ts` 里的 `isUniqueConstraintError` 判断。

## 把旧 SQLite 数据搬到 MySQL

只需要做一次。脚本会：

- 先在目标库上执行迁移；
- 目标表里已经有数据时拒绝执行；
- 在一个事务里复制两边都有的表和列，最后逐表核对行数；
- 跳过对应文本块已被删除的向量。

SQLite 文件以只读方式打开，不会被修改。

1. 停掉应用，先备份 SQLite 文件和卷 `innobuddy-data`。
2. 在仓库目录里安装依赖（脚本要用开发依赖里的 `better-sqlite3` 和 `tsx`），先 `--dry-run` 看一眼要复制多少行：

   ```bash
   npm ci
   DATABASE_URL='mysql://...' npx tsx scripts/migrate-sqlite-to-mysql.ts --sqlite /path/to/innobuddy.db --dry-run
   DATABASE_URL='mysql://...' npx tsx scripts/migrate-sqlite-to-mysql.ts --sqlite /path/to/innobuddy.db
   ```

   线上虚拟机只装了 Docker 时，可以起一个临时的 Node 容器来跑。下面的命令把卷里的 `innobuddy.db` 挂进去：

   ```bash
   docker run --rm -it -v "$PWD":/src -v innobuddy_innobuddy-data:/data:ro -w /src \
     -e DATABASE_URL='mysql://...' docker.m.daocloud.io/library/node:24 \
     sh -c 'npm ci && npx tsx scripts/migrate-sqlite-to-mysql.ts --sqlite /data/innobuddy.db'
   ```

   卷的实际名字用 `docker volume ls` 确认。
3. 每张表都输出 `ok` 后，再用新版本启动应用。

旧库里如果有两条工作区记录的路径相同，唯一索引会让复制失败并整体回滚，需要先在 SQLite 里处理掉重复的记录。
