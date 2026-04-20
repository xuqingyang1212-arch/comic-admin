# 数据库迁移策略

## 当前做法（开发/测试默认）

- **Schema（表结构）**：由 `backend/internal/model/db.go` 中的 `DB.AutoMigrate(...)` 在服务启动时自动维护。
- **基线数据（Seed）**：`001_init.up.sql` 通过手动执行创建默认超级管理员账户、角色以及全部权限授权。
- **历史 Seed 文件**：`002_seed_data.up.sql.deprecated` 已失效（对应旧数据模型，不要执行）。

## 文件命名规则

本目录遵循 [`golang-migrate`](https://github.com/golang-migrate/migrate) 约定，便于未来切换：

```
NNN_<description>.up.sql     # 正向迁移
NNN_<description>.down.sql   # 回滚迁移
```

- `NNN` 为三位递增序号（001、002、003…）。
- 新增变更时同时创建 `.up.sql` 和 `.down.sql` 两个文件。

## 手动执行基线

首次部署时（数据库尚未存在）：

```bash
# 1. 创建数据库（或直接启动后端，AutoMigrate 会建表）
mysql -u<user> -p<password> -e "CREATE DATABASE IF NOT EXISTS comic_admin DEFAULT CHARACTER SET utf8mb4;"

# 2. 启动后端，让 AutoMigrate 建好表
./comic-admin   # 观察日志里的 "Database connected and migrated successfully"

# 3. 导入默认超管
mysql -u<user> -p<password> comic_admin < migrations/001_init.up.sql
```

## 未来切换到纯 golang-migrate（可选）

当需要严格版本化（例如上线后每次上线都可审计、可回滚）时，按以下步骤切换：

1. 安装 CLI：
   ```bash
   brew install golang-migrate   # macOS
   # 或
   go install -tags 'mysql' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
   ```

2. 将 `AutoMigrate` 产出的当前 Schema dump 为 `002_schema_baseline.up.sql`：
   ```bash
   mysqldump -u<user> -p<password> --no-data --skip-comments --skip-add-locks \
             comic_admin > migrations/002_schema_baseline.up.sql
   ```

3. 为 baseline 提供回滚：
   ```sql
   -- 002_schema_baseline.down.sql
   DROP TABLE IF EXISTS download_tasks, review_audit_logs, review_opinions,
                        review_tasks, task_delivery_files, task_deliveries,
                        production_tasks, comic_episodes, comics,
                        script_drafts, scripts, books,
                        registration_requests, user_roles, role_permissions,
                        roles, users;
   ```

4. 在 `model/db.go` 里用环境变量或启动参数屏蔽 `AutoMigrate`，改为：
   ```bash
   migrate -path backend/migrations -database "mysql://user:pass@tcp(host:3306)/comic_admin" up
   ```

5. 之后每次改表都新增一对 `NNN_xxx.up.sql / .down.sql`，不再改动 Go 模型映射 DDL。

## 为什么现阶段不强制切换

- 项目尚未上线，无生产数据；AutoMigrate 在纯增量字段/索引场景下安全且幂等。
- 引入 `golang-migrate` 会在部署流水线里多一个步骤和一个外部二进制依赖。
- 目录格式已按 `golang-migrate` 约定，未来切换时零摩擦。
