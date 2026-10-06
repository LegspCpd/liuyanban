/* ============================================================================
 *  L1 · 基础工具层
 *  ---------------------------------------------------------------------------
 *  纯函数，无副作用，不依赖 DOM 之外的任何运行时状态。
 * ============================================================================ */
(function (global) {
    'use strict';

    /**
     * HTML 转义 —— 此前在 8 个文件中各写一份，现统一到此处。
     */
    function escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /** 安全 JSON.parse */
    function safeParse(raw, fallback) {
        if (!raw) return fallback;
        try { return JSON.parse(raw); } catch (e) { return fallback; }
    }

    /** 取昵称首字母（头像兜底用） */
    function initialOf(name) {
        return String(name || 'U').charAt(0).toUpperCase();
    }

    /** 头像地址是否为远程 URL */
    function isRemoteAvatar(url) {
        return !!(url && String(url).indexOf('http') === 0);
    }

    /** 生成 SVG data URI 占位头像 */
    function avatarDataUri(name, color) {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
            '<rect width="100" height="100" fill="' + (color || '#2e7d32') + '" rx="50"/>' +
            '<text x="50" y="58" font-size="40" text-anchor="middle" fill="white" font-family="sans-serif">' +
            initialOf(name) + '</text></svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    global.SQUtil = {
        escapeHtml: escapeHtml,
        safeParse: safeParse,
        initialOf: initialOf,
        isRemoteAvatar: isRemoteAvatar,
        avatarDataUri: avatarDataUri
    };

    // 兼容既有调用方式
    global.escapeHtml = escapeHtml;
})(window);
