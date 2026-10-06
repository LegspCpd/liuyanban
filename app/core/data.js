/* ============================================================================
 *  L4 · 数据访问层（重写版）
 *  ---------------------------------------------------------------------------
 *  UI 不动；本文件只解决三件事：
 *    1. CDN 偶发失败 -> 自动切备用源重载 supabase-js
 *    2. 请求无超时无重试 -> 全局 fetch 包装：15s 超时 + 最多 2 次重试
 *    3. 失败静默（读出来是空、写出去没反应）-> 统一记录 lastError 并广播事件
 *
 *  对外句柄保持 100% 兼容：window.sb / SQData { ready, table, count }。
 *  页面内上百处 window.sb.from(...) 调用无需改动。
 * ============================================================================ */
(function (global) {
    'use strict';

    var FALLBACK_CDNS = [
        'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js',
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
    ];
    var FETCH_TIMEOUT_MS = 15000;
    var FETCH_RETRIES = 2;

    var lastError = null;
    var statusListeners = [];

    function emit(evt) {
        try {
            if (typeof global.dispatchEvent === 'function') {
                global.dispatchEvent(new CustomEvent('sq-data-error', { detail: evt }));
            }
        } catch (e) {}
        for (var i = 0; i < statusListeners.length; i++) {
            try { statusListeners[i](evt); } catch (e) {}
        }
    }

    function noteError(where, err) {
        lastError = { where: where, message: String((err && err.message) || err), at: Date.now() };
        try { console.warn('[SQData] ' + where + ' 失败:', (err && err.message) || err); } catch (e) {}
        emit(lastError);
    }

    // 带超时 + 重试的 fetch：网络抖动时自动再试，不再一次就死
    function retryFetch(url, options) {
        var attempt = 0;
        var nativeFetch = global.fetch.bind(global);

        function once() {
            attempt++;
            var ctrl = null;
            var timer = null;
            try {
                if (typeof AbortController !== 'undefined') {
                    ctrl = new AbortController();
                    timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, FETCH_TIMEOUT_MS);
                }
            } catch (e) {}
            var opts = options || {};
            if (ctrl) {
                opts = {};
                for (var k in options || {}) opts[k] = options[k];
                opts.signal = ctrl.signal;
            }
            return nativeFetch(url, opts).then(function (res) {
                if (timer) clearTimeout(timer);
                // 5xx / 429 自动重试；4xx 直接返回（由业务处理）
                if ((res.status >= 500 || res.status === 429) && attempt <= FETCH_RETRIES) {
                    return new Promise(function (resolve) {
                        setTimeout(function () { resolve(once()); }, 400 * attempt);
                    });
                }
                return res;
            }, function (err) {
                if (timer) clearTimeout(timer);
                if (attempt <= FETCH_RETRIES) {
                    return new Promise(function (resolve) {
                        setTimeout(function () { resolve(once()); }, 400 * attempt);
                    });
                }
                throw err;
            });
        }
        return once();
    }

    function createClient(url, key) {
        try {
            return global.supabase.createClient(url, key, {
                auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
                global: { fetch: retryFetch },
                realtime: { timeout: FETCH_TIMEOUT_MS }
            });
        } catch (e) {
            // 老版本 supabase-js 不认部分参数时回退到最简构造
            return global.supabase.createClient(url, key);
        }
    }

    function ensureClient() {
        if (global.sb) return global.sb;
        var cfg = global.SQ_CONFIG || {};
        var url = global.SUPABASE_URL_OVERRIDE || cfg.supabaseUrl;
        var key = global.SUPABASE_KEY_OVERRIDE || cfg.supabaseAnonKey;
        if (url && key && global.supabase && global.supabase.createClient) {
            try {
                global.sb = createClient(url, key);
            } catch (e) { noteError('createClient', e); }
        }
        return global.sb || null;
    }

    // CDN 主源失败时，自动从备用源补载 supabase-js（只试一次，避免循环）
    function ensureSupabaseLoaded(cb) {
        if (global.supabase && global.supabase.createClient) { cb(true); return; }
        if (global.__sq_supabase_loading) { cb(false); return; }
        global.__sq_supabase_loading = true;
        var src = FALLBACK_CDNS[0];
        try {
            var s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = function () {
                global.__sq_supabase_loading = false;
                ensureClient();
                cb(!!(global.supabase && global.supabase.createClient));
            };
            s.onerror = function () {
                global.__sq_supabase_loading = false;
                noteError('supabase-sdk-load', new Error('SDK 加载失败: ' + src));
                cb(false);
            };
            document.head.appendChild(s);
        } catch (e) { cb(false); }
    }

    ensureClient();

    /** 是否已就绪 */
    function ready() { return !!global.sb; }

    /**
     * 表访问入口。等价于 window.sb.from(table)。
     * 若客户端尚未建好会尝试同步补建；仍未建好则抛可见错误（不再静默返回空）。
     */
    function table(name) {
        var c = ensureClient();
        if (!c) {
            var err = new Error('后端未就绪（SDK 未加载），请检查网络后刷新');
            noteError('table:' + name, err);
            throw err;
        }
        return c.from(name);
    }

    /** 统计行数：失败时返回 0，但会记录 lastError（不再静默吞错） */
    async function count(tableName, build) {
        try {
            var q = table(tableName).select('*', { count: 'exact', head: true });
            if (build) q = build(q);
            var res = await q;
            if (res.error) throw res.error;
            return res.count || 0;
        } catch (e) {
            noteError('count:' + tableName, e);
            return 0;
        }
    }

    global.SQData = {
        ready: ready,
        table: table,
        count: count,
        ensureClient: ensureClient,
        ensureSupabaseLoaded: ensureSupabaseLoaded,
        lastError: function () { return lastError; },
        onError: function (fn) { if (typeof fn === 'function') statusListeners.push(fn); }
    };
})(window);
