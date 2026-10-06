# Seven戚 · 社区

纯静态多页应用（MPA）。前端零框架、零构建依赖，后端使用 Supabase（Postgres + Auth + Realtime）。

仓库：<https://github.com/SevenSeven712/liuyanban>
线上：<https://sevenseven712.github.io/liuyanban/>

---

## 一、目录结构

```
.
├── app/                        站点源码（10 个文件，UI 源码，勿直接改动路径）
│   ├── index.html              登录 / 注册
│   ├── posts.html              帖子广场（含管理员面板）
│   ├── profile.html            个人中心（消息中心 / 反馈 / 网站管理）
│   ├── room.html               语音房 + 5 款游戏
│   ├── messages.html           留言板
│   ├── new-post.html           发帖
│   ├── user.html               用户主页
│   ├── chats.html              聊天群
│   ├── common.js               全局运行时
│   └── gomoku.js               五子棋模块
│
├── scripts/
│   ├── build.mjs               构建脚本（零依赖）
│   └── apply-schema.mjs        自动建表执行器（零依赖）
│
├── db/
│   ├── schema.sql              完整建表脚本（幂等）
│   └── rls-hardening.sql       可选：行级安全加固（不参与自动化）
│
├── .github/workflows/
│   ├── deploy.yml              构建 → 自动建表 → 部署 Pages
│   └── database.yml            手动触发的建表维护
│
└── dist/                       构建产物（不入库，由 Actions 生成）
```

---

## 二、本地开发

无需安装任何依赖，Node 18+ 即可：

```bash
# 构建
node scripts/build.mjs

# 用任意静态服务器预览 dist/
npx serve dist
# 或直接双击 dist/index.html（构建产物使用相对路径，可离线打开）
```

修改了 `app/` 下的文件后重新执行构建即可。**`app/` 内的 UI 源码保持原样**，路径改写只在构建期发生。

---

## 三、GitHub Pages 上线（一次性设置）

1. 打开仓库 **Settings → Pages**
2. **Build and deployment → Source** 选择 **GitHub Actions**
3. 推送到 `main` 分支，流水线会自动运行

---

## 四、配置 Actions 变量（自动建表）

进入仓库 **Settings → Secrets and variables → Actions**。

### 4.1 Secrets（机密）

| 名称 | 必填 | 说明 |
|---|:---:|---|
| `SUPABASE_ACCESS_TOKEN` | 二选一 | Supabase 个人访问令牌，**推荐方式** |
| `DATABASE_URL` | 二选一 | Postgres 直连串，备用通道 |

**获取 `SUPABASE_ACCESS_TOKEN`：**
1. 打开 <https://supabase.com/dashboard/account/tokens>
2. 点 **Generate new token**，输入名称后生成
3. 复制生成的 `sbp_xxx` 字符串

**获取 `DATABASE_URL`（备用）：**
项目 → **Connect** → 选择 **Session pooler** → 复制 URI，把 `[YOUR-PASSWORD]` 换成数据库密码。

### 4.2 Variables（非机密）

| 名称 | 必填 | 说明 | 示例 |
|---|:---:|---|---|
| `SUPABASE_PROJECT_REF` | 是 | 项目 ID，即项目地址中 `https://____.supabase.co` 的下划线部分 | `ulvhuqtpdafspbdvkogs` |
| `SUPABASE_URL` | 否 | 覆盖前端连接的项目地址；留空则沿用源码默认值 | `https://ulvhuqtpdafspbdvkogs.supabase.co` |
| `SUPABASE_ANON_KEY` | 否 | 覆盖前端 anon key；留空则沿用源码默认值 | `sb_publishable_xxx` |
| `BASE_PATH` | 否 | 资源路径前缀；**留空 = 相对路径，推荐** | 留空或 `/liuyanban/` |

> 说明：anon key 本就是公开密钥，放在 Variables 而非 Secrets 是有意为之。
> 若暂时不想接新项目，`SUPABASE_URL` / `SUPABASE_ANON_KEY` 留空即可，
> 构建会沿用 `app/` 中的默认值，流水线照常成功。

### 4.3 建表行为

| 情况 | 行为 |
|---|---|
| 配了 `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` | 走 Management API 执行 `db/schema.sql` |
| 只配了 `DATABASE_URL` | 走 psql 直连执行 |
| 都没配 | **打印提示并跳过，不阻塞站点部署** |

建表脚本是**幂等**的，重复执行不会覆盖已有数据，也不会破坏线上表。
建表 job 设有 `continue-on-error`，即便建表失败，站点依然会正常发布。

修改表结构后想立即生效：**Actions → 数据库维护 → Run workflow**（可勾选 dry_run 先预览）。

---

## 五、流水线说明

```
push 到 main
      │
      ├─ job: build ──────── node scripts/build.mjs → dist/
      │                          ↓
      ├─ job: database ───── db/schema.sql  （失败仅告警，不阻塞）
      │
      └─ job: deploy ←────── 等待 build（continue-on-error 不传递失败）
```

- **build**：路径改写 + 凭据注入 + 自检，任何残留 `/liuyanban/` 绝对路径都会让构建失败
- **deploy** 只依赖 **build**，所以建表失败不影响站点发布

---

## 六、技术要点

### 6.1 路径改写

源码沿用旧部署路径 `/liuyanban/`，构建期统一改写为 `./`。
产物因此可以放在任意域名、任意子路径，甚至直接本地双击打开，无需二次构建。

生成侧与查询侧同步改写，页脚高亮匹配不会失效：

```js
// 生成
{ id: 'chats', href: './chats.html' }
// 查询
footerContainer.querySelector('a[href="./chats.html"]')
```

### 6.2 数据库

19 张业务表，覆盖用户、帖子、评论、分类、投票、留言、聊天、通知、举报、角色、关注、反馈、设备注册、房间、房间消息、五子棋对局。

- 所有建表语句均为 `create table if not exists`，可反复执行
- Realtime 发布表在脚本中按表逐个判断后加入，幂等
- 默认**不启用 RLS**，与现有线上库行为一致
- 收紧权限见 `db/rls-hardening.sql`（需手工评估后执行，不参与自动化）

### 6.3 管理员

沿用原有逻辑：手机号等于 `17355394710` 即为管理员，散落在 10 个源文件中。
若要改为角色表驱动，需要同步改造前端判定与 RLS 策略，属独立改造项。
