# 漫剧运营后台

> B 端漫剧内容运营管理系统 — 覆盖书籍管理、剧本创作 / 审核、漫剧制作 / 审核、下载分发、用户与权限管理的全流程业务后台。

前端 Next.js 16 + React 19，后端 Go + Gin + MySQL，前后端分离 + JWT 鉴权 + 细粒度按钮级权限控制。

---

## 一、技术栈

### 前端

| 类别 | 选型 |
|---|---|
| 框架 | Next.js **16.2.0**（App Router, Turbopack） |
| UI 库 | React **19.2.4** + TypeScript **5.7.3**（strict） |
| 样式 | Tailwind CSS **4.2** + `tw-animate-css` + PostCSS（`@tailwindcss/postcss`） |
| 组件 | shadcn/ui（new-york 风格，neutral 基色） + Radix UI + Lucide Icons |
| 表单 | `react-hook-form` + `zod` |
| 工具 | `clsx` + `tailwind-merge`（`cn()`）、`date-fns`、`recharts`、`sonner`（Toast） |
| 路径别名 | `@/*` → 项目根目录 |

### 后端

| 类别 | 选型 |
|---|---|
| 语言 | Go **1.22+** |
| Web 框架 | Gin **1.10** |
| ORM | GORM **1.25** + MySQL Driver |
| 鉴权 | JWT（HS256, `golang-jwt/jwt/v5`） |
| 跨域 | `gin-contrib/cors` |
| 存储 | 本地文件系统 / 腾讯云 COS（可选） |
| 配置 | `yaml.v3`（`config.yaml`） |

### 数据库

- **MySQL 8.0**，数据库名 `comic_admin`，字符集 `utf8mb4`
- 表结构由 `model/db.go` 中的 `AutoMigrate` 在服务启动时自动维护，基线数据（管理员、角色、权限）通过 `migrations/*.sql` 手动导入

---

## 二、项目结构

```
漫剧运营后台/
├── app/                    # Next.js App Router（仅 / 与 /login 为真实路由）
│   ├── layout.tsx          # 根布局（HTML shell、metadata、全局 Toast）
│   ├── page.tsx            # 首页 -> <AdminLayout />（SPA 主框架）
│   ├── login/              # 登录页
│   ├── register/           # 注册页
│   ├── forgot-password/    # 忘记密码
│   └── globals.css         # 全局样式
├── components/             # 业务组件 + UI 基础组件
│   ├── admin-layout.tsx    # 主框架（认证 / 权限 / 菜单 / SPA 路由切换）
│   ├── sidebar.tsx         # 侧边栏导航
│   ├── header.tsx          # 顶部栏
│   ├── content-area.tsx    # 内容区（按 selectedKey 动态加载业务组件）
│   ├── book-management.tsx       # 书籍管理
│   ├── script-management.tsx     # 剧本管理
│   ├── script-creation.tsx       # 剧本创作（草稿）
│   ├── script-editor.tsx         # 剧本编辑器
│   ├── script-review.tsx         # 剧本审核
│   ├── comic-management.tsx      # 漫剧管理
│   ├── task-hall.tsx             # 漫剧制作 - 任务大厅
│   ├── my-task.tsx               # 漫剧制作 - 我的任务
│   ├── draft-review.tsx          # 漫剧审核
│   ├── download-center.tsx       # 下载中心
│   ├── register-review.tsx       # 注册审核
│   ├── user-management.tsx       # 用户管理
│   ├── role-management.tsx       # 角色管理
│   ├── shared/             # 业务共用组件（筛选器 / 状态徽章 / 时间线 / 抽屉…）
│   └── ui/                 # shadcn/ui 基础组件（57 个）
├── hooks/                  # 自定义 hooks（use-filters / use-pagination …）
├── lib/
│   ├── api.ts              # HTTP 客户端 + 全部 API 接口
│   ├── api-client.ts       # 底层 fetch 封装
│   ├── permissions.ts      # 菜单 ↔ 权限映射 + usePerm()
│   ├── constants.ts        # 全局常量
│   ├── types.ts            # 全局类型
│   └── utils.ts            # cn() 等工具
├── public/                 # 静态资源
├── styles/                 # 样式
├── types/                  # 类型补丁
├── backend/                # Go 后端
│   ├── cmd/server/         # 入口（main.go）
│   ├── cmd/seed/           # 基线数据填充
│   ├── config.yaml(.example)  # 运行时配置（含 secrets，已 .gitignore）
│   ├── internal/
│   │   ├── config/         # 配置类型 + DSN 构造
│   │   ├── consts/         # 业务常量
│   │   ├── handler/        # HTTP 处理器（router / auth / user / role / book /
│   │   │                   #   script / script_draft / script_audit /
│   │   │                   #   production_task / comic / comic_review /
│   │   │                   #   download / upload …）
│   │   ├── middleware/     # JWT / 加载权限 / 权限校验
│   │   ├── model/          # GORM 模型 + AutoMigrate
│   │   ├── service/        # 业务服务层
│   │   └── pkg/            # response / pagination / cos / idgen / wordcount
│   ├── migrations/         # SQL 迁移脚本（基线数据 + 权限重构）
│   └── uploads/            # 本地上传根目录（封面 / 视频 / ZIP 打包文件）
├── ARCHITECTURE.md         # 完整技术架构文档
├── 漫剧运营后台-PRD-v1.0.md  # 产品需求文档
├── components.json         # shadcn/ui 配置
├── next.config.mjs
├── tsconfig.json
└── package.json
```

---

## 三、快速开始

### 1. 环境要求

- Node.js **20+**（推荐使用 `pnpm`，已提交 `pnpm-lock.yaml`）
- Go **1.22+**
- MySQL **8.0+**

### 2. 数据库初始化

```bash
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS comic_admin DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

启动后端时 `AutoMigrate` 会自动建表；首次部署再手动导入基线数据（默认超管账号、角色、权限）：

```bash
mysql -uroot -p comic_admin < backend/migrations/001_init.up.sql
mysql -uroot -p comic_admin < backend/migrations/003_permission_refactor.up.sql
mysql -uroot -p comic_admin < backend/migrations/004_downloadcenter_namespace.up.sql
```

> 默认超管：`admin@comic-admin.com`（无密码登录，邮箱即账号，详见后文「认证流程」）。

### 3. 启动后端

```bash
cd backend
cp config.yaml.example config.yaml   # 修改数据库 / JWT secret / 存储路径
go run ./cmd/server                   # 开发模式
# 或编译后运行
# go build -o comic-admin ./cmd/server && ./comic-admin
```

后端默认监听 `:8080`，API 前缀 `/api/v1`。

### 4. 启动前端

```bash
pnpm install            # 或 npm install
cp .env.local.example .env.local  # 如无示例文件，按下方模板创建
pnpm dev                # 或 npm run dev
```

前端默认监听 `0.0.0.0:3000`，访问 <http://localhost:3000>。

#### `.env.local` 模板

```
NEXT_PUBLIC_API_BASE=http://localhost:8080/api/v1
```

#### 局域网访问

如需在局域网内访问，把开发机 IP 加入 `next.config.mjs` 的 `allowedDevOrigins`，并放行 `3000` / `8080` 端口。

### 5. 常用脚本

```bash
pnpm dev      # 启动开发服务器（0.0.0.0:3000）
pnpm build    # 生产构建
pnpm start    # 运行生产构建
pnpm lint     # ESLint
```

---

## 四、功能模块

### 资源管理
- **书籍管理** — 小说书籍及全文内容（`books` 表，`content` 为 `longtext`）
- **剧本管理** — 已发布剧本库，支持发布制作任务 / 二创
- **漫剧管理** — 漫剧成品（按集组织，分有字幕 / 无字幕版本），支持发起成片修改
- **下载中心** — 漫剧 ZIP 打包下载（异步任务、72h 有效期、断点续传）

### 剧本创作
- **剧本创作** — 草稿态编辑器，支持自动字数统计，提交后流转到审核
- **剧本编辑** — 富文本 / 段落级编辑（基于 `script-editor.tsx`）

### 漫剧制作
- **任务大厅** — 制作员领取制作任务
- **我的任务** — 上传初版 / 终版 / 修改版交付物（封面图 + 视频 + 字幕等）

### 审核管理
- **剧本审核** — 大厅领取 + 我的审核（通过 / 驳回，附审核意见）
- **漫剧审核** — 初版 / 终版 / 修改版三段式审核（意见支持文字 + 图片）
- **注册审核** — 新用户注册申请审批

### 系统设置
- **用户管理** — 用户启用 / 禁用 + 角色分配
- **角色管理** — 角色 CRUD + 权限树勾选（45 个权限点）

---

## 五、角色与权限

### 角色

| 角色 | 权限数 | 范围 |
|---|---|---|
| 超级管理员 | 45（全部） | 所有模块 |
| 编剧 | 11 | 书籍管理 + 剧本管理（列表/详情/二创） + 剧本创作 |
| 制作员 | 11 | 漫剧制作全部 |
| 审核员 | 15 | 剧本管理（列表/详情/发布） + 剧本审核 + 漫剧审核 |
| 提审员 | 8 | 漫剧管理 + 漫剧审核 |

### 权限点（45 个，5 大模块）

- **资源管理 (12)** — `resource.book.*` / `resource.script.*` / `resource.comic.*` / `resource.downloadCenter.*`
- **剧本创作 (4)** — `scriptCreate.list/edit/delete/log`
- **漫剧制作 (11)** — `comicMake.hall.*` / `comicMake.my.*`
- **审核管理 (12)** — `audit.script.*` / `audit.comic.*`
- **系统设置 (6)** — `system.user.*` / `system.role.*`

### 控制方式

- **后端**：`JWTAuth` 中间件解析 token → `LoadPermissions` 把权限注入 context → 可选的 `RequirePerm` 中间件做路由级校验
- **前端**：
  - 页面级 — `lib/permissions.ts` 中的 `MENU_PERMISSION_MAP` 把菜单 key 映射为权限 key，`AdminLayout` 过滤侧边栏菜单；无权访问的 `selectedKey` 自动重定向到有权限的首个页面
  - 按钮级 — `usePerm(key)` hook 返回 boolean，用 `{canXxx && <Button />}` 控制按钮可见性

---

## 六、核心业务流程

```
编剧创作剧本草稿 → 提交审核 → 审核员审核
                                 ├─ 通过 → 剧本入库 → 发布制作任务
                                 │           ↓
                                 │       制作员领取 → 上传初版 → 初版审核
                                 │                                ├─ 通过 → 上传终版 → 终版审核
                                 │                                │                     ├─ 通过 → 漫剧入库上线
                                 │                                │                     └─ 驳回 → 重新上传终版
                                 │                                └─ 驳回 → 重新上传初版
                                 └─ 驳回 → 编剧修改后再次提交

漫剧上线后 → 可发起成片修改 → 上传修改版 → 修改版审核 → 通过则更新漫剧
```

### 审核任务设计要点

- 同一制作任务的每种审核类型（初版 / 终版 / 修改版）**只有一条** `ReviewTask`
- 驳回后重新提交 → 复用同一条记录，状态从「驳回修改」改回「审核中」
- 历史审核意见保留，不会因重新提交而丢失（`review_audit_logs` 保存意见快照）

### 下载打包流程

1. 用户触发下载 → 后端启动 goroutine 异步打包
2. 收集漫剧集数的所有文件，按命名规则建立目录
3. 生成 ZIP（Store 模式，不压缩，支持 ZIP64）
4. 存入 `uploads/downloads/`，记录 URL，72h 有效期
5. 前端通过 `/dl/*` 路由下载，支持 Range 请求（断点续传）

---

## 七、API 概览

统一响应格式：

```json
{ "code": 0, "message": "success", "data": {} }
```

分页接口：`data: { "total": 100, "list": [...] }`

主要接口分组（约 48 个）：

| 分组 | 路径前缀 | 数量 |
|---|---|---|
| 公开接口 | `/auth/login`、`/health` | 2 |
| 用户与角色 | `/users`、`/roles`、`/permissions/tree` | 6 |
| 书籍 | `/books` | 2 |
| 剧本草稿 | `/script-drafts` | 7 |
| 剧本审核 | `/script-audit` | 5 |
| 剧本库 | `/scripts` | 4 |
| 制作任务 | `/production-tasks` | 9 |
| 漫剧审核 | `/comic-review` | 5 |
| 漫剧 | `/comics` | 4 |
| 下载中心 | `/download` | 3 |
| 文件上传 | `/upload/presign`、`/upload/local/*` | 2 |
| 静态文件 | `/uploads/*`、`/dl/*` | 2 |

> 完整接口列表与字段定义见 [`ARCHITECTURE.md`](./ARCHITECTURE.md) 「五、API 接口设计」。

---

## 八、数据库

17 张表，核心 ER 关系：

```
users ─< user_roles >─ roles ─< role_permissions
books ─< scripts ─< production_tasks ─< task_deliveries ─< task_delivery_files
                              │
                              └─< review_tasks ─< review_opinions
                                       └─< review_audit_logs
comics ─< comic_episodes
comics ─< download_tasks
script_drafts ─< script_audit_logs
```

详细表清单与字段说明见 [`ARCHITECTURE.md`](./ARCHITECTURE.md) 「四、数据库设计」。

---

## 九、文件上传

```
浏览器 ──POST /upload/presign {fileName, fileType, scene}──> Go API
       <─ {uploadUrl, fileKey, fileUrl} ─

# COS 模式（config.yaml 中 cos.* 已配置）
浏览器 ──PUT {uploadUrl} (二进制流)──> 腾讯云 COS

# 本地模式（默认）
浏览器 ──PUT /upload/local/*key (二进制流)──> Go API ──> ./backend/uploads/
```

上传场景目录：

```
backend/uploads/
├── images/covers/      # 封面图
├── images/copyright/   # 版权证明
├── videos/drafts/      # 初版视频
├── videos/final/       # 终版视频
└── downloads/          # ZIP 打包文件
```

---

## 十、设计规范

项目内置严格的 UI 设计规范，所有业务页面需遵守，详见 `.cursor/rules/design-system.mdc`，要点：

- 颜色体系（品牌主色 `#38c08f`，配套语义色 / 中性灰阶）
- 字号、间距、圆角全部硬编码 `text-[Xpx]` / `rounded-[Xpx]`，禁止使用 Tailwind 语义字号类
- 列表页骨架：筛选区（流式布局，`flex flex-wrap gap-3`）+ 工具栏 + 表格区（仅此区域滚动）+ 分页区
- 表头 sticky、分页固定底部、行内容 `whitespace-nowrap`
- 按钮 / 状态徽章 / 输入框 / 下拉等基础组件统一封装在 `components/shared/`

---

## 十一、相关文档

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — 完整技术架构（系统图 / 数据库 / API / 权限 / 流程时序图）
- **[backend/migrations/README.md](./backend/migrations/README.md)** — 数据库迁移策略
- **`.cursor/rules/design-system.mdc`** — 前端设计规范（颜色 / 字号 / 布局 / 组件）

---

## 十二、约定

- 前端组件 / 业务页面均为 `"use client"` 组件，通过 `next/dynamic` 在 `content-area.tsx` 中懒加载（`ssr: false`），实现 SPA 式无刷新切换
- 业务页面文件命名 kebab-case，组件命名 PascalCase
- 后端 `config.yaml` 与 `backend/uploads/`、`backend/data/`、编译产物均已 `.gitignore`，不要提交
