/* 七戚 · messages页模块，由 app/messages.html 内联脚本拆分，DOM区未动 */

        // ============================================================
        // 工具函数
        // ============================================================
        var COLORS = ["#6ee7b7", "#fbbf24", "#f87171", "#a78bfa", "#f472b6", "#38bdf8"];
        function pickColor(hex) {
            if (hex && /^#[0-9a-f]{6}$/i.test(hex) && hex.toLowerCase() !== "#000000") return hex;
            return COLORS[Math.floor(Math.random() * COLORS.length)];
        }

        // ============================================================
        // 作者模式
        // ============================================================
        var isAuthorMode = false;

        // ============================================================
        // 会话与权限
        // ============================================================
        var currentUser = null;
        var isAdminFlag = false;


        function getBannedUntil() {
            if (!currentUser || !currentUser.banned_until) return null;
            return new Date(currentUser.banned_until);
        }

        function updateBannedBanner() {
            const banner = document.getElementById('bannedBanner');
            const display = document.getElementById('bannedUntilDisplay');
            if (isUserBanned()) {
                banner.classList.add('active');
                const until = getBannedUntil();
                display.textContent = until ? until.toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未知';
                document.getElementById('sendMsgBtn').disabled = true;
                document.getElementById('msgInput').disabled = true;
                document.getElementById('msgInput').placeholder = '账号已被封禁，无法留言';
            } else {
                banner.classList.remove('active');
                document.getElementById('sendMsgBtn').disabled = false;
                document.getElementById('msgInput').disabled = false;
                document.getElementById('msgInput').placeholder = '写留言…';
            }
        }

        // ============================================================
        // 数据操作
        // ============================================================
        var messages = [];

        async function fetchMessages() {
            const { data, error } = await window.sb
                .from('messages')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        }

        async function addMessage(name, text, color, ip, isOfficial, isPinned, parentId) {
            const insertObj = {
                name: name,
                text: text,
                color: color,
                ip: ip,
                is_official: isOfficial,
                is_pinned: isPinned || false
            };
            if (parentId && parentId.trim() !== '') {
                insertObj.parent_id = parentId.trim();
            }
            const { data, error } = await window.sb
                .from('messages')
                .insert([insertObj]);
            if (error) throw error;
            return data;
        }

        async function deleteMessage(id) {
            const { data: children } = await window.sb
                .from('messages')
                .select('id')
                .eq('parent_id', id);
            if (children && children.length) {
                const childIds = children.map(c => c.id);
                const { error: delChild } = await window.sb
                    .from('messages')
                    .delete()
                    .in('id', childIds);
                if (delChild) throw delChild;
            }
            const { error } = await window.sb
                .from('messages')
                .delete()
                .eq('id', id);
            if (error) throw error;
        }

        async function deleteCommentOnly(id) {
            const { error } = await window.sb
                .from('messages')
                .delete()
                .eq('id', id);
            if (error) throw error;
        }

        // ============================================================
        // 获取 IP
        // ============================================================
        async function fetchIP() {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            try {
                var res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
                var data = await res.json();
                return data.ip || "0.0.0.0";
            } catch (e) { return "0.0.0.0"; } finally { clearTimeout(timeoutId); }
        }

        // ============================================================
        // 渲染留言板
        // ============================================================
        var messagesLoading = false;
        var messagesError = null;

        async function renderMessages() {
            const container = document.getElementById('messageList');
            if (messagesLoading) {
                container.innerHTML = '<div class="loading-state"><div class="spinner"></div><div>正在加载留言...</div></div>';
                return;
            }
            if (messagesError) {
                container.innerHTML = '<div class="error-state">加载失败，请联系站主修复</div>';
                return;
            }
            if (!messages || messages.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="big"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg></div>暂无留言，快来写第一条吧！</div>';
                return;
            }

            const mainMessages = messages.filter(m => !m.parent_id);
            mainMessages.sort((a, b) => {
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;
                return new Date(b.created_at) - new Date(a.created_at);
            });

            const commentInfo = {};
            mainMessages.forEach(m => {
                const related = messages.filter(c => String(c.parent_id) === String(m.id));
                commentInfo[m.id] = {
                    count: related.length,
                    hasOfficial: related.some(c => c.is_official === true)
                };
            });

            let html = '';
            for (const m of mainMessages) {
                const isOfficial = m.is_official || m.name === 'Seven戚';
                const timeStr = new Date(m.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const color = m.color || pickColor(null);
                const officialTag = isOfficial ? '<span class="official-tag">官方</span>' : '';
                const pinnedClass = m.is_pinned ? 'pinned' : '';
                const info = commentInfo[m.id] || { count: 0, hasOfficial: false };
                const commentIconClass = info.hasOfficial ? 'comment-btn official' : 'comment-btn';

                // 删除按钮
                let delBtn = '';
                if (isAdminFlag || isAuthorMode) {
                    delBtn = '<button class="del-btn" onclick="deleteMessageById(\'' + m.id + '\')">' +
                        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        '<polyline points="3 6 5 6 21 6"/>' +
                        '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
                        '</svg>删除</button>';
                }

                // 举报按钮
                let reportBtn = '';
                if (currentUser && m.name !== currentUser.nickname) {
                    var snapshotSafe = escapeHtml(m.text || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    var nameSafe = escapeHtml(m.name || '').replace(/'/g, "\\'");
                    reportBtn = '<button class="report-btn" onclick="event.stopPropagation();reportMessage(\'' + m.id + '\',\'' + nameSafe + '\',\'' + snapshotSafe + '\')" title="举报">' +
                        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>' +
                        '<line x1="4" y1="22" x2="4" y2="15"/>' +
                        '</svg>举报</button>';
                }

                const commentBtn = '<button class="' + commentIconClass + '" onclick="openCommentPanel(\'' + m.id + '\')">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
                    '</svg>' +
                    '<span class="count">' + info.count + '</span></button>';

                html += '<div class="msg ' + pinnedClass + '" data-id="' + m.id + '">' +
                    '<div class="avatar" style="background:' + color + '">' + escapeHtml(m.name.slice(0,1)) + '</div>' +
                    '<div class="body">' +
                        '<div class="meta">' +
                            '<span class="name">' + escapeHtml(m.name) + '</span>' +
                            officialTag +
                            '<span class="time">' + timeStr + '</span>' +
                            (m.is_pinned ? '<span style="font-size:0.7em;color:var(--primary);">置顶</span>' : '') +
                        '</div>' +
                        '<div class="txt">' + escapeHtml(m.text) + '</div>' +
                        '<div class="ip">' +
                            '<span class="ip-text">' + escapeHtml(m.ip || '未知') + '</span>' +
                            commentBtn +
                            reportBtn +
                            delBtn +
                        '</div>' +
                    '</div>' +
                '</div>';
            }
            container.innerHTML = html;
            container.scrollTop = 0;
        }

        // ============================================================
        // 举报功能
        // ============================================================
        async function reportMessage(contentId, author, contentSnapshot) {
            try {
                var userRes = await window.sb.from('users').select('id').eq('nickname', author).single();
                if (userRes.error || !userRes.data) { showToast('无法找到该用户'); return; }
                openReportDialog(userRes.data.id, 'message', contentId, contentSnapshot);
            } catch (err) {
                showToast('举报失败：' + err.message);
            }
        }

        // ============================================================
        // 删除留言（主+子）
        // ============================================================
        async function deleteMessageById(id) {
            if (!isAdminFlag && !isAuthorMode) { showToast('权限不足'); return; }
            showConfirm('删除留言', '确定要删除此留言及其所有评论吗？', async () => {
                try {
                    await deleteMessage(id);
                    messages = messages.filter(m => m.id !== id && m.parent_id !== id);
                    await renderMessages();
                    if (currentCommentParentId === id) closeCommentPanel();
                    showToast('留言已删除（含评论）');
                } catch (err) {
                    showToast('删除失败：' + err.message);
                }
            });
        }

        async function deleteCommentOnlyById(id) {
            if (!isAdminFlag && !isAuthorMode) { showToast('权限不足'); return; }
            showConfirm('删除评论', '确定要删除此评论吗？', async () => {
                try {
                    await deleteCommentOnly(id);
                    messages = messages.filter(m => m.id !== id);
                    await renderMessages();
                    if (currentCommentParentId) renderComments(currentCommentParentId);
                    showToast('评论已删除');
                } catch (err) {
                    showToast('删除失败：' + err.message);
                }
            });
        }

        // ============================================================
        // 发送留言
        // ============================================================
        function sendMessage() {
            if (!currentUser) { showToast('请先登录'); return; }
            if (isUserBanned()) { showToast('账号已被封禁，无法留言'); return; }
            const input = document.getElementById('msgInput');
            const content = input.value.trim();
            if (!content) { showToast('请输入内容'); return; }
            const btn = document.getElementById('sendMsgBtn');
            btn.disabled = true;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '发送中...';

            const color = pickColor(null);
            const isOfficial = isAuthorMode || currentUser.nickname === 'Seven戚';
            const isPinned = isAuthorMode && document.getElementById('msgPinnedCheck').checked;

            (async function() {
                try {
                    const ip = await fetchIP();
                    const { data } = await addMessage(currentUser.nickname, content, color, ip, isOfficial, isPinned, null);
                    if (data && data.length) {
                        messages.push({
                            id: data[0].id,
                            name: currentUser.nickname,
                            text: content,
                            color: color,
                            ip: ip,
                            created_at: new Date().toISOString(),
                            is_official: isOfficial,
                            is_pinned: isPinned,
                            parent_id: null
                        });
                        await renderMessages();
                    } else {
                        await loadAllData();
                    }
                    input.value = '';
                    if (isPinned) document.getElementById('msgPinnedCheck').checked = false;
                    showToast('留言已发送');
                } catch (err) {
                    showToast('发送失败：' + err.message);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                }
            })();
        }

        // ============================================================
        // 评论功能
        // ============================================================
        var currentCommentParentId = null;
        var commentList = document.getElementById('commentList');
        var commentInput = document.getElementById('commentInput');
        var sendCommentBtn = document.getElementById('sendCommentBtn');
        var closeCommentBtn = document.getElementById('closeComment');
        var commentOverlay = document.getElementById('commentOverlay');

        function openCommentPanel(parentId) {
            currentCommentParentId = parentId;
            commentOverlay.classList.add('active');
            renderComments(parentId);
            commentInput.value = '';
            if (isUserBanned()) {
                commentInput.disabled = true;
                sendCommentBtn.disabled = true;
                commentInput.placeholder = '账号已被封禁，无法评论';
            } else {
                commentInput.disabled = false;
                sendCommentBtn.disabled = false;
                commentInput.placeholder = '写评论…';
            }
            commentInput.focus();
        }

        function closeCommentPanel() {
            commentOverlay.classList.remove('active');
            currentCommentParentId = null;
        }
        closeCommentBtn.addEventListener('click', closeCommentPanel);
        commentOverlay.addEventListener('click', function(e) {
            if (e.target === commentOverlay) closeCommentPanel();
        });

        function renderComments(parentId) {
            const comments = messages.filter(m => m.parent_id === parentId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            if (!comments.length) {
                commentList.innerHTML = '<div class="comment-empty">还没有评论，来抢沙发吧</div>';
                return;
            }
            let html = '';
            comments.forEach(c => {
                const isOfficial = c.is_official || c.name === 'Seven戚';
                const timeStr = new Date(c.created_at).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                const officialTag = isOfficial ? '<span class="official-tag">官方</span>' : '';
                let delBtn = '';
                if (isAdminFlag || isAuthorMode) {
                    delBtn = '<button class="del-comment-btn" onclick="deleteCommentOnlyById(\'' + c.id + '\')" title="删除">' +
                        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        '<polyline points="3 6 5 6 21 6"/>' +
                        '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
                        '</svg></button>';
                }
                html += '<div class="comment-item ' + (isOfficial ? 'official' : '') + '">' +
                    '<div class="meta">' +
                        '<span class="name">' + escapeHtml(c.name) + '</span>' +
                        officialTag +
                        '<span class="time">' + timeStr + '</span>' +
                        delBtn +
                    '</div>' +
                    '<div class="txt">' + escapeHtml(c.text) + '</div>' +
                '</div>';
            });
            commentList.innerHTML = html;
            commentList.scrollTop = commentList.scrollHeight;
        }

        function sendComment() {
            if (!currentUser) { showToast('请先登录'); return; }
            if (!currentCommentParentId) { showToast('请先选择要评论的留言'); return; }
            if (isUserBanned()) { showToast('账号已被封禁，无法评论'); return; }
            const text = commentInput.value.trim();
            if (!text) { showToast('请输入评论内容'); return; }

            const btn = sendCommentBtn;
            btn.disabled = true;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '发送中...';

            const color = pickColor(null);
            (async function() {
                try {
                    const ip = await fetchIP();
                    const isOfficial = isAuthorMode || currentUser.nickname === 'Seven戚';
                    const { data } = await addMessage(
                        currentUser.nickname,
                        text,
                        color,
                        ip,
                        isOfficial,
                        false,
                        currentCommentParentId
                    );
                    if (data && data.length) {
                        const newComment = {
                            id: data[0].id,
                            name: currentUser.nickname,
                            text: text,
                            color: color,
                            ip: ip,
                            created_at: new Date().toISOString(),
                            is_official: isOfficial,
                            is_pinned: false,
                            parent_id: currentCommentParentId
                        };
                        messages.push(newComment);
                        await renderMessages();
                        renderComments(currentCommentParentId);
                    } else {
                        await loadAllData();
                    }
                    commentInput.value = '';
                    showToast('评论已发送');
                } catch (err) {
                    showToast('评论失败：' + err.message);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                }
            })();
        }

        // ============================================================
        // 自定义确认弹窗
        // ============================================================
        // ============================================================
        // 加载数据
        // ============================================================
        async function loadAllData() {
            messagesLoading = true;
            messagesError = null;
            await renderMessages();
            try {
                const data = await fetchMessages();
                messages = data;
                if (messages.length === 0) {
                    try {
                        await addMessage('系统', '欢迎来到留言板！快来留下你的足迹吧', '#6ee7b7', '0.0.0.0', false, false, null);
                        const newData = await fetchMessages();
                        messages = newData;
                    } catch (insertErr) { console.warn('插入欢迎留言失败:', insertErr); }
                }
            } catch (err) {
                messagesError = err.message || '加载失败';
            } finally {
                messagesLoading = false;
                await renderMessages();
            }
        }

        // ============================================================
        // 作者模式激活（三击 logo）
        // ============================================================
        var brandClickCount = 0;
        var brandClickTimer = null;

        function bindBrandClick() {
            var brandEl = document.querySelector('.brand');
            if (!brandEl) return;
            brandEl.addEventListener('click', async function(e) {
                brandClickCount++;
                clearTimeout(brandClickTimer);
                brandClickTimer = setTimeout(function() { brandClickCount = 0; }, 800);
                if (brandClickCount === 3) {
                    brandClickCount = 0;
                    if (!isAuthorMode) {
                        var pwd = prompt('请输入作者密码：');
                        if (pwd === null) return;
                        if (await window.verifyAuthorPassword(pwd)) {
                            isAuthorMode = true;
                            document.getElementById('msgAuthorOptions').classList.add('active');
                            showToast('作者模式已激活');
                            renderMessages();
                        } else {
                            showToast('密码错误');
                        }
                    } else {
                        isAuthorMode = false;
                        document.getElementById('msgAuthorOptions').classList.remove('active');
                        showToast('已退出作者模式');
                        renderMessages();
                    }
                }
            });
        }

        // ============================================================
        // 初始化
        // ============================================================
        (function init() {
            const session = getSessionUser();
            if (!session || !session.id) {
                window.location.href = 'index.html';
                return;
            }
            currentUser = session;
            isAdminFlag = window.isAdmin(currentUser);

            renderHeader('留言板', 'messages');
            renderFooter('messages');

            bindBrandClick();
            updateBannedBanner();
            loadAllData();

            // 实时订阅
            window.sb.channel('public-messages')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function() { loadAllData(); })
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, function() { loadAllData(); })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, function() { loadAllData(); })
                .subscribe();

            // 用户信息同步
            function syncUser() {
                const s = getSessionUser();
                if (s && s.id) {
                    if (!currentUser || currentUser.id !== s.id ||
                        currentUser.avatar_url !== s.avatar_url ||
                        currentUser.nickname !== s.nickname) {
                        currentUser = s;
                        isAdminFlag = window.isAdmin(currentUser);
                        updateBannedBanner();
                        renderMessages();
                    }
                }
            }
            window.addEventListener('focus', syncUser);
            document.addEventListener('visibilitychange', function() {
                if (!document.hidden) syncUser();
            });
        })();

        document.addEventListener('gesturestart', function(e) { e.preventDefault(); });