/* 七戚 · new-post页模块，由 app/new-post.html 内联脚本拆分，DOM区未动 */
        renderHeader('发帖', 'posts');

        var currentUser = getSessionUser();
        if (!currentUser || !currentUser.id) {
            window.location.href = '/liuyanban/index.html';
        }
        var isAdmin = window.isAdmin(currentUser);

        var categories = [];
        var pollOptions = [];
        var savedRange = null; // 保存选区

        async function loadCategories() {
            try {
                const { data, error } = await window.sb
                    .from('categories')
                    .select('*')
                    .order('sort_order', { ascending: true });
                if (error) throw error;
                categories = data || [];
                const select = document.getElementById('postCategorySelect');
                const available = categories.filter(c => c.name !== '未分类' && (isAdmin || c.is_public !== false));
                select.innerHTML = available.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
            } catch (err) {
                showToast('分类加载失败：' + err.message);
            }
        }

        function execCommand(command, value = null) {
            document.execCommand(command, false, value);
            document.getElementById('richEditor').focus();
        }

        // ============================================================
        // 图片上传功能
        // ============================================================
        async function uploadImage(file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `posts/${Date.now()}.${fileExt}`;
            const { data, error } = await window.sb.storage.from('posts').upload(fileName, file);
            if (error) throw error;
            const { data: urlData } = window.sb.storage.from('posts').getPublicUrl(fileName);
            return urlData.publicUrl;
        }

        function insertImage() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    showToast('正在上传图片...');
                    const url = await uploadImage(file);
                    document.execCommand('insertImage', false, url);
                } catch (err) {
                    showToast('图片上传失败：' + err.message);
                }
            };
            input.click();
        }

        // ============================================================
        // 超链接功能（修复版）
        // ============================================================
        function showLinkModal() {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                savedRange = selection.getRangeAt(0).cloneRange();
            } else {
                savedRange = null;
            }
            document.getElementById('linkUrlInput').value = '';
            document.getElementById('linkTextInput').value = '';
            document.getElementById('linkModalOverlay').classList.add('active');
            document.getElementById('linkUrlInput').focus();
        }

        function closeLinkModal() {
            document.getElementById('linkModalOverlay').classList.remove('active');
        }

        function confirmInsertLink() {
            const url = document.getElementById('linkUrlInput').value.trim();
            const text = document.getElementById('linkTextInput').value.trim();

            if (!url) {
                showToast('请输入链接地址');
                return;
            }
            if (!/^https:\/\/[\w\-]+(\.[\w\-]+)+([\/\w\-.,@?^=%&:~+#]*)*$/.test(url)) {
                showToast('链接必须以 https:// 开头且格式正确');
                return;
            }

            closeLinkModal();
            const editor = document.getElementById('richEditor');
            editor.focus();

            if (savedRange) {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(savedRange);
                const selectedText = selection.toString();
                if (selectedText) {
                    document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(selectedText)}</a>`);
                } else {
                    const displayText = text || url;
                    document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayText)}</a>`);
                }
            } else {
                const displayText = text || url;
                document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayText)}</a>`);
            }
            savedRange = null;
            editor.focus();
        }

        document.getElementById('linkModalOverlay').addEventListener('click', function(e) {
            if (e.target === this) closeLinkModal();
        });

        function addChapter() {
            const borderColor = prompt('请输入章节边框颜色（例如 #2e7d32）：') || '#2e7d32';
            const textColor = prompt('请输入章节文字颜色（例如 #1e3a2e）：') || '#1e3a2e';
            const html = `<div class="chapter-block" style="border-color:${borderColor};color:${textColor}">章节内容</div>`;
            document.execCommand('insertHTML', false, html);
        }

        function toggleFullscreen() {
            const container = document.getElementById('editorContainer');
            container.classList.toggle('fullscreen-mode');
            if (container.classList.contains('fullscreen-mode')) {
                document.getElementById('richEditor').focus();
            }
        }

        function addPoll() {
            pollOptions = ['', ''];
            renderPollBuilder();
        }

        function addPollOption() {
            if (pollOptions.length >= 10) { showToast('最多10个选项'); return; }
            pollOptions.push('');
            renderPollBuilder();
        }

        function removePollOption(index) {
            pollOptions.splice(index, 1);
            renderPollBuilder();
        }

        function renderPollBuilder() {
            const container = document.getElementById('pollBuilderContainer');
            if (!container) return;
            let html = '<div class="poll-builder"><label><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>投票</label>';
            html += '<input type="text" id="pollTitle" placeholder="投票标题（必填）" />';
            html += '<input type="text" id="pollDescription" placeholder="投票简介（选填）" />';
            pollOptions.forEach((opt, index) => {
                html += `<div class="poll-option-row"><input type="text" value="${escapeHtml(opt)}" placeholder="选项 ${index+1}" oninput="pollOptions[${index}]=this.value" /><button type="button" onclick="removePollOption(${index})">✕</button></div>`;
            });
            html += '<button type="button" class="add-option-btn" onclick="addPollOption()">+ 添加选项</button>';
            html += '</div>';
            container.innerHTML = html;
        }

        document.getElementById('submitPostBtn').addEventListener('click', async function() {
            const title = document.getElementById('postTitleInput').value.trim();
            const category_id = parseInt(document.getElementById('postCategorySelect').value);
            const content = document.getElementById('richEditor').innerHTML.trim();
            if (!content || content === '<br>') { showToast('请输入正文内容'); return; }
            if (currentUser.banned_until && new Date(currentUser.banned_until) > new Date()) {
                showToast('账号已被封禁，无法发布');
                return;
            }

            let pollData = null;
            const pollTitle = document.getElementById('pollTitle')?.value.trim();
            if (pollTitle) {
                const validOptions = pollOptions.filter(opt => opt.trim() !== '');
                if (validOptions.length < 2) { showToast('投票至少需要2个有效选项'); return; }
                pollData = {
                    title: pollTitle,
                    description: document.getElementById('pollDescription')?.value.trim() || '',
                    options: validOptions
                };
            }

            const btn = this;
            btn.disabled = true;
            btn.textContent = '发布中...';

            try {
                const isOfficial = window.isAdmin(currentUser);
                const { data: postData, error: postError } = await window.sb
                    .from('posts')
                    .insert([{
                        title: title,
                        content: content,
                        category_id: category_id,
                        author: currentUser.nickname,
                        user_id: currentUser.id,
                        is_official: isOfficial,
                        is_pinned: false
                    }])
                    .select();
                if (postError) throw postError;

                if (pollData && postData && postData.length > 0) {
                    const postId = postData[0].id;
                    await window.sb.from('post_polls').insert([{
                        post_id: postId,
                        title: pollData.title,
                        description: pollData.description
                    }]);
                    for (const opt of pollData.options) {
                        await window.sb.from('poll_options').insert([{
                            post_id: postId,
                            option_text: opt
                        }]);
                    }
                }

                showToast('帖子发布成功！');
                setTimeout(() => {
                    window.location.href = '/liuyanban/posts.html';
                }, 1000);
            } catch (err) {
                showToast('发布失败：' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = '发布';
            }
        });

        loadCategories();