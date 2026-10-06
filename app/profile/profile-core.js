/* 七戚 · profile页模块，由 app/profile.html 内联脚本拆分，DOM区未动，加载顺序即依赖顺序 */

        // ============ 会话 ============
        var currentUser = getSessionUser();
        if (!currentUser || !currentUser.id) window.location.href = '/liuyanban/index.html';
        var isAdminFlag = window.isAdmin(currentUser);



        // ============ 头部 ============
        function updateHeader() {
            var user = getSessionUser();
            if (!user) return;
            var av = document.getElementById('headerAvatar');
            var nm = document.getElementById('headerUserName');
            if (user.avatar_url && user.avatar_url.startsWith('http')) {
                av.style.backgroundImage = 'url(' + user.avatar_url + ')';
                av.style.backgroundSize = 'cover';
                av.style.backgroundPosition = 'center';
                av.textContent = '';
            } else {
                av.style.backgroundImage = '';
                av.textContent = (user.nickname || 'U').charAt(0).toUpperCase();
            }
            nm.textContent = user.nickname || '用户';

            var pa = document.getElementById('profileAvatar');
            if (pa) {
                if (user.avatar_url && user.avatar_url.startsWith('http')) {
                    pa.style.backgroundImage = 'url(' + user.avatar_url + ')';
                    pa.style.backgroundSize = 'cover';
                    pa.style.backgroundPosition = 'center';
                    pa.textContent = '';
                } else {
                    pa.style.backgroundImage = '';
                    pa.textContent = (user.nickname || 'U').charAt(0).toUpperCase();
                }
            }
            var ni = document.getElementById('profileNameInput');
            if (ni) ni.value = user.nickname || '';
        }
        updateHeader();

        // ============ 视图切换 ============
        var currentView = 'settingsView';
        var viewTitles = {
            settingsView: '个人中心', profileEditView: '更新资料', messagesView: '消息中心',
            feedbackView: '反馈 Bug', adminFeedbackView: '反馈管理',
            manageSitesView: '网站管理', aboutView: '关于我们'
        };
        function switchView(id) {
            if (id === 'settingsView') { window.location.href = '/liuyanban/user.html'; return; }
            currentView = id;
            document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
            var t = document.getElementById(id);
            if (t) t.classList.add('active');
            var hs = document.getElementById('headerSub');
            if (hs) hs.textContent = (id === 'settingsView') ? '· 个人中心' : '· ' + (viewTitles[id] || '');
        }
        // 是否通过 URL 参数直达子视图（从 user.html 六宫格进入）
        var cameFromUrl = !!new URLSearchParams(location.search).get('view');
        function goBack() {
            // 从 user.html 直达子视图 → 直接返回 user.html
            if (cameFromUrl) { window.location.href = '/liuyanban/user.html'; return; }
            // 页面内自己点进子视图 → 回设置中心；否则回用户主页
            if (currentView !== 'settingsView') { switchView('settingsView'); }
            else { window.location.href = '/liuyanban/user.html'; }
        }
        window.goBack = goBack;

        if (isAdminFlag) {
            document.getElementById('goToAdminFeedback').style.display = 'flex';
            document.getElementById('goToManageSites').style.display = 'flex';
        }


        document.getElementById('goToMessages').onclick = function() { switchView('messagesView'); loadNotifications(); };
        document.getElementById('goToFeedback').onclick = function() { switchView('feedbackView'); initFeedbackView(); };
        document.getElementById('goToAdminFeedback').onclick = function() { switchView('adminFeedbackView'); loadAdminFeedback(); };
        document.getElementById('goToManageSites').onclick = function() { switchView('manageSitesView'); loadAdminSites(); };
        document.getElementById('goToAbout').onclick = function() { switchView('aboutView'); };
        function backToUser(){ window.location.href = '/liuyanban/user.html'; }
        window.backToUser = backToUser;
        document.getElementById('backToSettings').onclick = backToUser;
        document.getElementById('backToSettingsFromMsg').onclick = backToUser;
        document.getElementById('backToSettingsFromFb').onclick = backToUser;
        document.getElementById('backToSettingsFromAdminFb').onclick = backToUser;
        document.getElementById('backToSettingsFromSites').onclick = backToUser;
        document.getElementById('backToSettingsFromAbout').onclick = backToUser;

        // ============ 音效开关 ============
        var soundToggle = document.getElementById('soundToggle');
        var soundStatusHint = document.getElementById('soundStatusHint');
        var soundEnabled = localStorage.getItem('sq_sound_enabled') !== 'false';
        soundToggle.checked = soundEnabled;
        soundStatusHint.textContent = soundEnabled ? '新消息提示音 · 已开启' : '新消息提示音 · 已关闭';
        soundToggle.onchange = function() {
            var e = this.checked;
            localStorage.setItem('sq_sound_enabled', e);
            soundStatusHint.textContent = e ? '新消息提示音 · 已开启' : '新消息提示音 · 已关闭';
            showToast(e ? '提醒音效已开启' : '提醒音效已关闭');
        };

        // ============ 头像/昵称 ============
        async function uploadAvatar(file, userId) {
            var ext = file.name.split('.').pop();
            var fn = 'avatars/' + userId + '/profile.' + ext;
            var up = await window.sb.storage.from('avatars').upload(fn, file, { upsert: true });
            if (up.error) throw up.error;
            var urlData = window.sb.storage.from('avatars').getPublicUrl(fn);
            return urlData.data.publicUrl;
        }
        async function updateUser(id, up) {
            var r = await window.sb.from('users').update(up).eq('id', id);
            if (r.error) throw r.error;
        }
        document.getElementById('avatarFileInput').onchange = async function(e) {
            var file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { showToast('图片不能超过 5MB'); this.value = ''; return; }
            try {
                showToast('上传中...');
                var url = await uploadAvatar(file, currentUser.id);
                await updateUser(currentUser.id, { avatar_url: url });
                currentUser.avatar_url = url;
                setSessionUser(currentUser);
                updateHeader();
                showToast('头像已更新');
            } catch (err) { showToast('上传失败：' + err.message); }
            this.value = '';
        };
        document.getElementById('saveProfileBtn').onclick = async function() {
            var n = document.getElementById('profileNameInput').value.trim();
            if (!n) return showToast('请输入昵称');
            if (n.toLowerCase() === 'seven戚' && !window.isAdmin(currentUser)) return showToast('该昵称不可用');
            try {
                await updateUser(currentUser.id, { nickname: n });
                currentUser.nickname = n;
                setSessionUser(currentUser);
                updateHeader();
                showToast('昵称已更新');
            } catch (err) { showToast('更新失败：' + err.message); }
        };

        // ============ 退出登录 ============
        function handleLogout() {
            showConfirm('退出登录', '确定要退出登录吗？', function() {
                clearSession();
                showToast('已退出登录');
                setTimeout(function() { window.location.href = '/liuyanban/index.html'; }, 500);
            });
        }
        document.getElementById('logoutBtn').onclick = handleLogout;
        document.getElementById('logoutBtnFromSettings').onclick = handleLogout;
