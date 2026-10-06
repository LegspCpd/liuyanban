/* 七戚 · posts页模块，由 app/posts.html 内联脚本拆分，DOM区未动，加载顺序即依赖顺序 */
// ============ 初始化 ============
renderHeader('帖子广场', 'posts');
renderFooter('posts');

async function fetchCategories() {
    var res = await window.sb.from('categories').select('*').order('sort_order');
    if (res.error) throw res.error;
    return res.data || [];
}
async function addCategory(name, isPublic) {
    var maxOrder = categories.reduce(function(m, c) { return Math.max(m, c.sort_order || 0); }, 0);
    await window.sb.from('categories').insert([{ name: name, sort_order: maxOrder + 1, is_public: isPublic }]);
}
async function updateCategory(id, updates) { await window.sb.from('categories').update(updates).eq('id', id); }
async function deleteCategory(id) {
    var uncat = categories.find(function(c) { return c.name === '未分类'; });
    if (uncat) await window.sb.from('posts').update({ category_id: uncat.id }).eq('category_id', id);
    await window.sb.from('categories').delete().eq('id', id);
}
async function swapCategoryOrder(id1, id2) {
    var c1 = categories.find(function(c) { return c.id === id1; });
    var c2 = categories.find(function(c) { return c.id === id2; });
    if (!c1 || !c2) return;
    var temp = c1.sort_order;
    await window.sb.from('categories').update({ sort_order: c2.sort_order }).eq('id', id1);
    await window.sb.from('categories').update({ sort_order: temp }).eq('id', id2);
}
async function fetchPosts() {
    var res = await window.sb.from('posts').select('*, users!posts_user_id_fkey (id, nickname, avatar_url)').order('created_at', { ascending: false });
    if (res.error) throw res.error;
    return res.data || [];
}
async function fetchComments(postId) {
    var res = await window.sb.from('post_comments').select('*, users!post_comments_user_id_fkey (id, nickname, avatar_url)').eq('post_id', postId).order('created_at', { ascending: true });
    if (res.error) throw res.error;
    return res.data || [];
}
async function fetchAllCommentCounts() {
    var res = await window.sb.from('post_comments').select('post_id');
    if (!res.error) {
        commentCountMap = {};
        (res.data || []).forEach(function(c) { commentCountMap[c.post_id] = (commentCountMap[c.post_id] || 0) + 1; });
    }
}
async function addComment(postId, author, user_id, content) {
    const { data: commentData, error: commentError } = await window.sb.from('post_comments').insert([{ post_id: postId, author: author, user_id: user_id, content: content }]).select('id');
    if (commentError) throw commentError;
    const commentId = commentData[0].id;
    const { data: postData } = await window.sb.from('posts').select('user_id').eq('id', postId).single();
    if (postData && postData.user_id !== user_id) {
        await window.sb.from('notifications').insert([{
            user_id: postData.user_id, type: 'comment', notification_type: 'comment',
            source_id: commentId, post_id: postId, comment_author_id: user_id,
            comment_content: content, extra_text: content, is_read: false
        }]);
        if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
    }
    return commentData;
}
async function deletePost(id) { await window.sb.from('posts').delete().eq('id', id); }
async function fetchAllUsers() { var r = await window.sb.from('users').select('*'); return r.data || []; }
async function fetchUserRoles() { var r = await window.sb.from('user_roles').select('*'); return r.data || []; }
function goUser(uid){ if(uid) location.href = '/liuyanban/user.html?id=' + uid; }
window.goUser = goUser;