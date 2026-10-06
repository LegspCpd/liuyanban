/* ============================================================================
 *  L2 · UI 反馈层
 *  ---------------------------------------------------------------------------
 *  Toast / 确认框 / 输入框 / 图标 / 头像 / 横幅 / 提示音。
 *  这些能力此前在 8 个页面里各自重复实现，且行为并不一致：
 *    showToast   9 份，显示时长分别为 3000 / 2600 / 2200 ms
 *    showConfirm 6 份，签名与能力各不相同
 *  现统一到此处，各页面只消费不再重定义。
 * ============================================================================ */
(function (global) {
    'use strict';

    var U = global.SQUtil;

    // ---------------------------------------------------------------- 图标库
var SVG_ICONS = {
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    xCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    user2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>'
};

var FOOTER_ICONS = {
    messages: '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40 33V42C40 43.1046 39.1046 44 38 44H31.5" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 16V6C40 4.89543 39.1046 4 38 4H10C8.89543 4 8 4.89543 8 6V42C8 43.1046 8.89543 44 10 44H16" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 16H30" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M23 44L40 23" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M16 24H24" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
    posts: '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18V42H39V18L24 6L9 18Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 29V42H29V29H19Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M9 42H39" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
    chats: '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6H44V36H29L24 41L19 36H4V6Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 21H25.0025" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M33.001 21H34.9999" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M13.001 21H14.9999" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
    profile: '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 44C42 34.0589 33.9411 26 24 26C14.0589 26 6 34.0589 6 44" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

    function svgIcon(name, size) {
        var icon = SVG_ICONS[name];
        if (!icon) return '';
        if (size) return icon.replace('<svg ', '<svg width="' + size + '" height="' + size + '" ');
        return icon;
    }

    // 页脚图标样式（原先由 common.js 的 IIFE 注入）
    (function injectFooterIconStyles() {
        if (document.getElementById('footer-svg-icon-styles')) return;
        var style = document.createElement('style');
        style.id = 'footer-svg-icon-styles';
        style.textContent =
            '.tab-btn .tab-icon{display:flex;align-items:center;justify-content:center;width:1.7em;height:1.7em;line-height:1;}' +
            '.tab-btn .tab-icon svg{width:100%;height:100%;display:block;stroke:currentColor;fill:none;}' +
            '.tab-btn .tab-icon svg path,.tab-btn .tab-icon svg circle{stroke:currentColor;}' +
            '.header-settings-btn{background:none;border:none;cursor:pointer;padding:6px;color:var(--text,#1e3a2e);display:flex;border-radius:8px;}' +
            '.header-settings-btn svg{width:24px;height:24px;stroke:currentColor;fill:none;}' +
            '.header-settings-btn:hover{background:rgba(46,125,50,.1);}';
        document.head.appendChild(style);
    })();

    // ---------------------------------------------------------------- Toast
    var TOAST_MS = 3000;
    function showToast(msg) {
        var toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(global.toastTimer);
        global.toastTimer = setTimeout(function () { toast.classList.remove('show'); }, TOAST_MS);
    }

    // ---------------------------------------------------------------- 确认框
    /**
     * 统一确认框。
     *   showConfirm(title, body, onOk)                  常规用法
     *   showConfirm(title, body, onOk, prefKey, prefLabel) 带「不再提示」
     * 当页面不含 #confirmPref 元素时自动降级，不会报错。
     */
    function showConfirm(title, body, onOk, prefKey, prefLabel) {
        var m = document.getElementById('confirmModal');
        if (!m) return;
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmBody').textContent = body;

        var prefWrap = document.getElementById('confirmPref');
        var prefChk = document.getElementById('confirmPrefCheckbox');
        var prefLbl = document.getElementById('confirmPrefLabel');
        if (prefKey && prefWrap && prefChk && prefLbl) {
            prefWrap.style.display = 'flex';
            prefLbl.textContent = prefLabel || '不再提示';
            prefChk.checked = false;
        } else if (prefWrap) {
            prefWrap.style.display = 'none';
        }

        m.classList.add('active');

        var c = document.getElementById('confirmCancel');
        var o = document.getElementById('confirmOk');
        function cleanup() {
            m.classList.remove('active');
            c.onclick = null;
            o.onclick = null;
            m.removeEventListener('click', onBg);
        }
        function onBg(e) { if (e.target === m) cleanup(); }

        c.onclick = cleanup;
        o.onclick = function () {
            if (prefKey && prefChk && prefChk.checked) localStorage.setItem(prefKey, '1');
            if (onOk) onOk();
            cleanup();
        };
        m.addEventListener('click', onBg);
    }

    // ---------------------------------------------------------------- 输入框
    function showPrompt(title, msg, placeholder, onOk, inputType) {
        inputType = inputType || 'text';
        var m = document.getElementById('promptModal');
        if (!m) return;
        document.getElementById('promptTitle').textContent = title;
        document.getElementById('promptMessage').textContent = msg;
        var input = document.getElementById('promptInput');
        input.type = inputType; input.value = ''; input.placeholder = placeholder || '';
        m.classList.add('active'); input.focus();

        var cancel = document.getElementById('promptCancel');
        var ok = document.getElementById('promptOk');
        function cleanup() {
            m.classList.remove('active');
            cancel.onclick = null; ok.onclick = null; input.onkeydown = null;
        }
        cancel.onclick = cleanup;
        ok.onclick = function () { var val = input.value.trim(); if (onOk) onOk(val); cleanup(); };
        input.onkeydown = function (e) { if (e.key === 'Enter') ok.click(); };
    }

    // ---------------------------------------------------------------- 头像
    function getUserAvatar(user) {
        if (user && user.avatar_url) return user.avatar_url;
        return U.avatarDataUri(user ? user.nickname : 'U');
    }

    // ---------------------------------------------------------------- 顶部横幅
    var topBannerTimeout = null;
    function showTopBanner(text) {
        var old = document.querySelector('.custom-top-banner');
        if (old) { old.remove(); clearTimeout(topBannerTimeout); }
        var banner = document.createElement('div');
        banner.className = 'custom-top-banner';
        banner.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#2e7d32;color:#fff;padding:12px 28px;border-radius:50px;z-index:99999;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:"Space Grotesk","PingFang SC",sans-serif;font-weight:600;font-size:0.9em;display:flex;align-items:center;gap:8px;white-space:nowrap;';
        banner.innerHTML = svgIcon('bell', 18) + '<span>' + U.escapeHtml(text || '收到新消息') + '</span>';
        banner.addEventListener('click', function () {
            banner.remove();
            clearTimeout(topBannerTimeout);
            global.sqUrl('profile.html?view=messages') && (window.location.href = global.sqUrl('profile.html?view=messages'));
        });
        document.body.appendChild(banner);
        topBannerTimeout = setTimeout(function () { banner.remove(); }, 5000);
    }

    // ---------------------------------------------------------------- 聊天横幅
    var chatNotificationBanner = null;
    function showChatNotificationBanner() {
        if (chatNotificationBanner) {
            chatNotificationBanner.remove();
            clearTimeout(chatNotificationBanner._timeout);
        }
        var banner = document.createElement('div');
        banner.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#2e7d32;color:white;padding:12px 28px;border-radius:50px;z-index:99999;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:"Space Grotesk","PingFang SC",sans-serif;font-weight:600;font-size:0.9em;display:flex;align-items:center;gap:8px;white-space:nowrap;';
        banner.innerHTML = svgIcon('bell', 18) + '<span>收到一条新消息</span>';
        banner.addEventListener('click', function () {
            window.location.href = global.sqUrl('chats.html');
            banner.remove();
        });
        document.body.appendChild(banner);
        chatNotificationBanner = banner;
        banner._timeout = setTimeout(function () { banner.remove(); chatNotificationBanner = null; }, 3000);
    }

    // ---------------------------------------------------------------- 提示音
    function playReminderSound() {
        try {
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            var ctx = new AudioCtx();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.28);
            setTimeout(function () { ctx.close(); }, 400);
        } catch (e) {}
    }

    function getSoundEnabled() {
        return localStorage.getItem(global.SQ_CONFIG.soundKey) !== 'false';
    }

    global.SQUI = {
        svgIcon: svgIcon, showToast: showToast, showConfirm: showConfirm,
        showPrompt: showPrompt, getUserAvatar: getUserAvatar,
        showTopBanner: showTopBanner, showChatNotificationBanner: showChatNotificationBanner,
        playReminderSound: playReminderSound, getSoundEnabled: getSoundEnabled
    };

    // 兼容既有全局调用
    global.SVG_ICONS = SVG_ICONS;
    global.FOOTER_ICONS = FOOTER_ICONS;
    global.svgIcon = svgIcon;
    global.showToast = showToast;
    global.showConfirm = showConfirm;
    global.showPrompt = showPrompt;
    global.getUserAvatar = getUserAvatar;
    global.showTopBanner = showTopBanner;
    global.showChatNotificationBanner = showChatNotificationBanner;
    global.playReminderSound = playReminderSound;
    global.getSoundEnabled = getSoundEnabled;
})(window);
