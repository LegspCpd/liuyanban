/* 七戚 · profile页模块，由 app/profile.html 内联脚本拆分，DOM区未动，加载顺序即依赖顺序 */
        // ============ 网站管理 ============
        async function loadAdminSites() {
            await loadSites();
            renderAdminSites();
        }
        function renderAdminSites() {
            var c = document.getElementById('adminSitesList');
            if (!allSites.length) {
                c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px 0;font-size:0.85em;">暂无网站，请在下方添加</div>';
                return;
            }
            c.innerHTML = allSites.map(function(s) {
                return '<div class="admin-site-item">' +
                    '<span class="site-name">' + escapeHtml(s.name) + '</span>' +
                    '<div class="site-actions">' +
                        '<button onclick="deleteSite(\'' + s.id + '\',\'' + escapeHtml(s.name).replace(/'/g, "\\'") + '\')">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
                        '删除</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        }
        document.getElementById('addSiteBtn').onclick = async function() {
            var name = document.getElementById('newSiteName').value.trim();
            if (!name) return showToast('请输入网站名称');
            try {
                var maxOrder = allSites.reduce(function(m, s) { return Math.max(m, s.sort_order || 0); }, 0);
                await window.sb.from('feedback_sites').insert([{ name: name, sort_order: maxOrder + 1 }]);
                document.getElementById('newSiteName').value = '';
                showToast('已添加');
                await loadSites();
                renderAdminSites();
            } catch (err) { showToast('添加失败：' + err.message); }
        };
        async function deleteSite(sid, name) {
            showConfirm('删除网站', '确定删除「' + name + '」吗？', async function() {
                await window.sb.from('feedback_sites').delete().eq('id', sid);
                showToast('已删除');
                await loadSites();
                renderAdminSites();
            });
        }
        window.deleteSite = deleteSite;

        // ============ 初始化 ============
        (function init() {
            var urlParams = new URLSearchParams(window.location.search);
            var view = urlParams.get('view');
            if (view === 'messages') {
                switchView('messagesView'); loadNotifications();
            } else if (view === 'feedback') {
                switchView('feedbackView'); initFeedbackView();
            } else if (view === 'adminfeedback' && isAdmin) {
                switchView('adminFeedbackView'); loadAdminFeedback();
            } else if (view === 'sites' && isAdmin) {
                switchView('manageSitesView'); loadAdminSites();
            } else if (view === 'about') {
                switchView('aboutView');
            } else if (view === 'avatar' || view === 'edit') {
                switchView('profileEditView');
            } else {
                window.location.href = '/liuyanban/user.html';
            }

            if (typeof updateNotificationBadge === 'function') {
                updateNotificationBadge();
            }
        })();

        document.addEventListener('gesturestart', function(e) { e.preventDefault(); });