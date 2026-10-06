/* 七戚 · profile页模块，由 app/profile.html 内联脚本拆分，DOM区未动，加载顺序即依赖顺序 */
        // ============ 举报处理（带措施选择） ============
        async function handleReport(reportId, result) {
            if (result === 'approved') {
                openMeasureDialog(reportId);
            } else {
                showConfirm('驳回举报', '确定驳回此举报吗？举报人会收到通知。', async function() {
                    try {
                        var rejRes = await window.sb.from('reports').update({
                            status: 'rejected',
                            reviewed_by: currentUser.id,
                            reviewed_at: new Date().toISOString()
                        }).eq('id', reportId);
                        if (rejRes.error && /reviewed_|column|schema cache/i.test(rejRes.error.message || '')) {
                            // 老库缺审核列：降级为只改状态
                            rejRes = await window.sb.from('reports').update({ status: 'rejected' }).eq('id', reportId);
                        }
                        if (rejRes.error) throw rejRes.error;

                        var rRes = await window.sb.from('reports').select('*').eq('id', reportId).single();
                        if (rRes.error) throw rRes.error;
                        var report = rRes.data;
                        var typeText = { post: '帖子', comment: '评论', message: '留言', chat: '聊天消息' }[report.content_type] || '内容';
                        var snippet = await getFullSnippet(report);

                        await window.pushNotification(report.reporter_id, {
                            type: 'report_result',
                            notification_type: 'report_result',
                            extra_text: '你举报的' + typeText + '「' + snippet + '」经审核未违反社区规定，已驳回。'
                        });

                        showToast('已驳回，举报人已收到通知');
                        loadNotifications();
                    } catch (err) { showToast('驳回失败：' + err.message); }
                });
            }
        }
        window.handleReport = handleReport;

        async function getFullSnippet(report) {
            try {
                if (report.content_type === 'post') {
                    var r = await window.sb.from('posts').select('title, content').eq('id', report.content_id).single();
                    if (r.data) {
                        var s = (r.data.title || r.data.content || '').replace(/<[^>]*>/g, '').trim();
                        return s.substring(0, 20) || '（无内容）';
                    }
                } else if (report.content_type === 'message') {
                    var r2 = await window.sb.from('messages').select('text').eq('id', report.content_id).single();
                    if (r2.data) return (r2.data.text || '').substring(0, 20) || '（无内容）';
                } else if (report.content_type === 'chat') {
                    var r3 = await window.sb.from('chats').select('content').eq('id', report.content_id).single();
                    if (r3.data) return (r3.data.content || '').substring(0, 20) || '（无内容）';
                } else if (report.content_type === 'comment') {
                    var r4 = await window.sb.from('post_comments').select('content').eq('id', report.content_id).single();
                    if (r4.data) return (r4.data.content || '').substring(0, 20) || '（无内容）';
                }
            } catch (e) {}
            var s = (report.content_snapshot || '').replace(/<[^>]*>/g, '').trim();
            return s.substring(0, 20) || '（无内容）';
        }

        function openMeasureDialog(reportId) {
            var old = document.getElementById('measureOverlay');
            if (old) old.remove();

            var overlay = document.createElement('div');
            overlay.id = 'measureOverlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;';

            overlay.innerHTML =
                '<div style="background:#fff;border-radius:16px;max-width:440px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.2);">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;padding:18px 20px 12px;border-bottom:1px solid #e8f0e8;">' +
                        '<h3 style="font-size:1.05em;margin:0;display:flex;align-items:center;gap:6px;">' +
                            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                '<path d="M9 11l3 3L22 4"/>' +
                                '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' +
                            '</svg>' +
                            '选择处理措施' +
                        '</h3>' +
                        '<button id="measureClose" style="background:none;border:none;font-size:1.3em;cursor:pointer;color:#8aaa9a;padding:4px;display:flex;">' +
                            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                        '</button>' +
                    '</div>' +
                    '<div style="padding:16px 20px;overflow-y:auto;flex:1;">' +
                        '<div style="margin-bottom:14px;">' +
                            '<label style="display:block;font-size:0.75em;font-weight:600;color:#5a7a6a;margin-bottom:8px;">处理措施（必选）</label>' +
                            '<div style="display:flex;flex-direction:column;gap:8px;">' +
                                '<label class="measure-opt" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:2px solid #c8e0c8;border-radius:10px;cursor:pointer;font-size:0.9em;font-weight:600;">' +
                                    '<input type="radio" name="measureType" value="warn" style="accent-color:#2e7d32;"> 警告（发送警告通知）' +
                                '</label>' +
                                '<label class="measure-opt" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:2px solid #c8e0c8;border-radius:10px;cursor:pointer;font-size:0.9em;font-weight:600;">' +
                                    '<input type="radio" name="measureType" value="delete" style="accent-color:#2e7d32;"> 删除违规内容' +
                                '</label>' +
                                '<label class="measure-opt" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:2px solid #c8e0c8;border-radius:10px;cursor:pointer;font-size:0.9em;font-weight:600;">' +
                                    '<input type="radio" name="measureType" value="ban" style="accent-color:#2e7d32;"> 禁言处理' +
                                '</label>' +
                            '</div>' +
                        '</div>' +
                        '<div id="banDaysGroup" style="display:none;margin-bottom:14px;">' +
                            '<label style="display:block;font-size:0.75em;font-weight:600;color:#5a7a6a;margin-bottom:6px;">禁言天数</label>' +
                            '<input type="number" id="banDays" value="3" min="1" max="3650" style="width:100%;padding:10px 12px;border:2px solid #c8e0c8;border-radius:10px;font-family:inherit;font-size:0.9em;outline:none;box-sizing:border-box;">' +
                        '</div>' +
                        '<div style="background:#f5faf5;border:1px solid #e0e0e0;border-radius:8px;padding:10px 12px;font-size:0.78em;color:#5a7a6a;line-height:1.5;">' +
                            '处理后，举报人和被举报人都会收到站内通知。' +
                        '</div>' +
                    '</div>' +
                    '<div style="display:flex;gap:8px;padding:12px 20px 18px;border-top:1px solid #e8f0e8;">' +
                        '<button id="measureCancel" style="flex:1;padding:10px;border-radius:10px;border:none;background:#eaf3ea;color:#5a7a6a;font-weight:700;font-size:0.9em;cursor:pointer;font-family:inherit;">取消</button>' +
                        '<button id="measureOk" style="flex:1;padding:10px;border-radius:10px;border:none;background:#2e7d32;color:#fff;font-weight:700;font-size:0.9em;cursor:pointer;font-family:inherit;">确认处理</button>' +
                    '</div>' +
                '</div>';

            document.body.appendChild(overlay);

            var radios = overlay.querySelectorAll('input[name="measureType"]');
            var banGroup = overlay.querySelector('#banDaysGroup');

            radios.forEach(function(r) {
                r.onchange = function() {
                    banGroup.style.display = this.value === 'ban' ? 'block' : 'none';
                    overlay.querySelectorAll('.measure-opt').forEach(function(el) {
                        el.style.borderColor = '#c8e0c8';
                        el.style.background = '#fff';
                    });
                    this.parentElement.style.borderColor = '#2e7d32';
                    this.parentElement.style.background = '#e8f5e9';
                };
            });

            overlay.querySelector('#measureClose').onclick = function() { overlay.remove(); };
            overlay.querySelector('#measureCancel').onclick = function() { overlay.remove(); };
            overlay.querySelector('#measureOk').onclick = async function() {
                var sel = overlay.querySelector('input[name="measureType"]:checked');
                if (!sel) { alert('请选择处理措施'); return; }
                var measure = sel.value;
                var days = parseInt(overlay.querySelector('#banDays').value) || 3;
                overlay.remove();
                await doApproveReport(reportId, measure, days);
            };
        }
        window.openMeasureDialog = openMeasureDialog;

        async function doApproveReport(reportId, measure, banDays) {
            try {
                var rRes = await window.sb.from('reports').select('*').eq('id', reportId).single();
                if (rRes.error) throw rRes.error;
                var report = rRes.data;
                var typeText = { post: '帖子', comment: '评论', message: '留言', chat: '聊天消息' }[report.content_type] || '内容';
                var snippet = await getFullSnippet(report);

                var apRes = await window.sb.from('reports').update({
                    status: 'approved',
                    reviewed_by: currentUser.id,
                    reviewed_at: new Date().toISOString(),
                    measure: measure,
                    ban_days: measure === 'ban' ? banDays : null,
                    admin_note: measure + (measure === 'ban' ? '（' + banDays + '天）' : '')
                }).eq('id', reportId);
                if (apRes.error && /reviewed_|measure|ban_days|admin_note|column|schema cache/i.test(apRes.error.message || '')) {
                    // 老库缺审核列：降级为只改状态，措施照常执行（封禁/删帖/警告不受影响）
                    apRes = await window.sb.from('reports').update({ status: 'approved' }).eq('id', reportId);
                }
                if (apRes.error) throw apRes.error;

                var measureText = '';
                if (measure === 'ban') {
                    var until = new Date(Date.now() + banDays * 86400000).toISOString();
                    await window.sb.from('users').update({
                        banned_reason: '被举报违规',
                        banned_until: until
                    }).eq('id', report.reported_user_id);
                    measureText = '禁言 ' + banDays + ' 天（至 ' + new Date(until).toLocaleString('zh-CN') + '）';
                } else if (measure === 'delete') {
                    var tableMap = { post: 'posts', comment: 'post_comments', message: 'messages', chat: 'chats' };
                    var table = tableMap[report.content_type];
                    if (table) {
                        await window.sb.from(table).delete().eq('id', report.content_id);
                    }
                    measureText = '删除违规内容';
                } else if (measure === 'warn') {
                    measureText = '警告（已发送警告通知）';
                }

                await window.pushNotification(report.reporter_id, {
                    type: 'report_result',
                    notification_type: 'report_result',
                    extra_text: '你举报的' + typeText + '「' + snippet + '」已被接受并处理，处理措施：' + measureText
                });

                await window.pushNotification(report.reported_user_id, {
                    type: 'report_result',
                    notification_type: 'report_result',
                    extra_text: '你的' + typeText + '「' + snippet + '」被举报，目前对你采取：' + measureText + '，请文明聊天'
                });

                showToast('已处理，双方已收到通知');
                loadNotifications();
            } catch (err) { showToast('处理失败：' + err.message); }
        }
        window.doApproveReport = doApproveReport;

        async function viewReportDetail(reportId) {
            try {
                var res = await window.sb.from('reports').select('*').eq('id', reportId).single();
                if (res.error) throw res.error;
                var r = res.data;
                var typeText = { post: '帖子', comment: '评论', message: '留言', chat: '聊天消息' }[r.content_type] || '内容';
                var snippet = await getFullSnippet(r);
                var statusText = { pending: '待处理', approved: '已处理', rejected: '已驳回' }[r.status] || r.status;
                var detailText =
                    '类型：' + typeText + '\n' +
                    '内容摘要：' + snippet + '\n' +
                    '举报原因：' + r.reason + '\n' +
                    '补充描述：' + (r.description || '无') + '\n' +
                    '当前状态：' + statusText;
                showConfirm('举报详情', detailText, function() {});
            } catch (err) { showToast('加载失败：' + err.message); }
        }
        window.viewReportDetail = viewReportDetail;

        function goToFeedbackDetail(fid) {
            switchView('adminFeedbackView');
            loadAdminFeedback(fid);
        }
        window.goToFeedbackDetail = goToFeedbackDetail;

        document.querySelectorAll('.ntf-tab').forEach(function(tab) {
            tab.onclick = function() {
                document.querySelectorAll('.ntf-tab').forEach(function(t) { t.classList.remove('active'); });
                this.classList.add('active');
                currentNtfFilter = this.dataset.filter;
                renderNotifications();
            };
        });
        document.getElementById('markAllReadBtn').onclick = async function() {
            await window.sb.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false);
            showToast('全部已读');
            loadNotifications();
            if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
        };
