/* 七戚 · profile页模块，由 app/profile.html 内联脚本拆分，DOM区未动，加载顺序即依赖顺序 */
        // ============ 反馈模块 ============
        var allSites = [];
        var selectedSiteId = null;
        var fbCurrentTab = 'submit';

        async function loadSites() {
            var res = await window.sb.from('feedback_sites').select('*').order('sort_order', { ascending: true });
            allSites = res.data || [];
        }

        async function initFeedbackView() {
            if (!allSites.length) await loadSites();
            renderSiteGrid();
            switchFbTab('submit');
        }

        function renderSiteGrid() {
            var g = document.getElementById('siteGrid');
            if (!allSites.length) {
                g.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px 0;grid-column:1/-1;font-size:0.85em;">暂无网站</div>';
                return;
            }
            g.innerHTML = allSites.map(function(s) {
                return '<div class="site-card' + (selectedSiteId === s.id ? ' selected' : '') + '" data-id="' + s.id + '">' +
                    '<div class="site-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg></div>' +
                    '<div class="site-name">' + escapeHtml(s.name) + '</div>' +
                '</div>';
            }).join('');
            g.querySelectorAll('.site-card').forEach(function(el) {
                el.onclick = function() {
                    selectedSiteId = this.dataset.id;
                    g.querySelectorAll('.site-card').forEach(function(x) { x.classList.remove('selected'); });
                    this.classList.add('selected');
                };
            });
        }

        function switchFbTab(tab) {
            fbCurrentTab = tab;
            document.getElementById('fbSubmitPanel').style.display = tab === 'submit' ? 'block' : 'none';
            document.getElementById('fbMinePanel').style.display = tab === 'mine' ? 'block' : 'none';
            document.getElementById('fbTabNew').style.color = tab === 'submit' ? 'var(--primary)' : 'var(--text-muted)';
            document.getElementById('fbTabMine').style.color = tab === 'mine' ? 'var(--primary)' : 'var(--text-muted)';
            if (tab === 'mine') loadMyFeedback();
        }
        document.getElementById('fbTabNew').onclick = function() { switchFbTab('submit'); };
        document.getElementById('fbTabMine').onclick = function() { switchFbTab('mine'); };

        document.getElementById('fbSubmitBtn').onclick = async function() {
            if (!selectedSiteId) return showToast('请先选择网站');
            var content = document.getElementById('fbContent').value.trim();
            if (!content) return showToast('请填写问题描述');
            var contact = document.getElementById('fbContact').value.trim();
            var site = allSites.find(function(s) { return s.id === selectedSiteId; });
            var btn = this;
            btn.disabled = true; btn.textContent = '提交中...';
            try {
                var ins = await window.sb.from('feedback').insert([{
                    user_id: currentUser.id,
                    user_nickname: currentUser.nickname,
                    site_id: selectedSiteId,
                    site_name: site.name,
                    content: content,
                    contact: contact
                }]).select();
                if (ins.error) throw ins.error;

                var adminRes = await window.sb.from('users').select('id').eq('phone', SQ_CONFIG.adminPhone).single();
                if (adminRes.data) {
                    await window.pushNotification(adminRes.data.id, {
                        type: 'feedback', notification_type: 'feedback',
                        feedback_id: ins.data[0].id,
                        extra_text: '[' + site.name + '] ' + content.substring(0, 60)
                    });
                }
                showToast('反馈已提交，感谢你的反馈！');
                document.getElementById('fbContent').value = '';
                document.getElementById('fbContact').value = '';
                selectedSiteId = null;
                renderSiteGrid();
            } catch (err) { showToast('提交失败：' + err.message); }
            btn.disabled = false; btn.textContent = '提交反馈';
        };

        async function loadMyFeedback() {
            var c = document.getElementById('myFeedbackList');
            c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px 0;font-size:0.85em;">加载中...</div>';
            var res = await window.sb.from('feedback').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
            var data = res.data || [];
            if (!data.length) {
                c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px 0;font-size:0.85em;">还没有反馈记录</div>';
                return;
            }
            var statusMap = { pending: '待处理', replied: '已回复', resolved: '已解决' };
            c.innerHTML = data.map(function(f) {
                return '<div class="fb-item">' +
                    '<div class="fb-head">' +
                        '<span class="fb-site">' + escapeHtml(f.site_name) + '</span>' +
                        '<span class="fb-status ' + f.status + '">' + (statusMap[f.status] || f.status) + '</span>' +
                    '</div>' +
                    '<div class="fb-content">' + escapeHtml(f.content) + '</div>' +
                    (f.admin_reply ? '<div class="fb-reply"><b>管理员回复：</b>' + escapeHtml(f.admin_reply) + '</div>' : '') +
                    '<div class="fb-time">' + new Date(f.created_at).toLocaleString('zh-CN') + '</div>' +
                '</div>';
            }).join('');
        }

        // ============ 管理员反馈管理 ============
        var highlightFbId = null;
        async function loadAdminFeedback(highlightId) {
            highlightFbId = highlightId || null;
            var c = document.getElementById('adminFeedbackList');
            c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px 0;font-size:0.85em;">加载中...</div>';
            var res = await window.sb.from('feedback').select('*').order('created_at', { ascending: false });
            var data = res.data || [];
            if (!data.length) {
                c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px 0;font-size:0.85em;">还没有反馈</div>';
                return;
            }
            var statusMap = { pending: '待处理', replied: '已回复', resolved: '已解决' };
            c.innerHTML = data.map(function(f) {
                var isHl = (highlightFbId && f.id === highlightFbId);
                return '<div class="fb-item" style="' + (isHl ? 'border:2px solid var(--primary);' : '') + '">' +
                    '<div class="fb-head">' +
                        '<span class="fb-site">[' + escapeHtml(f.site_name) + '] ' + escapeHtml(f.user_nickname || '匿名') + '</span>' +
                        '<span class="fb-status ' + f.status + '">' + (statusMap[f.status] || f.status) + '</span>' +
                    '</div>' +
                    '<div class="fb-content">' + escapeHtml(f.content) + '</div>' +
                    (f.contact ? '<div class="fb-time">联系方式：' + escapeHtml(f.contact) + '</div>' : '') +
                    (f.admin_reply ? '<div class="fb-reply"><b>已回复：</b>' + escapeHtml(f.admin_reply) + '</div>' : '') +
                    '<div class="fb-time">' + new Date(f.created_at).toLocaleString('zh-CN') + '</div>' +
                    '<div class="fb-actions">' +
                        '<button class="btn-reply" onclick="replyFeedback(\'' + f.id + '\')">' + (f.admin_reply ? '重新回复' : '回复') + '</button>' +
                        '<button class="btn-del" onclick="deleteFeedback(\'' + f.id + '\')">删除</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        }

        var replyingFeedbackId = null;
        function replyFeedback(fid) {
            replyingFeedbackId = fid;
            document.getElementById('replyText').value = '';
            document.getElementById('replyModal').classList.add('active');
            document.getElementById('replyText').focus();
        }
        window.replyFeedback = replyFeedback;

        document.getElementById('replyCancel').onclick = function() {
            document.getElementById('replyModal').classList.remove('active');
            replyingFeedbackId = null;
        };
        document.getElementById('replyOk').onclick = async function() {
            var txt = document.getElementById('replyText').value.trim();
            if (!txt) return showToast('请输入回复内容');
            try {
                var res = await window.sb.from('feedback').select('*').eq('id', replyingFeedbackId).single();
                var f = res.data;
                await window.sb.from('feedback').update({ admin_reply: txt, status: 'replied' }).eq('id', replyingFeedbackId);
                if (f && f.user_id) {
                    await window.pushNotification(f.user_id, {
                        type: 'feedback', notification_type: 'feedback',
                        feedback_id: replyingFeedbackId,
                        extra_text: '管理员回复了你的反馈：' + txt.substring(0, 60)
                    });
                }
                document.getElementById('replyModal').classList.remove('active');
                replyingFeedbackId = null;
                showToast('回复已发送');
                loadAdminFeedback();
            } catch (err) { showToast('回复失败：' + err.message); }
        };

        async function deleteFeedback(fid) {
            showConfirm('删除反馈', '确定删除此条反馈吗？', async function() {
                try {
                    var r = await window.sb.from('feedback').delete().eq('id', fid);
                    if (r.error) throw r.error;
                    showToast('已删除');
                    loadAdminFeedback();
                } catch (err) { showToast('删除失败：' + err.message); }
            });
        }
        window.deleteFeedback = deleteFeedback;
