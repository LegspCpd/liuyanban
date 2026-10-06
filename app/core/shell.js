/* ============================================================================
 *  L6 · 页面外壳层
 *  ---------------------------------------------------------------------------
 *  顶部品牌栏与底部导航栏的统一渲染。
 * ============================================================================ */
(function (global) {
    'use strict';

    var cfg = global.SQ_CONFIG;
    var U = global.SQUtil;

    function renderHeader(title, activeTab) {
        var user = global.getSessionUser();
        var headerContainer = document.getElementById('header-container');
        if (!headerContainer) return;

        var userAreaHtml;
        if (user && user.id) {
            var avatar = user.avatar_url || global.getUserAvatar(user);
            var displayName = user.nickname || '用户';
            var avatarStyle = '', avatarContent = '';
            if (U.isRemoteAvatar(avatar)) {
                avatarStyle = 'background-image:url(' + avatar + ');background-size:cover;background-position:center;';
            } else {
                avatarContent = U.initialOf(displayName);
            }
            userAreaHtml = '<div class="user-area" onclick="window.location.href=\'' + cfg.basePath + 'user.html\'">' +
                '<div class="avatar" style="' + avatarStyle + '">' + avatarContent + '</div>' +
                '<span class="user-name">' + U.escapeHtml(displayName) + '</span>' +
                '<span class="chevron">▾</span>' +
                '</div>';
        } else {
            userAreaHtml = '<div class="user-area" onclick="window.location.href=\'' + cfg.basePath + 'index.html\'">登录</div>';
        }

        headerContainer.innerHTML = '<div class="app-header">' +
            '<div class="brand" onclick="window.location.href=\'' + cfg.basePath + 'posts.html\'">' +
            'Seven<span>戚</span><small>· ' + U.escapeHtml(title) + '</small>' +
            '</div>' + userAreaHtml + '</div>';
    }

    function renderFooterBase(activeTab) {
        var tabs = [
            { id: 'posts', name: '帖子', href: cfg.basePath + 'posts.html' },
            { id: 'messages', name: '留言板', href: cfg.basePath + 'messages.html' },
            { id: 'chats', name: '消息', href: cfg.basePath + 'chats.html' },
            { id: 'profile', name: '个人', href: cfg.basePath + 'user.html' }
        ];

        var footerHtml = '<div class="app-tabs">';
        tabs.forEach(function (tab) {
            var activeClass = (tab.id === activeTab) ? 'active' : '';
            var icon = global.FOOTER_ICONS[tab.id] || '';
            footerHtml += '<a href="' + tab.href + '" class="tab-btn ' + activeClass + '" style="position:relative;">' +
                '<span class="tab-icon">' + icon + '</span>' + U.escapeHtml(tab.name) + '</a>';
        });
        footerHtml += '</div>';

        var footerContainer = document.getElementById('footer-container');
        if (footerContainer) footerContainer.innerHTML = footerHtml;
    }

    function renderFooter(activeTab) {
        renderFooterBase(activeTab);
        if (global.getSessionUser() && global.sb) global.updateChatBadge();
    }

    global.SQShell = {
        renderHeader: renderHeader,
        renderFooterBase: renderFooterBase,
        renderFooter: renderFooter
    };

    global.renderHeader = renderHeader;
    global.renderFooterBase = renderFooterBase;
    global.renderFooter = renderFooter;
})(window);
