/* 七戚 · profile页模块，由 app/profile.html 内联脚本拆分，DOM区未动，加载顺序即依赖顺序 */
        // ============ 消息中心 ============
        var allNotifications = [];
        var currentNtfFilter = 'all';

        async function loadNotifications() {
            var c = document.getElementById('notificationList');
            c.innerHTML = '<div class="ntf-loading"><span class="spinner"></span>加载中...</div>';
            try {
                var res = await window.sb.from('notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
                if (res.error) throw res.error;
                allNotifications = res.data || [];
                renderNotifications();
                updateUnreadTabCount();
                var u = allNotifications.filter(function(n) { return !n.is_read; }).length;
                var h = document.getElementById('unreadHint');
                if (h) h.textContent = u > 0 ? '有 ' + u + ' 条未读通知' : '暂无未读通知';
                if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
            } catch (err) {
                c.innerHTML = '<div class="ntf-empty">加载失败：' + escapeHtml(err.message) + '</div>';
            }
        }

        function updateUnreadTabCount() {
            var u = allNotifications.filter(function(n) { return !n.is_read; }).length;
            var b = document.getElementById('unreadTabCount');
            if (b) { b.textContent = u > 9 ? '9+' : u; b.className = 'ntf-tab-badge' + (u > 0 ? ' visible' : ''); }
        }

        function renderNotifications() {
            var c = document.getElementById('notificationList');
            var f = allNotifications;
            if (currentNtfFilter === 'unread') f = f.filter(function(n) { return !n.is_read; });
            else if (currentNtfFilter === 'report') f = f.filter(function(n) { return n.notification_type === 'report' || n.type === 'report'; });
            else if (currentNtfFilter === 'feedback') f = f.filter(function(n) { return n.notification_type === 'feedback' || n.type === 'feedback'; });

            if (!f.length) {
                var msg = currentNtfFilter === 'unread' ? '没有未读通知' :
                          currentNtfFilter === 'report' ? '没有待处理的举报' :
                          currentNtfFilter === 'feedback' ? '暂无反馈通知' : '暂无通知';
                c.innerHTML = '<div class="ntf-empty"><div class="big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>' + msg + '</div>';
                return;
            }

            var g = { today: [], yesterday: [], earlier: [] };
            var now = new Date();
            var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            var t1 = new Date(t0.getTime() - 86400000);
            f.forEach(function(n) {
                var d = new Date(n.created_at);
                if (d >= t0) g.today.push(n);
                else if (d >= t1) g.yesterday.push(n);
                else g.earlier.push(n);
            });

            var html = '';
            function rg(label, items) {
                if (!items.length) return '';
                var s = '<div class="ntf-group-label">' + label + '</div>';
                items.forEach(function(n) { s += renderNotificationCard(n); });
                return s;
            }
            html += rg('今天', g.today) + rg('昨天', g.yesterday) + rg('更早', g.earlier);
            c.innerHTML = html;

            c.querySelectorAll('.ntf-card').forEach(function(el) {
                el.onclick = function(e) {
                    if (e.target.closest('.ntf-actions')) return;
                    var id = this.dataset.id;
                    var pid = this.dataset.postid;
                    var cid = this.dataset.commentid;
                    var nt = this.dataset.ntftype;
                    markNotificationRead(id);
                    if (nt === 'report' || nt === 'feedback') return;
                    if (pid && cid) window.location.href = '/liuyanban/posts.html?comment=' + cid + '&post=' + pid;
                };
            });
        }

        function renderNotificationCard(n) {
            var r = n.is_read;
            var nt = n.notification_type || n.type || 'comment';
            var t = formatRelativeTime(n.created_at);
            var icons = {
                comment: { cls: 'comment', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
                report: { cls: 'report', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
                system: { cls: 'system', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' },
                ban: { cls: 'ban', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' },
                report_result: { cls: 'result-ok', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' },
                feedback: { cls: 'feedback', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' }
            };
            var info = icons[nt] || icons.comment;
            var title = '', snippet = '';
            if (nt === 'report') { title = '新举报待处理'; snippet = '原因：' + (n.report_reason || '未填写') + (n.extra_text ? ' · ' + n.extra_text : ''); }
            else if (nt === 'feedback') { title = '用户提交了新反馈'; snippet = n.extra_text || '点击查看详情'; }
            else if (nt === 'ban') { title = '你的账号已被封禁'; snippet = '解封时间：' + (n.ban_until ? new Date(n.ban_until).toLocaleString('zh-CN') : '未知'); }
            else if (nt === 'report_result') { title = '举报处理结果'; snippet = n.extra_text || '管理员已处理你的举报'; }
            else { title = '收到新评论'; snippet = n.extra_text || n.comment_content || '有人评论了你的帖子'; }

            var actions = '';
            if (nt === 'report' && n.report_id) {
                actions = '<div class="ntf-actions">' +
                    '<button class="btn-view" onclick="event.stopPropagation();viewReportDetail(\'' + n.report_id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>查看</button>' +
                    '<button class="btn-approve" onclick="event.stopPropagation();handleReport(\'' + n.report_id + '\',\'approved\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>同意</button>' +
                    '<button class="btn-reject" onclick="event.stopPropagation();handleReport(\'' + n.report_id + '\',\'rejected\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>驳回</button>' +
                    '</div>';
            }
            if (nt === 'feedback' && n.feedback_id) {
                actions = '<div class="ntf-actions">' +
                    '<button class="btn-view" onclick="event.stopPropagation();goToFeedbackDetail(\'' + n.feedback_id + '\')">查看反馈</button>' +
                    '</div>';
            }

            return '<div class="ntf-card ' + (r ? '' : 'unread') + (nt === 'report' ? ' report-card' : '') + (nt === 'feedback' ? ' feedback-card' : '') +
                '" data-id="' + n.id + '" data-postid="' + (n.post_id || '') + '" data-commentid="' + (n.source_id || '') +
                '" data-ntftype="' + nt + '" data-reportid="' + (n.report_id || '') + '" data-feedbackid="' + (n.feedback_id || '') + '">' +
                '<div class="ntf-dot"></div>' +
                '<div class="ntf-type-icon ' + info.cls + '">' + info.svg + '</div>' +
                '<div class="ntf-body">' +
                    '<div class="ntf-title">' + title + '</div>' +
                    '<div class="ntf-snippet">' + escapeHtml(snippet) + '</div>' +
                    '<div class="ntf-meta"><span>' + t + '</span>' + (r ? '' : '<span class="unread-tag">未读</span>') + '</div>' +
                    actions +
                '</div>' +
            '</div>';
        }

        function formatRelativeTime(isoStr) {
            var now = new Date(), d = new Date(isoStr), diff = (now - d) / 1000;
            if (diff < 60) return '刚刚';
            if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
            if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
            if (diff < 172800) return '昨天';
            if (diff < 604800) return Math.floor(diff / 86400) + '天前';
            return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric' });
        }

        async function markNotificationRead(id) {
            try {
                await window.sb.from('notifications').update({ is_read: true }).eq('id', id);
                var n = allNotifications.find(function(x) { return x.id === id; });
                if (n) n.is_read = true;
                updateUnreadTabCount();
                if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
            } catch (e) {}
        }
