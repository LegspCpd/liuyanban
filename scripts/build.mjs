#!/usr/bin/env node
/**
 * ============================================================================
 *  静态站点构建脚本（零依赖，Node >= 18）
 * ============================================================================
 *
 *  职责：
 *    1. 清空并重建 dist/
 *    2. 把 app/ 下的站点文件原样复制到 dist/（UI 一个字节都不改）
 *    3. 把硬编码的部署路径 /liuyanban/ 改写为相对路径 ./
 *    4. 按需注入 Supabase 凭据（构建期覆盖，缺省保留源码默认值）
 *    5. 产出 .nojekyll 与 404.html，使其成为可发布的 GitHub Pages 站点
 *    6. 构建自检：文件齐全 + 无残留绝对路径
 *
 *  用法：node scripts/build.mjs
 *
 *  可选环境变量（GitHub Actions 中来自仓库 Variables / Secrets）：
 *    SUPABASE_URL       https://xxxxxxxxxxxx.supabase.co
 *    SUPABASE_ANON_KEY  sb_publishable_xxx 或旧版 eyJ... JWT
 *    BASE_PATH          留空 = 相对路径（推荐，任意前缀都能跑）
 *                       /liuyanban/   = 改写为该绝对前缀
 * ============================================================================
 */

import { readdir, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'app');
const OUT = path.join(ROOT, 'dist');

/** 构建产物必须包含的页面文件，缺一即构建失败 */
const REQUIRED = [
  'index.html', 'posts.html', 'profile.html', 'room.html', 'messages.html',
  'new-post.html', 'user.html', 'chats.html'
];

/**
 * 核心层模块。加载顺序即依赖顺序，不可随意调整：
 *   config  提供 SQ_CONFIG，其余模块都依赖它
 *   util    提供 SQUtil（转义/头像等纯函数）
 *   ui      依赖 util
 *   session 依赖 util + config
 *   data    依赖 config，负责创建后端客户端
 *   mods    依赖 ui + session
 *   shell   依赖 util + ui
 *   boot    依赖以上全部，且含页面加载时的自动执行逻辑
 */
const CORE_MODULES = [
  'config.js', 'util.js', 'ui.js', 'session.js',
  'data.js', 'mods.js', 'shell.js', 'boot.js'
];

/**
 * 房间页模块（app/room/）。加载顺序即依赖顺序，不可随意调整：
 *   room-core      守卫/状态/视图/列表/进入离开/Presence/麦位
 *   game-shell     GAMES/词库/游戏状态机/draw-tick
 *   game-render    renderGame 调度/全屏
 *   game-gomoku    五子棋
 *   game-draw      你画我猜
 *   game-spy       谁是卧底
 *   game-werewolf  狼人杀
 *   game-doudizhu  斗地主
 *   room-rt        房间消息/实时订阅/房间设置/事件/初始化
 */
const ROOM_MODULES = [
  'room-core.js', 'game-shell.js', 'game-render.js', 'game-gomoku.js',
  'game-draw.js', 'game-spy.js', 'game-werewolf.js', 'game-doudizhu.js',
  'room-rt.js'
];

/** 帖子页模块（app/posts/）与个人中心模块（app/profile/），加载顺序即依赖顺序 */
const POSTS_MODULES = [
  'posts-data.js', 'posts-social.js', 'posts-render.js', 'posts-admin.js'
];
const PROFILE_MODULES = [
  'profile-core.js', 'profile-notify.js', 'profile-report.js',
  'profile-feedback.js', 'profile-init.js'
];

/**
 * 每页单文件打包清单：core 8 模块 + 该页模块，顺序即依赖顺序。
 * 页面从 9~17 个串行请求收敛为 1 个 bundle；构建期同步改写 HTML：
 * CDN 标签加 defer（不阻塞首屏），本地 script 全部移除，
 * </body> 前只留一个 defer 的 bundle 标签（文档序保证 CDN 先于 bundle 执行）。
 */
const PAGE_BUNDLES = {
  'index.html': ['index/index.js'],
  'posts.html': POSTS_MODULES.map((n) => 'posts/' + n),
  'profile.html': PROFILE_MODULES.map((n) => 'profile/' + n),
  'room.html': ROOM_MODULES.map((n) => 'room/' + n),
  'messages.html': ['messages/messages.js'],
  'chats.html': ['chats/chats.js'],
  'new-post.html': ['new-post/new-post.js'],
  'user.html': ['user/user.js']
};
const CORE_RELS = CORE_MODULES.map((n) => 'core/' + n);

/**
 * 后端 SDK 自托管路径（相对 dist 根）。
 * 境外 cdn.jsdelivr.net 在国内常被干扰，首屏最坏要等十几秒，
 * 因此把 UMD 产物随仓库提交，构建时原样拷进 dist，全站零第三方依赖。
 */
const VENDOR_SDK = 'vendor/supabase.min.js';

/** bundle 文件名：bundle.index.js / bundle.posts.js ... */
const bundleNameOf = (htmlName) => 'bundle.' + htmlName.replace(/\.html$/, '') + '.js';

/** 源码里遗留的部署路径前缀 */
const LEGACY_BASE = '/liuyanban/';

/** Supabase 项目地址的字面量形态 */
const RE_SUPABASE_URL = /https:\/\/[a-z0-9]{8,}\.supabase\.co/gi;
/** 新版 publishable / secret key，以及旧版 anon JWT */
const RE_SUPABASE_KEY = /\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+\b|\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}/g;

const log = (...a) => console.log('[build]', ...a);
const mask = (s) => (s ? '***' + s.slice(-6) : '(未提供)');

async function main() {
  const startedAt = Date.now();
  log('项目根目录:', ROOT);

  // ------------------------------------------------------------ 1. 源文件校验
  const available = new Set(await readdir(SRC));
  const missing = REQUIRED.filter((f) => !available.has(f));
  if (missing.length) {
    console.error('[build] 致命错误：app/ 下缺少以下文件 ->', missing.join(', '));
    process.exit(1);
  }
  log('源文件校验通过，共 ' + REQUIRED.length + ' 个文件');

  // 后端 SDK 必须随仓库存在：缺失时构建直接失败，避免线上因 CDN 不可达而全站白屏
  try {
    const sdkStat = await stat(path.join(SRC, VENDOR_SDK));
    log('自托管 SDK: ' + VENDOR_SDK + '（' + (sdkStat.size / 1024).toFixed(0) + ' KB）');
  } catch {
    console.error('[build] 致命错误：缺少 ' + VENDOR_SDK + '（后端 SDK 未自托管）');
    process.exit(1);
  }

  // ------------------------------------------------------------ 2. 清空输出目录
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  log('已清空并重建 dist/');

  // ------------------------------------------------------------ 3. 读取构建配置
  const basePath = normalizeBase(process.env.BASE_PATH);
  const sbUrl = (process.env.SUPABASE_URL || '').trim();
  const sbKey = (process.env.SUPABASE_ANON_KEY || '').trim();
  log('路径改写目标: ' + (basePath || '(相对路径 ./)'));
  log('Supabase URL : ' + (sbUrl || '未提供，沿用源码默认值'));
  log('Supabase KEY : ' + mask(sbKey));

  // ------------------------------------------------------------ 4. 逐文件处理
  const stats = { pathHits: 0, bytes: 0 };

  for (const name of REQUIRED) {
    const raw = await readFile(path.join(SRC, name), 'utf8');

    // 4a. 路径改写：/liuyanban/x.html -> ./x.html
    const pathHits = count(raw, LEGACY_BASE);
    let out = raw.replaceAll(LEGACY_BASE, basePath);

    // 4b. 加载链收敛：每页 9~17 个串行 script -> 2 个（同域并行）
    if (PAGE_BUNDLES[name]) {
      const before = count(out, '<script src=');
      // SDK 自托管：境外 CDN(cdn.jsdelivr)在国内被干扰/屏蔽，是首屏极慢的根因。
      // 改为同域 ./vendor/supabase.min.js，与 bundle 并行下载、共用连接、可被 CDN 缓存。
      out = out.replace(
        '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
        '<script defer src="' + basePath + VENDOR_SDK + '"></script>'
      );
      // 移除全部本地 script 标签（内容并入该页 bundle）
      out = out.replace(/[ \t]*<script src="\.\/[^">]+\.js"><\/script>\r?\n?/g, '');
      // </body> 前插入唯一 bundle 标签；defer 按文档序在 SDK 之后执行
      const bname = bundleNameOf(name);
      out = out.replace(
        '</body>',
        '    <script defer src="' + basePath + bname + '"></script>\n</body>'
      );
      // 预连接后端域名：把 TLS/DNS 握手与静态资源下载重叠，省掉首个 API 请求的额外往返
      out = out.replace(
        '</head>',
        '    <link rel="preconnect" href="https://ulvhuqtpdafspbdvkogs.supabase.co" crossorigin>\n' +
        '    <link rel="dns-prefetch" href="https://ulvhuqtpdafspbdvkogs.supabase.co">\n' +
        '</head>'
      );
      log(name + ' script 标签 ' + before + ' -> 2（同域 SDK defer + bundle defer）');
    }

    // 4c. 凭据注入（仅当提供了环境变量时才替换）
    out = injectCredentials(out, sbUrl, sbKey);

    await writeFile(path.join(OUT, name), out, 'utf8');
    stats.pathHits += pathHits;
    stats.bytes += Buffer.byteLength(out, 'utf8');
  }

  // 4d. 逐页产出 bundle：core + 页面模块按依赖序拼接（含路径改写与凭据注入）
  for (const [name, pageRels] of Object.entries(PAGE_BUNDLES)) {
    const parts = [];
    for (const rel of CORE_RELS.concat(pageRels)) {
      const src = await readFile(path.join(SRC, rel), 'utf8');
      parts.push('/* ==== ' + rel + ' ==== */\n' + src.replaceAll(LEGACY_BASE, basePath));
    }
    const merged = injectCredentials(parts.join('\n\n'), sbUrl, sbKey);
    const bname = bundleNameOf(name);
    await writeFile(path.join(OUT, bname), merged, 'utf8');
    stats.bytes += Buffer.byteLength(merged, 'utf8');
    log(bname + ' <- ' + (CORE_RELS.length + pageRels.length) + ' 模块 / ' + (Buffer.byteLength(merged) / 1024).toFixed(1) + ' KB');
  }

  // 4d2. 自托管 SDK 拷入 dist（与页面同域，去掉第三方 CDN 依赖）
  await mkdir(path.join(OUT, 'vendor'), { recursive: true });
  const sdkBytes = await readFile(path.join(SRC, VENDOR_SDK));
  await writeFile(path.join(OUT, VENDOR_SDK), sdkBytes);
  stats.bytes += sdkBytes.length;
  log('自托管 SDK 输出: dist/' + VENDOR_SDK + '（' + (sdkBytes.length / 1024).toFixed(0) + ' KB）');

  log('处理完成：' + REQUIRED.length + ' 个文件 + ' + Object.keys(PAGE_BUNDLES).length + ' 个 bundle / ' + (stats.bytes / 1024).toFixed(1) + ' KB');
  log('  路径改写 ' + stats.pathHits + ' 处 | 核心模块 ' + CORE_MODULES.length + ' 个');

  // ------------------------------------------------------------ 4b. 核心层
  for (const name of CORE_MODULES) {
    const raw = await readFile(path.join(SRC, 'core', name), 'utf8');
    await mkdir(path.join(OUT, 'core'), { recursive: true });
    await writeFile(path.join(OUT, 'core', name), injectCredentials(raw, sbUrl, sbKey), 'utf8');
  }
  log(`核心层输出：${CORE_MODULES.length} 个模块 -> dist/core/`);

  // ------------------------------------------------------------ 4c. 房间页模块
  for (const name of ROOM_MODULES) {
    const raw = await readFile(path.join(SRC, 'room', name), 'utf8');
    await mkdir(path.join(OUT, 'room'), { recursive: true });
    // 与页面文件同规则：路径改写 + 凭据注入
    const rewritten = raw.replaceAll(LEGACY_BASE, basePath);
    await writeFile(path.join(OUT, 'room', name), injectCredentials(rewritten, sbUrl, sbKey), 'utf8');
  }
  log(`房间页输出：${ROOM_MODULES.length} 个模块 -> dist/room/`);

  // ------------------------------------------------------------ 4d. 各页模块（posts/profile/room 外的单模块页）
  for (const [dir, list] of [['posts', POSTS_MODULES], ['profile', PROFILE_MODULES], ['messages', ['messages.js']], ['chats', ['chats.js']], ['index', ['index.js']], ['new-post', ['new-post.js']], ['user', ['user.js']]]) {
    for (const name of list) {
      const raw = await readFile(path.join(SRC, dir, name), 'utf8');
      await mkdir(path.join(OUT, dir), { recursive: true });
      const rewritten = raw.replaceAll(LEGACY_BASE, basePath);
      await writeFile(path.join(OUT, dir, name), injectCredentials(rewritten, sbUrl, sbKey), 'utf8');
    }
    log(`${dir}页输出：${list.length} 个模块 -> dist/${dir}/`);
  }

  // 合并为单文件 core.js（opt-in：仅 BUILD_CORE_BUNDLE=1 时产出）。
  // 现状：8 个页面无一引用它，默认不产，省 66KB 部署体积；
  // 若有外部嵌入/旧书签依赖它，Actions 加个 env 即可恢复。
  if ((process.env.BUILD_CORE_BUNDLE || '').trim() === '1') {
    const parts = [];
    for (const name of CORE_MODULES) {
      const rawCore = await readFile(path.join(SRC, 'core', name), 'utf8');
      parts.push('/* ---- ' + name + ' ---- */\n' + injectCredentials(rawCore, sbUrl, sbKey));
    }
    const merged = parts.join('\n\n');
    await writeFile(path.join(OUT, 'core.js'), merged, 'utf8');
    log(`已合并单文件 core.js（${merged.length} 字符）`);
  } else {
    log('跳过 core.js 合并产物（无人引用；BUILD_CORE_BUNDLE=1 可恢复）');
  }

  // ------------------------------------------------------------ 5. Pages 辅助文件
  await writeFile(path.join(OUT, '.nojekyll'), '', 'utf8');
  log('已写入 .nojekyll');

  await writeFile(path.join(OUT, '404.html'), build404(), 'utf8');
  log('已写入 404.html');

  // ------------------------------------------------------------ 6. 构建自检
  const leftovers = await audit();
  if (leftovers.length) {
    console.error('[build] 自检失败：产物中仍存在遗留绝对路径 ->');
    leftovers.forEach((l) => console.error('    ' + l));
    process.exit(1);
  }
  log('自检通过：产物中无遗留 ' + LEGACY_BASE + ' 绝对路径');

  log('构建成功，用时 ' + (Date.now() - startedAt) + 'ms，产物目录：dist/');
}

/** 按需替换 Supabase 凭据字面量；未提供环境变量时原样返回 */
function injectCredentials(src, sbUrl, sbKey) {
  let out = src;
  if (sbUrl) {
    const url = sbUrl.replace(/\/+$/, '');
    out = out.replace(RE_SUPABASE_URL, () => url);
  }
  if (sbKey) out = out.replace(RE_SUPABASE_KEY, () => sbKey);
  return out;
}

function normalizeBase(raw) {
  const v = (raw || '').trim();
  // 未指定 BASE_PATH 时使用相对路径 './'：
  // 这样产物放在任意域名/子路径/本地目录都能直接双击打开，无需二次构建。
  if (!v) return './';
  const lead = v.startsWith('/') ? v : '/' + v;
  return lead.endsWith('/') ? lead : lead + '/';
}

function count(hay, needle) {
  let n = 0;
  let i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

async function audit() {
  const bad = [];
  for (const name of REQUIRED) {
    const text = await readFile(path.join(OUT, name), 'utf8');
    const idx = text.indexOf(LEGACY_BASE);
    if (idx !== -1) bad.push(name + ':' + text.slice(0, idx).split('\n').length);
  }
  return bad;
}

function build404() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seven戚 · 页面不存在</title>
<style>
  html,body{height:100%;margin:0}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
       background:#f5faf5;color:#1e3a2e;
       font-family:"Space Grotesk","PingFang SC","Segoe UI",system-ui,sans-serif;
       text-align:center;padding:24px}
  h1{margin:0;font-size:2.2em;letter-spacing:.04em}
  p{margin:0;color:#5a7a6a;font-size:.95em}
  a{display:inline-block;margin-top:6px;padding:12px 30px;border-radius:99px;background:#2e7d32;color:#fff;
    text-decoration:none;font-weight:600;box-shadow:0 8px 20px rgba(46,125,50,.25)}
  a:hover{background:#276c2b}
</style>
</head>
<body>
  <h1>404</h1>
  <p>你访问的页面不存在或已被移除</p>
  <a href="./index.html">返回首页</a>
</body>
</html>
`;
}

main().catch((err) => {
  console.error('[build] 构建异常终止:', err);
  process.exit(1);
});
