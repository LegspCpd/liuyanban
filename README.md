# Seven戚 · 社区

纯静态多页应用（MPA）。前端零框架、零构建依赖，后端使用 Supabase（Postgres + Auth + Realtime），
**数据库层同时兼容 Neon**，两者可独立部署也可共存。

仓库：<https://github.com/LegspCpd/liuyanban>
线上：<https://legspcpd.github.io/liuyanban/>

---

## 一、目录结构

```
.
├── app/                        站点源码（UI 源码，勿直接改动路径）
│   ├── index.html              登录 / 注册
│   ├── posts.html              帖子广场（含管理员面板）
│   ├── profile.html            个人中心（消息中心 / 反馈 / 网站管理）
│   ├── room.html               语音房 + 5 款游戏
│   ├── messages.html           留言板
│   ├── new-post.html           发帖
│   ├── user.html               用户主页
│   ├── chats.html              聊天群
│   ├── gomoku.js               五子棋模块
│   │
│   └── core/                   分层核心层（按依赖顺序加载）
│       ├── config.js           L0 配置：凭据、管理员、路径（构建期可注入）
│       ├── util.js             L1 纯工具：转义、头像、JSON 安全解析
│       ├── ui.js               L2 UI：Toast、确认框、输入框、图标、横幅、提示音
│       ├── session.js          L3 会话与认证：本地缓存 + Supabase Auth
│       ├── data.js             L4 数据访问：后端客户端唯一持有者
│       ├── mods.js             L5 业务：举报、通知、未读、封禁监听与横幅
│       ├── shell.js            L6 外壳：顶部品牌栏、底部导航栏
│       └── boot.js             L7 启动：加载动画、会话校验、Presence、封号监听
│
├── scripts/
│   ├── build.mjs               构建脚本（零依赖；同时输出 dist/core/ 与合并版 dist/core.js）
│   └── apply-schema.mjs        自动建表执行器（零依赖，支持 Supabase / Neon）
│
├── db/
│   ├── schema.core.sql         通用 Postgres：19 表 + 索引 + 种子数据（幂等）
│   ├── schema.supabase.sql     Supabase 专属：Realtime 发布 + avatars 存储桶
│   ├── schema.neon.sql         Neon 专属：逻辑复制校准 + Auth 对接说明
│   └── rls-hardening.sql       可选：行级安全加固（不参与自动化）
│
└── .github/workflows/
    ├── deploy.yml              构建 → 自动建表 → 部署 Pages
    └── database.yml            手动触发的建表维护（可选平台 / dry_run）
```

---

## 二、本地开发

无需安装任何依赖，Node 18+ 即可：

```bash
node scripts/build.mjs          # 构建到 dist/
npx serve dist                  # 本地预览
# 或直接双击 dist/index.html（产物使用相对路径，可离线打开）
```

---

## 三、GitHub Pages 上线（一次性设置）

1. 仓库 **Settings → Pages**
2. **Build and deployment → Source** 选择 **GitHub Actions**
3. 推送到 `main` 分支，流水线自动运行

---

## 四、数据库：Supabase 与 Neon 双兼容

### 4.1 为什么能共用一套 SQL

Neon 是标准 PostgreSQL，`schema.core.sql` 里的建表语句两边都能直接跑。
差异只集中在两处 **Supabase 专属对象**，因此被单独拆出并加了存在性守卫：

| 段 | 文件 | Supabase | Neon |
|---|---|:---:|:---:|
| 19 张表 + 17 个索引 + 种子数据 | `schema.core.sql` | ✅ | ✅ |
| `supabase_realtime` 发布表 | `schema.supabase.sql` | ✅ | 跳过 |
| `storage.buckets`（头像） | `schema.supabase.sql` | ✅ | 跳过（无 storage schema） |
| `wal_level = logical` 校准 | `schema.neon.sql` | 跳过 | ✅ |

### 4.2 选择目标平台

仓库 **Settings → Secrets and variables → Actions → Variables**：

| 名称 | 值 | 说明 |
|---|---|---|
| `DB_PROVIDER` | `supabase` 或 `neon` | 决定自动建表连哪个库。**留空默认 supabase** |

### 4.3 Secrets

**Supabase**（`DB_PROVIDER=supabase` 时使用，二选一即可）：

| 名称 | 说明 |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | 个人访问令牌，<https://supabase.com/dashboard/account/tokens> 生成，**推荐** |
| `SUPABASE_PROJECT_REF` | 放进 Variables：项目地址中 `https://____.supabase.co` 的那串 ID |
| `DATABASE_URL` | 备选，项目 → Connect → Session pooler 复制的 URI |

**Neon**（`DB_PROVIDER=neon` 时使用）：

| 名称 | 说明 |
|---|---|
| `NEON_DATABASE_URL` | Neon 控制台 → Connect 里的 **pooled connection string**，**推荐** |
| `NEON_PROJECT_ID` | 放进 Variables：形如 `ep-cool-name-123456` |
| `NEON_API_KEY` | 备选，Neon API key |

### 4.4 两个平台同时配置

Supabase 与 Neon 的变量互不冲突，可以**同时填好**，用 `DB_PROVIDER` 切换。
不改前端也能对 Neon 建表；已建好的 Neon 库可直接用 Neon 的 `psql` /
`neon` CLI 连接使用。

### 4.5 老库直接复用（原作者免重装）

如果手里已经有一个跑着的老库（比如原作者的库），**不用导数据、不用重装**，按下面三步接上即可：

1. 把老库的连接信息填进 Actions Secrets（Supabase 用 `DATABASE_URL`，Neon 用 `NEON_DATABASE_URL`）
2. 跑一次流水线（自动）或手动触发「数据库维护」——`schema.core.sql` 全是 `if not exists`，**不会覆盖已有数据**；垫后的 `db/schema.compat.sql` 会自动补齐：
   - `rooms.mute_all` 列（全员禁言功能依赖，缺则 500）
   - `reports` 审核字段（`reviewed_by/at`、`measure`、`ban_days`、`admin_note`）
   - Realtime 发布里缺失的表（含新增的 `reports` / `notifications` / `feedback`）
   - 关掉「开了 RLS 却没有配套策略」的表（这种表 anon key 会被静默挡掉，页面看起来就是数据过不来）
   - 补 `avatars` 存储桶
3. 前端自带降级：老库还没跑补丁时，全员禁言切本地态、举报审核只改状态，**页面不炸**

### 4.6 前端说明（重要）

当前前端的 **登录、实时通信、文件上传仍然使用 Supabase**（`sb.auth` /
Realtime / Storage），这部分在 Neon 上没有对等实现，因此：

- ✅ 建表、部署、数据库运维：Supabase 与 Neon 都支持
- ⚠️ 若要让 **业务数据真正跑在 Neon**，需另做一轮改造：
  Neon [Data API](https://neon.com/docs/data-api/overview) 完全兼容 PostgREST，
  查询层只需换连接串；但 Auth 需接 Neon Managed Better Auth 或自建，
  Realtime 需降级为轮询（房间页已有 1 秒 gameTick 心跳可复用），
  文件需换 Neon Object Storage 的签名 URL。

---

## 五、构建期可覆盖的前端配置

| 名称（Variables） | 说明 |
|---|---|
| `SUPABASE_URL` | 覆盖前端连接的项目地址；留空沿用源码默认值 |
| `SUPABASE_ANON_KEY` | 覆盖 anon key；留空沿用源码默认值 |
| `BASE_PATH` | 资源路径前缀；**留空 = 相对路径，推荐** |

> anon key 本就是公开密钥，放 Variables 而非 Secrets 是有意为之。
> 留空时构建依然成功，沿用 `app/` 中的默认值。

---

## 六、流水线结构

```
push 到 main
      │
      ├─ build ──────── node scripts/build.mjs → dist/
      │
      ├─ database ──── db/schema.*.sql   （continue-on-error，不阻塞部署）
      │
      └─ deploy ←───── needs: build
```

- **build**：路径改写 + 凭据注入 + 自检，产物中残留 `/liuyanban/` 会直接失败
- **database**：未配置凭据时打印提示并以 0 退出，**不会卡住部署**
- **deploy**：只依赖 build，建表失败也能正常发布站点

手动维护数据库：**Actions → 数据库维护 → Run workflow**，可选平台并支持 dry_run。

---

## 七、技术要点

### 7.1 路径改写

源码沿用旧部署路径 `/liuyanban/`，构建期统一改写为 `./`。
产物因此可放在任意域名、任意子路径，甚至本地双击打开。
生成侧与查询侧同步改写，页脚高亮匹配不会失效：

```js
{ id: 'chats', href: './chats.html' }          // 生成
footerContainer.querySelector('a[href="./chats.html"]')  // 查询
```

### 7.2 管理员

沿用原有逻辑：手机号等于 `17355394710` 即为管理员，散落在 10 个源文件中。
改为角色表驱动需同步改造前端判定与 RLS 策略，属独立改造项。
