/* ============================================================================
 *  L5 · 业务能力层
 *  ---------------------------------------------------------------------------
 *  举报 / 通知 / 未读计数 / 封禁监听与横幅。
 *  此前散落在 common.js 与两个页面的「兜底副本」中，现统一到此处。
 * ============================================================================ */
(function (global) {
    'use strict';

    var cfg = global.SQ_CONFIG;

    // ============================================================ 举报

    async function submitReport(reporterId, reportedUserId, contentType, contentId, contentSnapshot, reason, description) {
        var res = await global.sb.from('reports').insert([{
            reporter_id: reporterId,
            reported_user_id: reportedUserId,
            content_type: contentType,
            content_id: contentId,
            content_snapshot: contentSnapshot,
            reason: reason,
            description: description || ''
        }]).select();
        if (res.error) throw res.error;
        var report = res.data[0];

        var adminRes = await global.sb.from('users').select('id').eq('phone', cfg.adminPhone).single();
        if (adminRes.data) {
            await pushNotification(adminRes.data.id, {
                type: 'report',
                notification_type: 'report',
                report_id: report.id,
                report_reason: reason,
                extra_text: contentSnapshot ? contentSnapshot.substring(0, 100) : ''
            });
        }
        return report;
    }

    function injectReportStyles() {
        if (document.getElementById('report-dialog-styles')) return;
        var style = document.createElement('style');
        style.id = 'report-dialog-styles';
        style.textContent =
'.report-overlay{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;}' +
        '.report-panel{background:#fff;border-radius:16px;max-width:460px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(0,0,0,0.2);overflow:hidden;}' +
        '.report-header{display:flex;justify-content:space-between;align-items:center;padding:18px 20px 12px;border-bottom:1px solid #e8f0e8;}' +
        '.report-header h3{font-size:1.05em;margin:0;display:flex;align-items:center;gap:8px;}' +
        '.report-header h3 svg{width:20px;height:20px;color:#e57373;}' +
        '.report-close{background:none;border:none;cursor:pointer;color:#8aaa9a;padding:4px;display:flex;}' +
        '.report-close svg{width:20px;height:20px;}' +
        '.report-body{padding:16px 20px;overflow-y:auto;flex:1;}' +
        '.report-field{margin-bottom:14px;}' +
        '.report-field label{display:block;font-size:0.75em;font-weight:600;color:#5a7a6a;margin-bottom:6px;}' +
        '.report-reasons{display:grid;grid-template-columns:1fr 1fr;gap:6px;}' +
        '.report-reason-option{display:flex;align-items:center;gap:6px;padding:8px 10px;border:1.5px solid #c8e0c8;border-radius:8px;font-size:0.85em;cursor:pointer;}' +
        '.report-reason-option input[type="radio"]{accent-color:#2e7d32;}' +
        '.report-field textarea{width:100%;padding:10px 12px;border:2px solid #c8e0c8;border-radius:10px;font-family:inherit;font-size:0.85em;outline:none;resize:vertical;min-height:70px;box-sizing:border-box;}' +
        '.report-preview{background:#f5faf5;border:1px solid #e0e0e0;border-radius:8px;padding:10px 12px;font-size:0.8em;color:#5a7a6a;line-height:1.5;max-height:80px;overflow:hidden;}' +
        '.report-footer{display:flex;gap:8px;padding:12px 20px 18px;border-top:1px solid #e8f0e8;}' +
        '.report-footer button{flex:1;padding:10px;border-radius:10px;border:none;font-family:inherit;font-weight:700;font-size:0.9em;cursor:pointer;}' +
        '.report-cancel{background:#eaf3ea;color:#5a7a6a;}' +
        '.report-submit{background:#e57373;color:#fff;}'
        ;
        document.head.appendChild(style);
    }

    function openReportDialog(reportedUserId, contentType, contentId, contentSnapshot) {
        var old = document.getElementById('reportOverlay');
        if (old) old.remove();

        var overlay = document.createElement('div');
        overlay.className = 'report-overlay';
        overlay.id = 'reportOverlay';

        var typeText = { post: '帖子', comment: '评论', message: '留言', chat: '聊天消息' }[contentType] || '内容';

        overlay.innerHTML =
            '<div class="report-panel">' +
                '<div class="report-header">' +
                    '<h3>' + global.svgIcon('flag', 20) + ' 举报' + typeText + '</h3>' +
                    '<button class="report-close" onclick="closeReportDialog()">' + global.svgIcon('x', 20) + '</button>' +
                '</div>' +
                '<div class="report-body">' +
                    '<div class="report-field">' +
                        '<label>举报原因（必选）</label>' +
                        '<div class="report-reasons">' +
                            '<label class="report-reason-option"><input type="radio" name="reportReason" value="色情低俗"> 色情低俗</label>' +
                            '<label class="report-reason-option"><input type="radio" name="reportReason" value="骚扰辱骂"> 骚扰辱骂</label>' +
                            '<label class="report-reason-option"><input type="radio" name="reportReason" value="垃圾广告"> 垃圾广告</label>' +
                            '<label class="report-reason-option"><input type="radio" name="reportReason" value="虚假信息"> 虚假信息</label>' +
                            '<label class="report-reason-option"><input type="radio" name="reportReason" value="政治敏感"> 政治敏感</label>' +
                            '<label class="report-reason-option"><input type="radio" name="reportReason" value="其他"> 其他</label>' +
                        '</div>' +
                    '</div>' +
                    '<div class="report-field">' +
                        '<label>补充说明（选填）</label>' +
                        '<textarea id="reportDescription" placeholder="请描述具体情况..." maxlength="500"></textarea>' +
                    '</div>' +
                    '<div class="report-field">' +
                        '<label>被举报内容预览</label>' +
                        '<div class="report-preview">' + (contentSnapshot ? global.SQUtil.escapeHtml(contentSnapshot) : '(无内容)') + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="report-footer">' +
                    '<button class="report-cancel" onclick="closeReportDialog()">取消</button>' +
                    '<button class="report-submit" id="reportSubmitBtn">提交举报</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        document.getElementById('reportSubmitBtn').onclick = function () {
            var reasonEl = document.querySelector('input[name="reportReason"]:checked');
            if (!reasonEl) { global.showToast('请选择举报原因'); return; }
            var descEl = document.getElementById('reportDescription');
            var description = descEl ? descEl.value.trim() : '';
            doSubmitReport(reportedUserId, contentType, contentId, contentSnapshot, reasonEl.value, description);
        };

        injectReportStyles();
    }

    function closeReportDialog() {
        var el = document.getElementById('reportOverlay');
        if (el) el.remove();
    }

    async function doSubmitReport(reportedUserId, contentType, contentId, contentSnapshot, reason, description) {
        try {
            var cu = global.getSessionUser();
            if (!cu || !cu.id) { global.showToast('请先登录'); return; }
            await submitReport(cu.id, reportedUserId, contentType, contentId, contentSnapshot, reason, description);
            closeReportDialog();
            global.showToast('举报已提交，管理员会尽快处理');
        } catch (err) {
            global.showToast('举报失败：' + err.message);
        }
    }

    // ============================================================ 站内通知
    global.pushNotification = global.pushNotification || async function (userId, payload) {
        if (!global.sb || !userId) return;
        try {
            await global.sb.from('notifications').insert([Object.assign({
                user_id: userId,
                is_read: false
            }, payload)]);
            if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
        } catch (e) { console.warn('通知发送失败', e); }
    };

    async function updateNotificationBadge() {
        var user = global.getSessionUser();
        if (!user || !user.id || !global.sb) return;
        try {
            var res = await global.sb.from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_read', false);
            if (res.error) throw res.error;
            var footerContainer = document.getElementById('footer-container');
            if (!footerContainer) return;
            // 「个人」tab 实际指向 user.html（见 shell.js），历史查询 profile.html 永远命中不了
            var profileTab = footerContainer.querySelector('a[href="' + cfg.basePath + 'user.html"]') ||
                             footerContainer.querySelector('a[href="./user.html"]') ||
                             footerContainer.querySelector('a[href="' + cfg.basePath + 'profile.html"]') ||
                             footerContainer.querySelector('a[href="./profile.html"]');
            if (!profileTab) return;
            var old = profileTab.querySelector('.badge');
            if (old) old.remove();
            if (res.count > 0) {
                var badge = document.createElement('span');
                badge.className = 'badge';
                badge.style.cssText = 'position:absolute;top:-2px;right:15%;background:#e57373;color:#fff;font-size:0.5em;font-weight:700;padding:1px 5px;border-radius:99px;min-width:16px;text-align:center;transform:translateY(-2px);';
                badge.textContent = res.count > 9 ? '9+' : res.count;
                profileTab.appendChild(badge);
            }
        } catch (e) {}
    }

    // ============================================================ 未读计数
    async function getUnreadChatCount(userId) {
        if (!userId || !global.sb) return 0;
        try {
            var cnt = await global.sb.from('chats')
                .select('*', { count: 'exact', head: true })
                .gt('created_at', await getLastReadAt(userId))
                .neq('user_id', userId);
            if (cnt.error) throw cnt.error;
            return cnt.count || 0;
        } catch (e) { return 0; }

        async function getLastReadAt(uid) {
            var res = await global.sb.from('users').select('last_chat_read_at').eq('id', uid).single();
            if (res.error) throw res.error;
            return (res.data && res.data.last_chat_read_at) || new Date(0).toISOString();
        }
    }

    async function updateChatBadge() {
        var user = global.getSessionUser();
        if (!user || !user.id || !global.sb) return;
        var unread = await getUnreadChatCount(user.id);
        var footerContainer = document.getElementById('footer-container');
        if (!footerContainer) return;
        var chatTab = footerContainer.querySelector('a[href="' + cfg.basePath + 'chats.html"]') ||
                      footerContainer.querySelector('a[href="./chats.html"]');
        if (!chatTab) return;
        var old = chatTab.querySelector('.badge');
        if (old) old.remove();
        if (unread > 0) {
            var badge = document.createElement('span');
            badge.className = 'badge';
            badge.style.cssText = 'position:absolute;top:-2px;right:15%;background:#e57373;color:#fff;font-size:0.5em;font-weight:700;padding:1px 5px;border-radius:99px;min-width:16px;text-align:center;transform:translateY(-2px);';
            badge.textContent = unread > 9 ? '9+' : unread;
            chatTab.appendChild(badge);
        }
    }

    async function updateLastChatRead(userId) {
        if (!userId || !global.sb) return;
        try {
            await global.sb.from('users')
                .update({ last_chat_read_at: new Date().toISOString() })
                .eq('id', userId);
        } catch (e) {}
    }

    // ============================================================ 封禁
    function applyBanUpdate(bannedUntil, bannedReason) {
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

    /** 页面只要有 #bannedBanner 元素，就会被自动接管显隐 */
    function updateBanner() {
        var banner = document.getElementById('bannedBanner');
        if (!banner) return;
        var user = global.getSessionUser();
        var isBanned = !!(user && user.banned_until && new Date(user.banned_until) > new Date());

        if (isBanned) {
            banner.classList.add('active');
            banner.style.display = 'block';
            var display = document.getElementById('bannedUntilDisplay');
            if (display) {
                display.textContent = new Date(user.banned_until).toLocaleString('zh-CN', {
                    year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }
            ['newPostBtn', 'floatingPostBtn'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) { el.style.opacity = '0.5'; el.style.pointerEvents = 'none'; }
            });
        } else {
            banner.classList.remove('active');
            banner.style.display = 'none';
            ['newPostBtn', 'floatingPostBtn'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) { el.style.opacity = ''; el.style.pointerEvents = ''; }
            });
        }
    }

    // ============================================================ 导出
    global.SQMods = {
        submitReport: submitReport,
        openReportDialog: openReportDialog,
        closeReportDialog: closeReportDialog,
        doSubmitReport: doSubmitReport,
        injectReportStyles: injectReportStyles,
        updateNotificationBadge: updateNotificationBadge,
        getUnreadChatCount: getUnreadChatCount,
        updateChatBadge: updateChatBadge,
        updateLastChatRead: updateLastChatRead,
        updateBanner: updateBanner
    };

    global.submitReport = submitReport;
    global.openReportDialog = openReportDialog;
    global.closeReportDialog = closeReportDialog;
    global.doSubmitReport = doSubmitReport;
    global.updateNotificationBadge = updateNotificationBadge;
    global.updateChatBadge = updateChatBadge;
    global.getUnreadChatCount = getUnreadChatCount;
    global.updateLastChatRead = updateLastChatRead;
    global.updateGlobalBanBanner = updateBanner;
})(window);
