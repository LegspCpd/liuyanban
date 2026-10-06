#!/usr/bin/env node
/**
 * ============================================================================
 *  数据库 Schema 自动执行器（零依赖，Node >= 18）
 * ============================================================================
 *
 *  自动选择连接通道，按以下优先级：
 *
 *    通道 A（推荐，无需暴露数据库密码）
 *      需要: SUPABASE_ACCESS_TOKEN  +  SUPABASE_PROJECT_REF
 *      做法: 调用 Supabase Management API 执行 SQL
 *
 *    通道 B（备选）
 *      需要: DATABASE_URL
 *      做法: 通过 psql 直连执行
 *
 *    都没配置 -> 打印提示并以 0 退出，不阻塞部署流水线
 *
 *  用法:
 *    node scripts/apply-schema.mjs            # 真正执行
 *    node scripts/apply-schema.mjs --dry-run  # 只打印将要执行的内容与通道判断
 * ============================================================================
 */

import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEMA_FILE = path.join(ROOT, 'db', 'schema.sql');

const DRY_RUN = process.argv.includes('--dry-run');
const log = (...a) => console.log('[schema]', ...a);
const ok = (m) => console.log('[schema]  ✓ ' + m);
const warn = (m) => console.log('[schema]  ! ' + m);

async function main() {
  const sql = await readFile(SCHEMA_FILE, 'utf8');
  log('Schema 文件:', path.relative(ROOT, SCHEMA_FILE), '(' + sql.length + ' 字符)');

  const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
  const ref = (process.env.SUPABASE_PROJECT_REF || '').trim();
  const dbUrl = (process.env.DATABASE_URL || '').trim();

  const hasChannelA = Boolean(token && ref);
  const hasChannelB = Boolean(dbUrl);

  // ------------------------------------------------------------ 通道判定
  if (DRY_RUN) {
    log('=== DRY RUN ===');
    log('通道 A（Management API）:', hasChannelA ? '可用' : '不可用');
    log('  SUPABASE_ACCESS_TOKEN:', token ? '已配置' : '未配置');
    log('  SUPABASE_PROJECT_REF:', ref || '未配置');
    log('通道 B（psql 直连）    :', hasChannelB ? '可用' : '不可用');
    log('  DATABASE_URL:', dbUrl ? '已配置' : '未配置');
    log('将要使用的通道:', hasChannelA ? 'A' : hasChannelB ? 'B' : '无');
    log('SQL 前 400 字符:\n' + sql.slice(0, 400) + '\n...');
    return;
  }

  if (!hasChannelA && !hasChannelB) {
    warn('未检测到任何数据库凭据，跳过建表（部署继续）。');
    warn('如需自动建表，请在仓库 Settings -> Secrets and variables -> Actions 中配置：');
    warn('   SUPABASE_ACCESS_TOKEN  (与 SUPABASE_PROJECT_REF 搭配，推荐)');
    warn('   或 DATABASE_URL        (postgres 连接串)');
    return;
  }

  const started = Date.now();
  if (hasChannelA) {
    log('使用通道 A：Supabase Management API');
    await runViaManagementApi(sql, token, ref);
  } else {
    log('使用通道 B：psql 直连');
    await runViaPsql(sql, dbUrl);
  }
  ok('Schema 应用完成，用时 ' + (Date.now() - started) + 'ms');
}

/** 通道 A：Supabase Management API */
async function runViaManagementApi(sql, token, ref) {
  const url = `https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/database/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  const text = await res.text();

  if (!res.ok) {
    // 401/403 多为 PAT 失效或项目 ID 写错，单独给出可操作的提示
    if (res.status === 401 || res.status === 403) {
      console.error('[schema] 认证失败 (' + res.status + ')：请检查 SUPABASE_ACCESS_TOKEN 是否有效、是否具备项目读写的 scope。');
    } else if (res.status === 404) {
      console.error('[schema] 项目不存在 (404)：请检查 SUPABASE_PROJECT_REF 是否正确（应为 20 位小写项目 ID）。');
    }
    console.error('[schema] Management API 返回:', text.slice(0, 2000));
    process.exit(1);
  }

  log('Management API 响应:', text.slice(0, 800) || '(空)');
}

/** 通道 B：psql 直连 */
function runViaPsql(sql, dbUrl) {
  return new Promise((resolve, reject) => {
    // 从 DATABASE_URL 中剥离出连接串与 SQL 文本，避免密码出现在进程列表里
    const child = spawn('psql', ['-v', 'ON_ERROR_STOP=1', '-q', '-f', '-', dbUrl], {
      stdio: ['pipe', 'inherit', 'inherit'],
      env: { ...process.env, PGPASSWORD: extractPassword(dbUrl) }
    });

    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.error('[schema] 未找到 psql 命令。请改用通道 A（配置 SUPABASE_ACCESS_TOKEN），');
        console.error('          或在自托管 Runner 上安装 postgresql-client。');
        reject(err);
      } else reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('psql 退出码 ' + code));
    });

    child.stdin.write(sql);
    child.stdin.end();
  });
}

/** 从 postgres URL 中取出密码，供 PGPASSWORD 使用 */
function extractPassword(u) {
  try {
    const p = new URL(u);
    return decodeURIComponent(p.password || '');
  } catch {
    return '';
  }
}

main().catch((err) => {
  console.error('[schema] 执行失败:', err.message || err);
  process.exit(1);
});
