/* ============================================================================
 *  L4 · 数据访问层
 *  ---------------------------------------------------------------------------
 *  后端客户端的唯一持有者。页面原先在 8 个文件里各自
 *      var SUPABASE_URL = "..."; var SUPABASE_ANON_KEY = "...";
 *      window.sb = window.sb || window.supabase.createClient(...)
 *  现在收敛到此一处，凭据来源为 L0 配置（构建期可注入）。
 *
 *  保留 window.sb 作为对外句柄，现有上百处 window.sb.from(...) 调用无需改动；
 *  未来切换到 Neon 时，只需替换本文件的客户端实现。
 * ============================================================================ */
(function (global) {
    'use strict';

    if (!global.sb) {
        var cfg = global.SQ_CONFIG;

        // 优先使用构建期注入的凭据，回退到源码内默认值
        var url = global.SUPABASE_URL_OVERRIDE || cfg.supabaseUrl;
        var key = global.SUPABASE_KEY_OVERRIDE || cfg.supabaseAnonKey;

        if (url && key && global.supabase) {
            global.sb = global.supabase.createClient(url, key);
        }
    }

    /** 是否已就绪 */
    function ready() { return !!global.sb; }

    /**
     * 表访问入口。等价于 window.sb.from(table)，此处只是多一层可替换的接缝。
     * 新代码建议统一走这里，页面内既有调用可继续用 window.sb。
     */
    function table(name) {
        return global.sb.from(name);
    }

    /** 统计行数：select('*', { count:'exact', head:true }) 的通用封装 */
    async function count(tableName, build) {
        if (!ready()) return 0;
        try {
            var q = global.sb.from(tableName).select('*', { count: 'exact', head: true });
            if (build) q = build(q);
            var res = await q;
            if (res.error) throw res.error;
            return res.count || 0;
        } catch (e) {
            return 0;
        }
    }

    global.SQData = { ready: ready, table: table, count: count };
})(window);
