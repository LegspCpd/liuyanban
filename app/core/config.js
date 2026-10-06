/* ============================================================================
 *  L0 · 配置层
 *  ---------------------------------------------------------------------------
 *  全站唯一的运行时配置来源。构建期可通过注入
 *      window.__SQ_BUILD_CONFIG__ 覆盖任意字段（见 scripts/build.mjs）。
 *  管理员判定、平台凭据等原先散落各页面的硬编码统一收敛到此处。
 * ============================================================================ */
(function (global) {
    'use strict';

    var DEFAULTS = {
        // 后端连接凭据：原先硬编码于 8 个页面，现收敛为一处，
        // 构建期可通过 vars.SUPABASE_URL / vars.SUPABASE_ANON_KEY 注入覆盖
        supabaseUrl: 'https://ulvhuqtpdafspbdvkogs.supabase.co',
        supabaseAnonKey: 'sb_publishable_b3zSRFSj9k73_tIxO1yJYw_IEK9tPLg',

        // 管理员手机号：原先硬编码于 10 个源文件共 17 处，现收敛为一处
        adminPhone: '17355394710',

        // 作者模式密码：原先硬编码于 messages/chats 两页（明文 "7592"），现收敛为一处；
        // 校验走 sha256 比对（见 verifyAuthorPassword），页面不再存明文
        authorPassword: '7592',

        // 后端平台：supabase | neon（仅用于展示与后续数据层切换，当前默认 supabase）
        platform: 'supabase',

        // 登录时把手机号映射为伪邮箱
        authEmailSuffix: '@sq.local',

        // 会话在 localStorage 中的键名
        sessionKey: 'sq_user_session',

        // 提示音开关的本地存储键名
        soundKey: 'sq_sound_enabled',

        // 封禁轮询兜底间隔（毫秒），Realtime 不可用时生效
        banPollIntervalMs: 8000,

        // 站点根路径；构建期会改写为 './'
        basePath: './'
    };

    var cfg = global.SQ_CONFIG || {};
    for (var k in DEFAULTS) {
        if (Object.prototype.hasOwnProperty.call(cfg, k)) continue;
        cfg[k] = DEFAULTS[k];
    }

    // 构建期注入覆盖
    var injected = global.__SQ_BUILD_CONFIG__;
    if (injected && typeof injected === 'object') {
        for (var key in injected) {
            if (injected[key] !== undefined && injected[key] !== null && injected[key] !== '') {
                cfg[key] = injected[key];
            }
        }
    }

    global.SQ_CONFIG = cfg;

    // -------------------------------------------------------------------------
    // 管理员判定：替换原先散落各处的 phone === '17355394710'
    // -------------------------------------------------------------------------
    global.isAdmin = function (user) {
        var u = user || global.getSessionUser();
        return !!(u && u.phone && String(u.phone) === String(cfg.adminPhone));
    };

    // 封禁判定：替换原先各页面重复的 isUserBanned()
    global.isUserBanned = function (user) {
        var u = user || global.getSessionUser();
        if (!u || !u.banned_until) return false;
        return new Date(u.banned_until) > new Date();
    };

    // 构造登录用的伪邮箱
    global.phoneToEmail = function (phone) {
        return String(phone) + cfg.authEmailSuffix;
    };

    // 作者密码校验（sha256 比对，避免页面散落明文）
    global.verifyAuthorPassword = async function (input) {
        var h = global.sha256Hex || global.sha256;
        if (typeof h !== 'function') return String(input) === String(cfg.authorPassword);
        var a = await h(String(input || ''));
        var b = await h(String(cfg.authorPassword));
        return a === b;
    };

    // 解析站内地址（统一走 basePath）
    global.sqUrl = function (path) {
        if (!path) return cfg.basePath;
        if (/^(https?:)?\/\//.test(path)) return path;
        return cfg.basePath + String(path).replace(/^\.\//, '');
    };
})(window);
