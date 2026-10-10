#!/usr/bin/env node
/**
 * ============================================================================
 *  数据库 Schema 自动执行器（零依赖，Node >= 18）
 * ============================================================================
 *
 *  支持双云：Supabase 与 Neon，二者可共存，也可各自独立部署。
 *
 *  ── 供应商选择 ─────────────────────────────────────────────────────────────
 *    环境变量 DB_PROVIDER：
 *      supabase（默认） → 执行 schema.core.sql + schema.supabase.sql
 *      neon             → 执行 schema.core.sql + schema.neon.sql
 *      postgres         → 只执行 schema.core.sql（自建 Postgres 等）
 *
 *  ── 连接通道（按供应商自动选择，均未配置时安全跳过）─────────────────────────
 *    Supabase:
 *      A. SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF  → Management API
 *      B. DATABASE_URL                                 → psql 直连
 *    Neon:
 *      C. NEON_DATABASE_URL                             → psql 直连
 *      D. NEON_API_KEY + NEON_PROJECT_ID                → Neon API
 *
 *  ── 用法 ──────────────────────────────────────────────────────────────────
 *    node scripts/apply-schema.mjs                # 按 DB_PROVIDER 执行
 *    node scripts/apply-schema.mjs --dry-run      # 只打印判断与将执行的 SQL
 *    node scripts/apply-schema.mjs --provider=neon # 命令行覆盖 DB_PROVIDER
 * ============================================================================
 */

import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_DIR = path.join(ROOT, 'db');

const DRY_RUN = process.argv.includes('--dry-run');
const PROVIDER_OVERRIDE = (process.argv.find((a) => a.startsWith('--provider=')) || '').split('=')[1];

const log = (...a) => console.log('[schema]', ...a);
const ok = (m) => console.log('[schema]  ✓ ' + m);
const warn = (m) => console.log('[schema]  ! ' + m);
const bad = (m) => console.error('[schema]  ✗ ' + m);

/** 各供应商需要执行的 SQL 文件（按顺序） */
const PLAN = {
  // compat 永远垫后：新库跑它无影响（全是 if not exists），老库靠它补齐错位
  // rls-auto 收尾：公开表 RLS enable + using(true)，行为透明，可安全自动执行
  // skin-shop 是商城功能（气泡皮肤/小七币），全表 if not exists + 动态类型，幂等安全
  supabase: ['schema.core.sql', 'schema.supabase.sql', 'schema.compat.sql', 'skin-shop.sql', 'rls-auto.sql'],
  neon: ['schema.core.sql', 'schema.neon.sql', 'schema.compat.sql', 'skin-shop.sql', 'rls-auto.sql'],
  postgres: ['schema.core.sql', 'schema.compat.sql', 'skin-shop.sql', 'rls-auto.sql']
};

async function main() {
  const provider = (PROVIDER_OVERRIDE || process.env.DB_PROVIDER || 'supabase').trim().toLowerCase();
  const files = PLAN[provider];

  if (!files) {
    bad('未知的 DB_PROVIDER: "' + provider + '"，可选值：' + Object.keys(PLAN).join(' / '));
    process.exit(1);
  }

  log('目标平台  :', provider);
  log('执行文件  :', files.join(' + '));

  // ---------------------------------------------------------- 读取并合并 SQL
  const parts = [];
  for (const f of files) {
    const text = await readFile(path.join(DB_DIR, f), 'utf8');
    parts.push(text);
    log('  已加载', f, '(' + text.length + ' 字符)');
  }
  const sql = parts.join('\n\n');

  // ---------------------------------------------------------- 通道判定
  const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
  const ref = (process.env.SUPABASE_PROJECT_REF || '').trim();
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  const neonUrl = (process.env.NEON_DATABASE_URL || '').trim();
  const neonKey = (process.env.NEON_API_KEY || '').trim();
  const neonProj = (process.env.NEON_PROJECT_ID || '').trim();

  const candidates = [];
  if (provider === 'supabase') {
    if (token && ref) candidates.push({ kind: 'supabase-api', label: 'Supabase Management API' });
    if (dbUrl) candidates.push({ kind: 'psql', label: 'Postgres 直连（DATABASE_URL）' });
  } else if (provider === 'neon') {
    if (neonUrl) candidates.push({ kind: 'psql', label: 'Neon 直连（NEON_DATABASE_URL）' });
    if (neonKey && neonProj) candidates.push({ kind: 'neon-api', label: 'Neon API（NEON_API_KEY）' });
  } else {
    if (dbUrl) candidates.push({ kind: 'psql', label: 'Postgres 直连（DATABASE_URL）' });
  }

  if (DRY_RUN) {
    log('');
    log('=== DRY RUN ===');
    log('可用通道  :', candidates.length ? candidates.map((c) => c.label).join(' | ') : '无');
    log('将要使用  :', candidates[0] ? candidates[0].label : '无（将安全跳过）');
    log('');
    log('凭据探测  :');
    log('  SUPABASE_ACCESS_TOKEN :', token ? '已配置' : '未配置');
    log('  SUPABASE_PROJECT_REF :', ref || '未配置');
    log('  DATABASE_URL         :', dbUrl ? '已配置' : '未配置');
    log('  NEON_DATABASE_URL    :', neonUrl ? '已配置' : '未配置');
    log('  NEON_API_KEY         :', neonKey ? '已配置' : '未配置');
    log('  NEON_PROJECT_ID      :', neonProj || '未配置');
    log('');
    log('合并后 SQL 共 ' + sql.length + ' 字符，前 300 字：');
    log(sql.slice(0, 300).replace(/^/gm, '    '));
    return;
  }

  if (!candidates.length) {
    warn('[' + provider + '] 未配置凭据，跳过建表（部署继续，不阻塞）。');
    // GitHub Actions 注解：即使 job 有 continue-on-error、退出码为 0，
    // 这一条也会在工作流页面显示为黄色警告，避免「看似成功、实际没落库」。
    // 真实事故：2026-10-06 之前 schema 变更一直这样空转，reports.admin_note
    // 等列从未进过真实库，前端却早已在读它们。
    const how = provider === 'supabase'
      ? '配置 Secrets DATABASE_URL（或 SUPABASE_ACCESS_TOKEN + Variables SUPABASE_PROJECT_REF）'
      : provider === 'neon'
        ? '配置 Secrets NEON_DATABASE_URL（或 NEON_API_KEY + Variables NEON_PROJECT_ID）'
        : '配置 Secrets DATABASE_URL';
    console.warn('::warning title=数据库 Schema 未应用（凭据缺失）::[' + provider + "] 未配置任何可用通道，本次 schema 变更**没有**落到真实数据库。修复方式：" + how);
    warn('可用的配置方式：');
    if (provider === 'supabase') {
      warn('   Secrets: SUPABASE_ACCESS_TOKEN + Variables: SUPABASE_PROJECT_REF   （推荐）');
      warn('   Secrets: DATABASE_URL                                            （备选）');
    } else if (provider === 'neon') {
      warn('   Secrets: NEON_DATABASE_URL   （Neon 控制台的 pooled 直连串，推荐）');
      warn('   Secrets: NEON_API_KEY + Variables: NEON_PROJECT_ID              （备选）');
    } else {
      warn('   Secrets: DATABASE_URL');
    }
    return;
  }

  const started = Date.now();
  const chosen = candidates[0];
  log('使用通道  :', chosen.label);

  if (chosen.kind === 'supabase-api') await runViaManagementApi(sql, token, ref);
  else if (chosen.kind === 'neon-api') await runViaNeonApi(sql, neonKey, neonProj);
  else await runViaPsql(sql, provider === 'neon' ? neonUrl : dbUrl);

  ok('[' + provider + '] Schema 应用完成，用时 ' + (Date.now() - started) + 'ms');
}

/** 通道：Supabase Management API */
async function runViaManagementApi(sql, token, ref) {
  const url = `https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/database/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      bad('认证失败 (' + res.status + ')：请检查 SUPABASE_ACCESS_TOKEN 是否有效及其 scope。');
    } else if (res.status === 404) {
      bad('项目不存在 (404)：请检查 SUPABASE_PROJECT_REF 是否为正确的 20 位项目 ID。');
    }
    console.error('[schema] Management API 返回:', text.slice(0, 2000));
    process.exit(1);
  }
  log('Management API 响应:', text.slice(0, 800) || '(空)');
}

/** 通道：Neon API（无 DATABASE_URL 时的备选） */
async function runViaNeonApi(sql, apiKey, projectId) {
  // Neon 的 SQL 执行走 console/api 的角色凭据流程，此处用项目级 SQL 执行端点
  const url = `https://console.neon.tech/api/projects/${encodeURIComponent(projectId)}/sql_query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  const text = await res.text();
  if (!res.ok) {
    bad('Neon API 调用失败 (' + res.status + ')：' + text.slice(0, 600));
    bad('提示：Neon API 通道依赖较新的接口，建议改用 Secrets: NEON_DATABASE_URL 走 psql。');
    process.exit(1);
  }
  log('Neon API 响应:', text.slice(0, 800) || '(空)');
}

/** 通道：psql 直连（Supabase DATABASE_URL 或 Neon NEON_DATABASE_URL） */
function runViaPsql(sql, dbUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', ['-v', 'ON_ERROR_STOP=1', '-q', '-f', '-', dbUrl], {
      stdio: ['pipe', 'inherit', 'inherit'],
      env: { ...process.env, PGPASSWORD: extractPassword(dbUrl) }
    });

    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        bad('未找到 psql 命令。请改用 Management API 通道，或在 Runner 上安装 postgresql-client。');
      }
      reject(err);
    });

    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error('psql 退出码 ' + code))));
    child.stdin.write(sql);
    child.stdin.end();
  });
}

function extractPassword(u) {
  try { return decodeURIComponent(new URL(u).password || ''); }
  catch { return ''; }
}

main().catch((err) => {
  console.error('[schema] 执行失败:', err.message || err);
  process.exit(1);
});
