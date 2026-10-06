/* ============================================================================
 *  L7 · 启动层
 *  ---------------------------------------------------------------------------
 *  页面加载时自动执行的行为：启动动画、加载遮罩、会话校验、
 *  在线状态、封号监听、封禁横幅、头像提醒。
 *  这些逻辑原先以 IIFE 形式混在 common.js 中，此处集中管理。
 * ============================================================================ */
(function (global) {
    'use strict';

    var cfg = global.SQ_CONFIG;

    // ============================================================ 启动动画
    (function bootLoader() {
        if (sessionStorage.getItem('sq_boot_shown') === '1') return;
        sessionStorage.setItem('sq_boot_shown', '1');

        if (!document.getElementById('boot-loader-styles')) {
            var style = document.createElement('style');
            style.id = 'boot-loader-styles';
            style.textContent =
                '.boot-loader-wrapper{position:fixed;inset:0;z-index:9999999;background:#000;display:flex;align-items:center;justify-content:center;font-family:"Poppins","Space Grotesk","PingFang SC",sans-serif;font-size:1.6em;font-weight:600;user-select:none;color:#fff;transition:opacity 1s ease;overflow:hidden;}' +
                '.boot-loader-wrapper.fade-out{opacity:0;pointer-events:none;}' +
                '.boot-loader-inner{position:relative;display:flex;align-items:center;justify-content:center;height:120px;width:auto;margin:2rem;transform:scale(1.55);}' +
                '.boot-loader{position:absolute;top:0;left:0;height:100%;width:100%;z-index:1;background-color:transparent;-webkit-mask:repeating-linear-gradient(90deg,transparent 0,transparent 6px,black 7px,black 8px);mask:repeating-linear-gradient(90deg,transparent 0,transparent 6px,black 7px,black 8px);}' +
                '.boot-loader::after{content:"";position:absolute;top:0;left:0;width:100%;height:100%;background-image:radial-gradient(circle at 50% 50%, #ff0 0%, transparent 50%),radial-gradient(circle at 45% 45%, #f00 0%, transparent 45%),radial-gradient(circle at 55% 55%, #0ff 0%, transparent 45%),radial-gradient(circle at 45% 55%, #0f0 0%, transparent 45%),radial-gradient(circle at 55% 45%, #00f 0%, transparent 45%);-webkit-mask:radial-gradient(circle at 50% 50%,transparent 0%,transparent 10%,black 25%);mask:radial-gradient(circle at 50% 50%,transparent 0%,transparent 10%,black 25%);animation:boot-transform 2s infinite alternate, boot-opacity 4s infinite;animation-timing-function:cubic-bezier(0.6,0.8,0.5,1);}' +
                '@keyframes boot-transform{0%{transform:translate(-55%);}100%{transform:translate(55%);}}' +
                '@keyframes boot-opacity{0%,100%{opacity:0;}15%{opacity:1;}65%{opacity:0;}}' +
                '.boot-letter{display:inline-block;opacity:0;animation:boot-letter-anim 4s infinite linear;z-index:2;white-space:pre;}' +
                '@keyframes boot-letter-anim{0%{opacity:0;}5%{opacity:1;text-shadow:0 0 4px #fff;transform:scale(1.1) translateY(-2px);}20%{opacity:0.2;}100%{opacity:0;}}';
            document.head.appendChild(style);
        }

        function insert() {
            if (!document.body) { document.addEventListener('DOMContentLoaded', insert); return; }
            var wrap = document.createElement('div');
            wrap.className = 'boot-loader-wrapper';
            wrap.id = 'bootLoader';
            var inner = document.createElement('div');
            inner.className = 'boot-loader-inner';
            var text = 'Seven戚 出品';
            text.split('').forEach(function (c, i) {
                var span = document.createElement('span');
                span.className = 'boot-letter';
                span.style.animationDelay = (0.1 + i * 0.105).toFixed(3) + 's';
                span.textContent = c;
                inner.appendChild(span);
            });
            var loaderDiv = document.createElement('div');
            loaderDiv.className = 'boot-loader';
            inner.appendChild(loaderDiv);
            wrap.appendChild(inner);
            document.body.appendChild(wrap);

            setTimeout(function () {
                setTimeout(function () {
                    wrap.classList.add('fade-out');
                    document.documentElement.classList.remove('sq-boot-hide');
                    setTimeout(function () { wrap.remove(); }, 1000);
                }, 300);
            }, 3500);
        }
        insert();
    })();

    // ============================================================ 加载遮罩
    (function pageLoading() {
        if (!document.getElementById('page-loading-styles')) {
            var st = document.createElement('style');
            st.id = 'page-loading-styles';
            st.textContent =
                '.page-loading-mask{position:fixed;inset:0;z-index:999999;background:var(--bg,#f5faf5);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;transition:opacity .35s ease;}' +
                '.page-loading-mask.fade-out{opacity:0;pointer-events:none;}' +
                '.page-loading-spinner{width:40px;height:40px;border:3px solid var(--border,#c8e0c8);border-top-color:var(--primary,#2e7d32);border-radius:50%;animation:pageLoadSpin .8s linear infinite;}' +
                '@keyframes pageLoadSpin{to{transform:rotate(360deg);}}' +
                '.page-loading-text{font-size:.8em;color:var(--text-muted,#5a7a6a);font-family:var(--font,system-ui,sans-serif);}';
            document.head.appendChild(st);
        }

        function show() {
            if (document.getElementById('pageLoadingMask')) return;
            var mask = document.createElement('div');
            mask.className = 'page-loading-mask';
            mask.id = 'pageLoadingMask';
            mask.innerHTML = '<div class="page-loading-spinner"></div><div class="page-loading-text">加载中…</div>';
            document.body.appendChild(mask);
        }

        function hide() {
            var m = document.getElementById('pageLoadingMask');
            if (!m) return;
            m.classList.add('fade-out');
            setTimeout(function () { m.remove(); }, 400);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', show);
        } else {
            show();
        }
        global.addEventListener('load', function () {
            setTimeout(hide, 200);   // 略微延后一点点，避免第一个页面闪失
        });
        setTimeout(hide, 8000);     // 兜底：最长 8 秒后强制隐藏
        global.hidePageLoading = hide;
    })();

    // ============================================================ 会话校验
    (function bootstrapSession() {
        function run() { global.syncSessionFromAuth(); }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { setTimeout(run, 300); });
        } else {
            setTimeout(run, 300);
        }
    })();

    // ============================================================ 头像提醒
    function showAvatarPrompt() {
        var old = document.getElementById('avatarPromptOverlay');
        if (old) return;

        var overlay = document.createElement('div');
        overlay.id = 'avatarPromptOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(30,58,46,0.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;animation:apFadeIn 0.3s ease;';

        overlay.innerHTML =
            '<div style="background:#fff;border-radius:16px;max-width:360px;width:100%;padding:2em;text-align:center;box-shadow:0 8px 32px rgba(46,125,50,0.12);border:1px solid #c8e0c8;animation:apPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1);">' +
                '<div style="width:72px;height:72px;border-radius:50%;background:#e8f5e9;display:grid;place-items:center;margin:0 auto 0.8em;">' +
                    '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        '<circle cx="12" cy="12" r="10"/>' +
                        '<circle cx="12" cy="10" r="3"/>' +
                        '<path d="M6.168 18.849A4 4 0 0 1 10 16h4a4 4 0 0 1 3.834 2.855"/>' +
                    '</svg>' +
                '</div>' +
                '<div style="font-size:1.15em;font-weight:700;color:#1e3a2e;margin-bottom:0.5em;line-height:1.4;">你还没有一个属于自己的标志呢！</div>' +
                '<div style="font-size:0.9em;color:#5a7a6a;line-height:1.6;margin-bottom:1.4em;">快点为自己设置一个个性头像吧~</div>' +
                '<div style="display:flex;gap:8px;">' +
                    '<button id="avatarPromptLater" style="flex:1;padding:0.75em;border-radius:10px;border:1.5px solid #c8e0c8;background:transparent;color:#5a7a6a;font-weight:600;font-size:0.9em;cursor:pointer;font-family:inherit;">稍后再说</button>' +
                    '<button id="avatarPromptGo" style="flex:1;padding:0.75em;border-radius:10px;border:none;background:#2e7d32;color:#fff;font-weight:700;font-size:0.9em;cursor:pointer;font-family:inherit;">去设置头像</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        if (!document.getElementById('avatar-prompt-styles')) {
            var style = document.createElement('style');
            style.id = 'avatar-prompt-styles';
            style.textContent =
                '@keyframes apFadeIn{from{opacity:0}to{opacity:1}}' +
                '@keyframes apPopIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}';
            document.head.appendChild(style);
        }

        document.getElementById('avatarPromptLater').onclick = function () {
            sessionStorage.setItem('sq_avatar_prompt_shown', '1');
            overlay.remove();
        };
        document.getElementById('avatarPromptGo').onclick = function () {
            sessionStorage.setItem('sq_avatar_prompt_shown', '1');
            window.location.href = cfg.basePath + 'profile.html?view=avatar';
        };
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                sessionStorage.setItem('sq_avatar_prompt_shown', '1');
                overlay.remove();
            }
        });
    }
    global.showAvatarPrompt = showAvatarPrompt;

    (function autoAvatarCheck() {
        function tryCheck() {
            var user = typeof global.getSessionUser === 'function' ? global.getSessionUser() : null;
            if (!user || !user.id) return;
            if (window.location.pathname.indexOf('profile.html') >= 0) return;
            if (global.SQUtil.isRemoteAvatar(user.avatar_url)) return;
            if (sessionStorage.getItem('sq_avatar_prompt_shown') === '1') return;
            showAvatarPrompt();
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { setTimeout(tryCheck, 900); });
        } else {
            setTimeout(tryCheck, 900);
        }
    })();

    // ============================================================ 全局聊天监听
    var globalChatChannel = null;
    var globalChatListenerInitialized = false;

    async function initializeGlobalChatListener() {
        var user = global.getSessionUser();
        if (!user || !user.id) return;
        if (globalChatChannel) {
            await global.sb.removeChannel(globalChatChannel);
            globalChatChannel = null;
            globalChatListenerInitialized = false;
        }
        if (globalChatListenerInitialized) return;
        globalChatChannel = global.sb.channel('global-chats-listener-' + user.id)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, function (payload) {
                var newMsg = payload.new;
                if (!newMsg || newMsg.user_id === user.id) return;
                global.updateChatBadge();
                if (global.getSoundEnabled()) global.playReminderSound();
                if (!window.location.href.includes('chats.html')) global.showChatNotificationBanner();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats' }, function () {
                global.updateChatBadge();
            })
            .subscribe();
        globalChatListenerInitialized = true;
    }
    global.initializeGlobalChatListener = initializeGlobalChatListener;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeGlobalChatListener);
    } else {
        initializeGlobalChatListener();
    }
    global.addEventListener('storage', function (e) {
        if (e.key === cfg.sessionKey) initializeGlobalChatListener();
    });

    // ============================================================ 在线状态
    (function initGlobalPresence() {
        function startPresence() {
            var user = (typeof global.getSessionUser === 'function') ? global.getSessionUser() : null;
            if (!user || !user.id || !global.sb) return;

            if (global.__globalPresenceChannel) {
                try { global.sb.removeChannel(global.__globalPresenceChannel); } catch (e) {}
                global.__globalPresenceChannel = null;
            }

            var ch = global.sb.channel('sq-chat-online', { config: { presence: { key: user.id } } });
            ch.on('presence', { event: 'sync' }, function () {});

            ch.subscribe(function (status) {
                if (status === 'SUBSCRIBED') {
                    ch.track({
                        user_id: user.id,
                        nickname: user.nickname || '用户',
                        avatar_url: user.avatar_url || '',
                        online_at: new Date().toISOString()
                    });
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setTimeout(startPresence, 3000);
                }
            });

            global.__globalPresenceChannel = ch;
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { setTimeout(startPresence, 300); });
        } else {
            setTimeout(startPresence, 300);
        }
        global.addEventListener('storage', function (e) {
            if (e.key === cfg.sessionKey) setTimeout(startPresence, 200);
        });
    })();

    // ============================================================ 封号监听
    (function initBanWatcher() {
        function startWatch() {
            var user = (typeof global.getSessionUser === 'function') ? global.getSessionUser() : null;
            if (!user || !user.id || !global.sb) return;

            if (global.__banWatchChannel) {
                try { global.sb.removeChannel(global.__banWatchChannel); } catch (e) {}
                global.__banWatchChannel = null;
            }

            // 1) Realtime 订阅：秒级生效
            global.__banWatchChannel = global.sb.channel('sq-ban-watch-' + user.id)
                .on('postgres_changes', {
                    event: 'UPDATE', schema: 'public', table: 'users', filter: 'id=eq.' + user.id
                }, function (payload) {
                    var n = payload.new || {};
                    applyBan(n.banned_until || null, n.banned_reason || null);
                })
                .subscribe();

            // 2) 轮询兜底：Realtime 挂了也能生效
            if (global.__banPollTimer) clearInterval(global.__banPollTimer);
            global.__banPollTimer = setInterval(async function () {
                var u = global.getSessionUser();
                if (!u || !u.id) return;
                try {
                    var res = await global.sb.from('users')
                        .select('banned_until, banned_reason').eq('id', u.id).single();
                    if (res.error || !res.data) return;
                    applyBan(res.data.banned_until || null, res.data.banned_reason || null);
                } catch (e) {}
            }, cfg.banPollIntervalMs);
        }

        function applyBan(bannedUntil, bannedReason) {
            var s = global.getSessionUser();
            if (!s) return;
            if ((s.banned_until || null) === (bannedUntil || null) &&
                (s.banned_reason || null) === (bannedReason || null)) return;
            s.banned_until = bannedUntil;
            s.banned_reason = bannedReason;
            global.setSessionUser(s);
            global.dispatchEvent(new CustomEvent('sq-ban-changed', {
                detail: { banned_until: bannedUntil, banned_reason: bannedReason }
            }));
            if (bannedUntil && new Date(bannedUntil) > new Date()) {
                global.showTopBanner('你的账号已被封禁：' + (bannedReason || '违规'));
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { setTimeout(startWatch, 500); });
        } else {
            setTimeout(startWatch, 500);
        }
        global.addEventListener('storage', function (e) {
            if (e.key === cfg.sessionKey) setTimeout(startWatch, 300);
        });
    })();

    // ============================================================ 封禁横幅
    (function initGlobalBanBanner() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { setTimeout(global.updateGlobalBanBanner, 100); });
        } else {
            setTimeout(global.updateGlobalBanBanner, 100);
        }
        global.addEventListener('sq-ban-changed', function () {
            setTimeout(global.updateGlobalBanBanner, 50);
        });
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) global.updateGlobalBanBanner();
        });
    })();
})(window);
