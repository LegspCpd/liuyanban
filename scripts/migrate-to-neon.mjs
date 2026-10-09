#!/usr/bin/env node
/**
 * ============================================================================
 *  Supabase -> Neon 全量数据迁移器
 * ============================================================================
 *
 *  背景
 *    生产库（Supabase，原作者建的）主键多为 uuid；Neon 库按本项目
 *    db/schema.core.sql 建表，主键为 bigint identity。两者结构不等价，
 *    因此迁移必须做 uuid -> bigint 主键重映射，并同步改写所有外键列。
 *
 *  用法
 *    node scripts/migrate-to-neon.mjs --dry-run --source-json <dir>
 *    node scripts/migrate-to-neon.mjs --truncate
 *
 *  环境变量
 *    SOURCE_URL / SOURCE_KEY      源库（默认取生产库）
 *    TARGET_DATABASE_URL          目标 Neon 连接串
 *    PG_MODULE                    可选，pg 模块路径（受限网络环境用）
 *
 *  选项
 *    --dry-run                 只统计，不写库
 *    --truncate                写入前清空目标表（首次迁移用）
 *    --source-json <dir>       从本地 <dir>/<table>.json 读源数据
 *                              （用于 Node 直连被限流的网络环境）
 * ============================================================================
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const REST = (process.env.SOURCE_URL || 'https://ulvhuqtpdafspbdvkogs.supabase.co').replace(/\/+$/, '');
const KEY = process.env.SOURCE_KEY || 'sb_publishable_b3zSRFSj9k73_tIxO1yJYw_IEK9tPLg';
const TARGET = process.env.TARGET_DATABASE_URL || '';
const DRY = process.argv.includes('--dry-run');
const TRUNCATE = process.argv.includes('--truncate');

const jIdx = process.argv.indexOf('--source-json');
const JSON_DIR = jIdx !== -1 ? (process.argv[jIdx + 1] || '') : '';

const log = (...a) => console.log('[migrate]', ...a);
const ok = (m) => console.log('[migrate]   ok  ' + m);
const warn = (m) => console.log('[migrate]   !   ' + m);
const bad = (m) => { console.error('[migrate]   x   ' + m); process.exitCode = 1; };

/** 迁移顺序 = 外键拓扑，被引用者在前 */
const ORDER = [
  'users', 'categories', 'feedback_sites', 'post_polls', 'posts',
  'poll_options', 'post_comments', 'poll_votes', 'messages', 'chats',
  'reports', 'feedback', 'notifications', 'user_roles', 'follows',
  'device_registrations', 'rooms', 'gomoku_games', 'room_messages'
];

/** 语义独立的 uuid 列，原样保留（如 Supabase Auth 用户 ID） */
const KEEP_AS_IS = new Set(['users.auth_id']);

/** 源库主键为 uuid、需要重映射的表 */
const UUID_PK = new Set([
  'users', 'posts', 'post_comments', 'post_polls', 'poll_options', 'poll_votes',
  'chats', 'reports', 'notifications', 'user_roles', 'follows',
  'feedback_sites', 'feedback', 'device_registrations', 'rooms',
  'gomoku_games', 'room_messages'
]);

/** 以 uuid[] 存储的列，需逐元素重映射 */
const UUID_ARRAY_COLS = new Map([
  ['rooms.co_admin_ids', 'users'],
  ['rooms.muted_user_ids', 'users'],
  ['rooms.mic_speaking', 'users'],
  ['rooms.mic_requests', 'users']
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY };

/** 源库 chats.deleted_by 等列存的是「昵称」而非 uuid，需先昵称->uuid->bigint 两级映射 */
let nickToUuid = new Map();

/**
 * 目标库真实外键（来自 information_schema 的 pg_constraint，非按命名猜测）。
 * 必须显式列举：device_id 是「设备标识」不是外键，created_at 之类同理；
 * 用 _id 后缀猜会把 device_id 清空，也会漏掉 _by 后缀的 reviewed_by。
 */
// 目标库真实外键：运行时从 pg_constraint 读取，不靠命名猜测。
// 手写白名单会漏列（曾漏 notifications.comment_author_id 导致 uuid 灌进 bigint），
// 也会误伤非外键列（device_id 是设备标识，被 _id 后缀规则误判清空过）。
const REAL_FKS = new Set();

/** 目标库中所有「整型列」：bigint / integer / int / smallint / serial / identity
 *  这些列的值必须完成 uuid -> bigint 重映射，无论目标库是否给它建了外键约束。
 *  例：notifications.comment_author_id 是 bigint 但没有 FK 约束，
 *      只按 pg_constraint 判断就会漏掉，uuid 原文会灌进整型列直接报错。
 */
const INT_COLS = new Set();
const INT_TYPES = new Set(['bigint', 'integer', 'int', 'int2', 'int4', 'int8', 'smallint', 'bigserial', 'serial', 'smallserial']);

async function loadColumnTypes(client) {
  const r = await client.query(
    "select table_name, column_name, data_type " +
    "from information_schema.columns where table_schema = 'public'");
  for (const x of r.rows) {
    const key = x.table_name + '.' + x.column_name;
    if (INT_TYPES.has(x.data_type)) INT_COLS.add(key);
    if (REAL_FKS.has(key)) continue;
  }
  const f = await client.query(
    "select cl.relname as tbl, a.attname as col " +
    "from pg_constraint k join pg_class cl on cl.oid = k.conrelid " +
    "join pg_namespace n on n.oid = cl.relnamespace " +
    "join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any(k.conkey) " +
    "where k.contype = 'f' and n.nspname = 'public'");
  for (const x of f.rows) REAL_FKS.add(x.tbl + '.' + x.col);
  return INT_COLS.size + REAL_FKS.size;
}

/** 目标库中以 jsonb 存储的列：这些列允许数组/对象，其它列遇到对象值必须置空 */
const JSONB_COLS = new Set([
  'rooms.co_admin_ids', 'rooms.co_admin_permissions', 'rooms.muted_user_ids',
  'rooms.mic_speaking', 'rooms.mic_requests', 'rooms.current_game',
  'gomoku_games.board'
]);
const targetIsJson = (table, col) => JSONB_COLS.has(table + '.' + col);

const maps = new Map();
const mapOf = (t) => {
  if (!maps.has(t)) maps.set(t, new Map());
  return maps.get(t);
};

async function fetchAll(table) {
  if (JSON_DIR) {
    let txt;
    try {
      txt = await readFile(join(JSON_DIR, table + '.json'), 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw new Error(table + ' 读取失败: ' + e.message);
    }
    if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);
    const parsed = JSON.parse(txt);
    // PowerShell 导出单行表时会把数组拆包成对象（$all | ConvertTo-Json 对单元素会
    // 自动 unroll），所以 {..} 也要当作「单行表」处理，否则 follows 这类 1 行表
    // 会被当成空表静默跳过。
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return [parsed];
    return [];
  }

  const out = [];
  let offset = 0;
  for (;;) {
    const url = REST + '/rest/v1/' + table + '?select=*&order=id&offset=' + offset + '&limit=1000';
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(table + ' 读取失败 ' + res.status + ' ' + (await res.text()).slice(0, 160));
    const rows = await res.json();
    if (!rows.length) break;
    out.push(...rows);
    offset += 1000;
    if (rows.length < 1000) break;
  }
  return out;
}

/** 重映射：uuid 主键 -> bigint，并把外键/数组列里的 uuid 一并换成 bigint */
function remap(table, rows, targetCols) {
  const needRemap = UUID_PK.has(table)
    && rows.length > 0
    && rows[0].id != null
    && UUID_RE.test(String(rows[0].id));
  const m = needRemap ? mapOf(table) : null;
  let seq = 0;

  const prepared = rows.map((row) => {
    const o = {};
    for (const [k, v] of Object.entries(row)) {
      if (!targetCols.includes(k)) continue;
      if (KEEP_AS_IS.has(table + '.' + k)) { o[k] = v; continue; }

      const arrOwner = UUID_ARRAY_COLS.get(table + '.' + k);
      if (arrOwner && Array.isArray(v)) {
        // 重映射后必须序列化成字符串：pg 的参数序列化对数组不可靠，
        // 直接传数组会报 invalid input syntax for type json。
        o[k] = JSON.stringify(v.map((x) => (x && UUID_RE.test(String(x)) ? (mapOf(arrOwner).get(x) ?? null) : x)));
        continue;
      }
      if (targetIsJson(table, k)) {
        // jsonb 列统一传 JSON 字符串：pg 对数组/对象参数的序列化在部分版本上不稳定，
        // 字符串形式最可靠（'invalid input syntax for type json' 即由此而来）。
        o[k] = (v === undefined || v === null) ? null : JSON.stringify(v);
      } else {
        // 非 json 列遇到对象值会报类型错（如 gomoku.black_id 出现过 object）
        o[k] = (typeof v === 'object' && v !== null) ? null : v;
      }
    }

    if (needRemap) {
      const old = String(row.id);
      if (!m.has(old)) m.set(old, ++seq);
      o.id = m.get(old);
    } else if (row.id != null) {
      o.id = row.id;
    }
    return o;
  });

  // 外键回填：此刻被引用表的映射已就绪（ORDER 保证拓扑序）
  for (const o of prepared) {
    for (const k of Object.keys(o)) {
      // 外键列有三种后缀：_id / _by（如 reports.reviewed_by、chats.deleted_by）
      // / comment_author_id。只认 _id 会漏掉 _by，导致 uuid 原文塞进 bigint 列。
      if (k === 'id') continue;
      const key = table + '.' + k;
      if (!REAL_FKS.has(key) && !INT_COLS.has(key)) continue;
      const v = o[k];
      if (typeof v !== 'string' || !v) continue;
      if (UUID_RE.test(v)) {
        let hit = false;
        for (const mm of maps.values()) {
          if (mm.has(v)) { o[k] = mm.get(v); hit = true; break; }
        }
        // 悬空 uuid：指向源库中已被删除的对象（notifications.source_id 有 6 个），
        // 映射不到就置 null。留着原文会灌进 bigint 列直接报类型错。
        if (!hit) o[k] = null;
      } else {
        // 源库部分外键列存昵称（如 chats.deleted_by = 'Seven戚'）
        const uuid = nickToUuid.get(v);
        const userMap = mapOf('users');
        if (uuid && userMap.has(uuid)) o[k] = userMap.get(uuid);
        else o[k] = null;   // 无法解析就置空，绝不能让昵称/对象流进 bigint 列
      }
    }
  }

  return { prepared, remapped: seq };
}

async function insertRows(client, table, rows) {
  const cols = Object.keys(rows[0]);
  const ddl = TRUNCATE ? '' : ' on conflict (id) do update set '
    + (cols.filter((c) => c !== 'id').map((c) => c + '=excluded.' + c).join(',') || 'id=excluded.id');

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    // 多行批量插入：每行都要有独立的一组占位符，编号在整个语句内连续递增。
    // node-postgres 用 $1,$2,...（不是 MySQL 的 ?）；只给一行生成占位符会报
    // "bind message supplies N parameters, but prepared statement requires M"。
    const groups = [];
    let n = 0;
    for (let r = 0; r < slice.length; r++) {
      const one = cols.map(() => { n += 1; return '$' + n; });
      groups.push('(' + one.join(',') + ')');
    }
    const sql = 'insert into public.' + table + ' (' + cols.join(',') + ') values '
      + groups.join(',') + ddl;
    const vals = [];
    for (const o of slice) for (const c of cols) vals.push(o[c] === undefined ? null : o[c]);
    await client.query(sql, vals);
  }
}

async function main() {
  log('数据源:', JSON_DIR ? '本地 JSON ' + JSON_DIR : 'REST ' + REST);
  log('模式  :', DRY ? 'DRY RUN' : TRUNCATE ? '清空后导入' : 'upsert');
  if (!TARGET && !DRY) { bad('缺少 TARGET_DATABASE_URL'); process.exit(1); }

  const { default: pg } = await import(process.env.PG_MODULE || 'pg');
  let client = null;
  if (!DRY) {
    client = new pg.Client({ connectionString: TARGET, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });
    await client.connect();
    const colCount = await loadColumnTypes(client);
    ok('目标库连接成功，已加载 ' + colCount + ' 个整型/外键列');
  }

  const summary = [];
  for (const table of ORDER) {
    let rows;
    try { rows = await fetchAll(table); }
    catch (e) { warn(e.message); continue; }

    if (!rows.length) { summary.push([table, 0, 0]); continue; }

    let targetCols;
    if (client) {
      const r = await client.query(
        "select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",
        [table]);
      if (!r.rows.length) { warn(table + ' 目标库不存在，跳过'); continue; }
      targetCols = r.rows.map((x) => x.column_name);
    } else {
      targetCols = Object.keys(rows[0]);
    }

    const { prepared, remapped } = remap(table, rows, targetCols);

    // users 先迁完即可建立 昵称->uuid 映射，供后续表的昵称型外键解析
    if (table === 'users') {
      for (const u of rows) {
        if (u.id != null && u.nickname != null) nickToUuid.set(String(u.nickname), String(u.id));
      }
    }

    if (DRY) {
      log(table.padEnd(20) + rows.length + ' 行' + (remapped ? '（uuid->bigint ' + remapped + '）' : ''));
      summary.push([table, rows.length, rows.length]);
      continue;
    }

    // 自引用表（messages.parent_id -> messages.id）：同一批插入时父行可能尚未落库，
    // 立即约束会直接拒绝。先整批插 parent_id=null，再按 id 顺序回填。
    const SELF_REF = new Set(['messages']);
    const selfRef = SELF_REF.has(table) && prepared.some((o) => o.parent_id != null);

    try {
      if (TRUNCATE) await client.query('truncate table public.' + table + ' cascade');
      if (selfRef) {
        const stash = prepared.map((o) => o.parent_id);
        const rowsNoRef = prepared.map((o) => ({ ...o, parent_id: null }));
        await insertRows(client, table, rowsNoRef);
        for (let i = 0; i < prepared.length; i++) {
          if (stash[i] == null) continue;
          await client.query(
            'update public.' + table + ' set parent_id = $1 where id = $2',
            [stash[i], prepared[i].id]);
        }
      } else {
        await insertRows(client, table, prepared);
      }
      ok(table.padEnd(20) + prepared.length + ' 行' + (remapped ? '（uuid->bigint ' + remapped + '）' : ''));
      summary.push([table, rows.length, prepared.length]);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      bad(table + ' 写入失败: ' + msg.split('\n')[0].slice(0, 200));
      if (process.env.MIGRATE_DEBUG) {
        try { await writeFile(process.env.MIGRATE_DEBUG, msg + '\n\n', { flag: 'a' }); } catch { /* ignore */ }
      }
      summary.push([table, rows.length, -1]);
    }
  }

  if (client) {
    console.log('');
    log('=== 迁移回执 ===');
    let okc = 0, failc = 0, src = 0;
    for (const [t, s, d] of summary) {
      console.log('  ' + t.padEnd(20) + String(s).padStart(5) + ' -> ' + String(d).padStart(5) + (d === s ? '  OK' : '  FAIL'));
      src += s;
      if (d === s) okc++; else failc++;
    }
    console.log('');
    log('合计 ' + src + ' 行，成功 ' + okc + ' 表，失败 ' + failc + ' 表');
    await client.end();
  }
}

main().catch((e) => { bad((e && e.stack) || String(e)); process.exit(1); });
