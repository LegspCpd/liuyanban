/* 七戚 · posts页模块，由 app/posts.html 内联脚本拆分，DOM区未动，加载顺序即依赖顺序 */
function renderCategoryFilter() {
    var container = document.getElementById('categoryFilter');
    var html = '<button class="category-btn active" data-cat="全部" onclick="setCategory(\'全部\', this)">全部</button>';
    categories.filter(function(x) { return x.name !== '未分类'; }).forEach(function(x) {
        html += '<button class="category-btn" data-cat="' + x.id + '" onclick="setCategory(' + x.id + ', this)">' + escapeHtml(x.name) + '</button>';
    });
    container.innerHTML = html;
}
function setCategory(cat, btn) {
    document.querySelectorAll('#categoryFilter .category-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentCategory = cat;
    renderPosts();
}
window.setCategory = setCategory;

function renderPostContent(post) {
    var html = '';
    if (post.content && post.content.includes('<')) html = post.content;
    else html = '<div style="white-space:pre-wrap;">' + escapeHtml(post.content || '') + '</div>';
    if (post.image_url && !html.includes('<img')) html += '<img src="' + escapeHtml(post.image_url) + '" style="max-width:100%;border-radius:8px;margin-top:6px;" />';
    return html;
}

function renderPollUI(poll) {
    if (!poll || !poll.poll_options || !poll.poll_options.length) return '';
    var total = (poll.poll_votes || []).length;
    var voted = null;
    if (currentUser) {
        var found = (poll.poll_votes || []).find(function(v) { return v.user_id === currentUser.id; });
        if (found) voted = found.option_id;
    }
    var h = '<div class="poll-container"><b>' + escapeHtml(poll.title) + '</b>';
    if (poll.description) h += '<div style="font-size:.8em;color:var(--text-muted)">' + escapeHtml(poll.description) + '</div>';
    h += '<div style="font-size:.7em;margin:6px 0">总票数：' + total + '</div>';
    poll.poll_options.forEach(function(opt) {
        var votes = (poll.poll_votes || []).filter(function(v) { return v.option_id === opt.id; }).length;
        var pct = total ? Math.round(votes / total * 100) : 0;
        var isVoted = (voted === opt.id);
        h += '<div class="poll-option"><div class="poll-option-header"><span>' + escapeHtml(opt.option_text) + '</span><span>' + votes + '票 (' + pct + '%)</span></div>';
        h += '<div class="poll-option-bar"><div class="poll-option-progress"><div class="poll-option-fill" style="width:' + pct + '%"></div></div>';
        h += '<button class="poll-option-vote-btn" onclick="votePoll(\'' + opt.id + '\')">' + (isVoted ? '已投' : '投票') + '</button></div></div>';
    });
    h += '</div>';
    return h;
}

async function renderPosts() {
    var list = document.getElementById('postList');
    list.innerHTML = '<div class="loading-state"><div class="spinner"></div>加载中...</div>';
    var filtered = posts.filter(function(p) {
        return currentCategory === '全部' || p.category_id === currentCategory;
    });
    if (!filtered.length) { list.innerHTML = '<div class="empty-state">暂无帖子</div>'; return; }
    var html = '';
    for (var i = 0; i < filtered.length; i++) {
        var p = filtered[i];
        var user = p.users || null;
        var name = user ? user.nickname : p.author;
        var avatar = user ? (user.avatar_url || getUserAvatar(user)) : getUserAvatar({ nickname: p.author });
        var time = new Date(p.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        var catName = '';
        if (p.category_id) {
            var _cat = categories.find(function(c) { return c.id === p.category_id; });
            if (_cat && _cat.name && _cat.name !== '未分类') catName = _cat.name;
        }
        var content = renderPostContent(p);
        var raw = p.content ? p.content.replace(/<[^>]*>/g, '') : '';
        var clamped = raw.length > 150 || (p.content && p.content.split('\n').length > 5);
        var expand = clamped ? '<span class="expand-link">展开</span>' : '';
        var commentCount = commentCountMap[p.id] || 0;
        var canDelete = isAdmin || (currentUser && currentUser.id === p.user_id);

        var delBtn = canDelete ? '<button class="del-btn" data-action="delete" data-id="' + p.id + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>删除</button>' : '';

        var reportBtn = '';
        if (currentUser && currentUser.id !== p.user_id && p.user_id) {
            var snapshot = ((p.title || '') + ' ' + (p.content || '').replace(/<[^>]*>/g, '')).substring(0, 200);
            reportBtn = '<button class="report-btn" data-action="report" data-id="' + p.id + '" data-uid="' + p.user_id + '" data-snapshot="' + escapeHtml(snapshot) + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>举报</button>';
        }

        html += '<div class="post-card" data-postid="' + p.id + '">';
        html += '<div class="post-author">';
        html += '<div class="avatar author-avatar" data-uid="' + p.user_id + '" data-name="' + escapeHtml(name) + '" data-avatar="' + escapeHtml(avatar||'') + '" style="cursor:pointer;' + (avatar && avatar.startsWith('http') ? 'background-image:url(' + avatar + ');background-size:cover;background-position:center;' : '') + '">' + (avatar && !avatar.startsWith('http') ? name.charAt(0).toUpperCase() : '') + '</div>';
        html += '<span class="name" style="cursor:pointer;" onclick="goUser(\'' + p.user_id + '\')">' + escapeHtml(name) + '</span>';
        if (p.is_official) html += '<span class="official-tag">官方</span>';
        html += roleTagHTML(p.user_id);
        if (catName) html += '<span class="category-tag">' + escapeHtml(catName) + '</span>';
        html += '<span class="time">' + time + '</span>';
        html += '</div>';
        if (p.title) html += '<div class="post-title">' + escapeHtml(p.title) + '</div>';
        html += '<div class="post-content ' + (clamped ? 'clamped' : '') + '">' + content + expand + '</div>';
        html += '<div class="post-footer">';
        html += '<span class="comment-count">评论 ' + commentCount + '</span>';
        html += '<div class="actions">' + reportBtn + delBtn + '</div>';
        html += '</div></div>';
    }
    list.innerHTML = html;

    list.querySelectorAll('.post-card').forEach(function(card) {
        card.addEventListener('click', function(e) {
            if (e.target.closest('button') || e.target.closest('.comment-count') || e.target.closest('.expand-link')) return;
            openPostDetail(this.dataset.postid);
        });
    });

    list.querySelectorAll('.report-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); e.preventDefault();
            reportPost(this.dataset.id, this.dataset.uid, this.dataset.snapshot);
        });
    });

    list.querySelectorAll('.del-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); e.preventDefault();
            deletePostById(this.dataset.id);
        });
    });

    list.querySelectorAll('.comment-count, .expand-link').forEach(function(el) {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            var card = this.closest('.post-card');
            if (card) openPostDetail(card.dataset.postid);
        });
    });
}

async function deletePostById(id) {
    showConfirm('删除帖子', '确定要删除此帖子吗？', async function() {
        await deletePost(id);
        posts = posts.filter(function(p) { return p.id !== id; });
        await fetchAllCommentCounts();
        await renderPosts();
        showToast('帖子已删除');
    });
}

var detailOverlay = document.getElementById('detailOverlay');
var detailContent = document.getElementById('detailContent');
var detailCommentInput = document.getElementById('detailCommentInput');
var detailSendCommentBtn = document.getElementById('detailSendCommentBtn');
var currentDetailPostId = null;

async function openPostDetail(id) {
    currentDetailPostId = id;
    if (window.location.search.includes('comment=')) history.replaceState({}, document.title, window.location.pathname);
    detailContent.innerHTML = '<div class="loading-state"><div class="spinner"></div>加载中...</div>';
    detailOverlay.classList.add('active');
    await renderDetail(id);
}
window.openPostDetail = openPostDetail;

document.getElementById('closeDetail').onclick = function() {
    detailOverlay.classList.remove('active');
    currentDetailPostId = null;
};

async function renderDetail(id) {
    detailContent.innerHTML = '<div class="loading-state"><div class="spinner"></div>加载中...</div>';
    var post = posts.find(function(p) { return p.id === id; });
    if (!post) { detailContent.innerHTML = '<div class="empty-state">帖子不存在或已被删除</div>'; return; }

    var comments = await fetchComments(id);
    var poll = await loadPollData(id);
    var content = renderPostContent(post);
    var user = post.users || null;
    var name = user ? user.nickname : post.author;
    var avatar = user ? (user.avatar_url || getUserAvatar(user)) : getUserAvatar({ nickname: post.author });
    var time = new Date(post.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    // 详情页举报按钮
    var detailReportBtn = '';
    if (currentUser && currentUser.id !== post.user_id && post.user_id) {
        var detailSnapshot = ((post.title || '') + ' ' + (post.content || '').replace(/<[^>]*>/g, '')).substring(0, 200);
        detailReportBtn = '<button class="report-btn-detail" data-action="report-detail" data-id="' + post.id + '" data-uid="' + post.user_id + '" data-snapshot="' + escapeHtml(detailSnapshot) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>举报</button>';
    }

    var commentsHtml = comments.length ?
        comments.map(function(c) {
            var cu = c.users || null;
            var cn = cu ? cu.nickname : c.author;
            var ca = cu ? (cu.avatar_url || getUserAvatar(cu)) : getUserAvatar({ nickname: c.author });
            return '<div class="comment-item" data-comment-id="' + c.id + '" id="comment-' + c.id + '">' +
                '<div class="avatar" style="' + (ca && ca.startsWith('http') ? 'background-image:url(' + ca + ');background-size:cover;background-position:center;' : '') + '">' + (ca && !ca.startsWith('http') ? cn.charAt(0).toUpperCase() : '') + '</div>' +
                '<div class="body"><div class="meta"><span class="name" style="cursor:pointer;" onclick="goUser(\'' + c.user_id + '\')">' + escapeHtml(cn) + '</span>' + (c.is_official ? '<span class="official-tag">官方</span>' : '') + roleTagHTML(c.user_id) + '<span class="time">' + new Date(c.created_at).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + '</span></div>' +
                '<div class="txt">' + escapeHtml(c.content) + '</div></div></div>';
        }).join('') :
        '<div style="color:var(--text-muted);padding:12px 0;">暂无评论</div>';

    detailContent.innerHTML =
        '<div class="detail-post">' +
        '<div class="post-author">' +
        '<div class="avatar" style="' + (avatar && avatar.startsWith('http') ? 'background-image:url(' + avatar + ');background-size:cover;background-position:center;' : '') + '">' + (avatar && !avatar.startsWith('http') ? name.charAt(0).toUpperCase() : '') + '</div>' +
        '<span class="name" style="cursor:pointer;" onclick="goUser(\'' + post.user_id + '\')">' + escapeHtml(name) + '</span>' +
        (post.is_official ? '<span class="official-tag">官方</span>' : '') + roleTagHTML(post.user_id) +
        '<span class="time">' + time + '</span>' +
        detailReportBtn +
        '</div>' +
        (post.title ? '<div class="post-title">' + escapeHtml(post.title) + '</div>' : '') +
        '<div class="post-content">' + content + '</div>' +
        renderPollUI(poll) +
        '</div>' +
        '<div class="detail-comments"><b>评论 (' + comments.length + ')</b>' + commentsHtml + '</div>';

    // 绑定详情页举报按钮
    var rbtn = detailContent.querySelector('.report-btn-detail');
    if (rbtn) {
        rbtn.addEventListener('click', function(e) {
            e.stopPropagation();
            reportPost(this.dataset.id, this.dataset.uid, this.dataset.snapshot);
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const commentId = urlParams.get('comment');
    if (commentId) {
        setTimeout(function() {
            var commentEl = document.getElementById('comment-' + commentId);
            if (commentEl) {
                commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                commentEl.classList.add('highlight');
                setTimeout(function() { commentEl.classList.remove('highlight'); }, 3000);
            }
        }, 300);
    }
}

detailSendCommentBtn.onclick = async function() {
    if (!currentUser) return showToast('请先登录');
    var content = detailCommentInput.value.trim();
    if (!content) return showToast('请输入评论');
    await addComment(currentDetailPostId, currentUser.nickname, currentUser.id, content);
    detailCommentInput.value = '';
    await fetchAllCommentCounts();
    await renderDetail(currentDetailPostId);
    showToast('评论已发送');
};
