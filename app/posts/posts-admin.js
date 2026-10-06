/* 七戚 · posts页模块，由 app/posts.html 内联脚本拆分，DOM区未动，加载顺序即依赖顺序 */
// ============ 管理面板 ============
var adminPanelOverlay = document.getElementById('adminPanelOverlay');
var adminPanelContent = document.getElementById('adminPanelContent');

function openAdminPanel() {
    if (!isAdmin) return;
    adminPanelOverlay.classList.add('active');
    renderAdminPanel();
}
window.openAdminPanel = openAdminPanel;
document.getElementById('closeAdminPanel').onclick = function() { adminPanelOverlay.classList.remove('active'); };

var adminTab = "cat";
var adminUserSearch = "";
function switchAdminTab(t){
  adminTab = t;
  document.querySelectorAll(".admin-tab").forEach(function(b){ b.classList.toggle("active", b.dataset.tab===t); });
  renderAdminPanel();
}
window.switchAdminTab = switchAdminTab;
function toggleCollapse(el){ el.parentElement.classList.toggle("open"); }
window.toggleCollapse = toggleCollapse;
function onAdminUserSearch(v){ adminUserSearch = (v||"").trim().toLowerCase(); renderAdminPanel(); }
window.onAdminUserSearch = onAdminUserSearch;

async function renderAdminPanel(){
  if(!adminPanelContent) return;
  var chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  if(adminTab==="cat"){
    var catsHtml = '<div class="admin-collapse open"><div class="admin-collapse-head" onclick="toggleCollapse(this)"><span>分类列表</span>'+chev+'</div><div class="admin-collapse-body">';
    var displayIndex = 1;
    categories.forEach(function(c, idx){
      if(c.name==="未分类") return;
      var isPublic = c.is_public !== false;
      catsHtml += '<div class="admin-cat-item"><div class="cat-info"><b>'+escapeHtml(c.name)+'</b> <span style="font-size:.7em;color:var(--text-muted)">#'+displayIndex+'</span></div><div class="cat-actions">'+
        '<button onclick="toggleCategoryPublic(\''+c.id+'\','+isPublic+')">'+(isPublic?"公开":"私密")+'</button>'+
        (idx>0?'<button onclick="moveCategoryUp(\''+c.id+'\')">↑</button>':"")+
        (idx<categories.length-1?'<button onclick="moveCategoryDown(\''+c.id+'\')">↓</button>':"")+
        '<button onclick="deleteCategoryById(\''+c.id+'\')">删除</button></div></div>';
      displayIndex++;
    });
    catsHtml += '</div></div>';
    catsHtml += '<div class="admin-collapse open"><div class="admin-collapse-head" onclick="toggleCollapse(this)"><span>添加分类</span>'+chev+'</div><div class="admin-collapse-body"><div class="admin-add-row"><input id="newCatName" placeholder="新分类名称" /><button onclick="addNewCategory()">添加</button></div></div></div>';
    adminPanelContent.innerHTML = catsHtml;
    return;
  }
  if(adminTab==="user"){
    var users = await fetchAllUsers();
    var roles = await fetchUserRoles();
    var roleMap = {}; roles.forEach(function(r){ roleMap[r.user_id]=r; });
    var filtered = users;
    if(adminUserSearch){ filtered = users.filter(function(u){ return (u.nickname||"").toLowerCase().indexOf(adminUserSearch)>=0 || (u.phone||"").indexOf(adminUserSearch)>=0; }); }
    var usersHtml = '<div class="admin-search"><input placeholder="搜索昵称 / 手机号…" value="'+escapeHtml(adminUserSearch)+'" oninput="onAdminUserSearch(this.value)" /></div>';
    usersHtml += '<div style="font-size:.75em;color:var(--text-muted);margin-bottom:8px;">共 '+filtered.length+' 位用户</div>';
    filtered.forEach(function(u){
      var isBanned = u.banned_until && new Date(u.banned_until) > new Date();
      var role = roleMap[u.id];
      var avatar = u.avatar_url || "";
      usersHtml += '<div class="admin-user-card"><div class="user-main">'+
        '<div class="user-avatar" style="'+(avatar?'background-image:url('+avatar+');background-size:cover;background-position:center;':"")+'">'+(!avatar?u.nickname.charAt(0).toUpperCase():"")+'</div>'+
        '<div class="user-info"><div class="name-row"><span class="nickname">'+escapeHtml(u.nickname)+'</span>'+
        (role?'<span class="role-badge" style="background:'+role.role_color+'">'+escapeHtml(role.role_name)+'</span>':"")+
        '<span class="status-badge '+(isBanned?"banned":"normal")+'">'+(isBanned?"已封禁":"正常")+'</span></div>'+
        '<div class="phone-row">'+escapeHtml(u.phone)+'</div></div></div>'+
        '<div class="user-actions">'+
        (isBanned?'<button class="btn-unban" onclick="unbanUserById(\''+u.id+'\')">解封</button>':'<button class="btn-ban" onclick="banUserPrompt(\''+u.id+'\',\''+escapeHtml(u.nickname)+'\')">封号</button>')+
        '<button class="btn-role" onclick="assignRolePrompt(\''+u.id+'\',\''+escapeHtml(u.nickname)+'\')">发身份</button>'+
        '<button class="btn-login" onclick="loginAsUser(\''+u.id+'\')">一键登录</button></div></div>';
    });
    adminPanelContent.innerHTML = usersHtml;
    return;
  }
  if(adminTab==="role"){
    var roles2 = await fetchUserRoles();
    var allUsers = await fetchAllUsers();
    var roleMap2 = {}; roles2.forEach(function(r){ roleMap2[r.user_id]=r; });
    var uniqueRoles = {};
    roles2.forEach(function(r){ var key=r.role_name+"|"+r.role_color; if(!uniqueRoles[key])uniqueRoles[key]={name:r.role_name,color:r.role_color,count:0}; uniqueRoles[key].count++; });
    var rolesHtml = '<div class="admin-collapse open"><div class="admin-collapse-head" onclick="toggleCollapse(this)"><span>已有身份</span>'+chev+'</div><div class="admin-collapse-body">';
    var hasRole = false;
    for(var key in uniqueRoles){ hasRole=true; var r=uniqueRoles[key];
      rolesHtml += '<div class="admin-role-item"><div class="role-info"><div style="width:28px;height:28px;border-radius:50%;background:'+r.color+';flex-shrink:0;"></div><b>'+escapeHtml(r.name)+'</b> <span style="font-size:.7em;color:var(--text-muted)">('+r.count+'人)</span></div><div class="role-actions"><button onclick="removeRoleFromAll(\''+escapeHtml(r.name)+'\')">删除此身份</button></div></div>';
    }
    if(!hasRole) rolesHtml += '<div style="font-size:.8em;color:var(--text-muted);padding:10px 0;">暂无身份</div>';
    rolesHtml += '</div></div>';
    // 创建/批量发放
    rolesHtml += '<div class="admin-collapse open"><div class="admin-collapse-head" onclick="toggleCollapse(this)"><span>创建 / 批量发放身份</span>'+chev+'</div><div class="admin-collapse-body">';
    rolesHtml += '<div class="admin-add-row" style="margin-bottom:14px;"><input id="newRoleName" placeholder="身份名称" /><input type="color" id="newRoleColor" value="#2e7d32" style="width:48px;height:38px;padding:2px;border:2px solid var(--border);border-radius:8px;cursor:pointer;" /></div>';
    rolesHtml += '<div style="font-size:.75em;font-weight:700;margin-bottom:8px;">勾选要发放的用户（可多选）：</div>';
    rolesHtml += '<div class="role-user-list">';
    allUsers.forEach(function(u){
      var cur = roleMap2[u.id];
      rolesHtml += '<label class="role-user-item"><input type="checkbox" class="role-user-cb" value="'+u.id+'" />'+
        '<span>'+escapeHtml(u.nickname)+'</span>'+
        (cur?'<span class="role-badge" style="background:'+cur.role_color+'">'+escapeHtml(cur.role_name)+'</span>':'')+
        '</label>';
    });
    rolesHtml += '</div>';
    rolesHtml += '<button class="role-batch-btn" onclick="batchAssignRole()">批量发放给选中用户</button>';
    rolesHtml += '<div style="margin-top:12px;"><div style="font-size:.72em;color:var(--text-muted);margin-bottom:4px;">或粘贴用户ID（逗号/换行分隔）：</div><textarea id="roleIdsInput" class="role-ids-input" placeholder="uuid1, uuid2 ..."></textarea><button class="role-batch-btn" onclick="batchAssignByIds()">按ID发放</button></div>';
    rolesHtml += '</div></div>';
    adminPanelContent.innerHTML = rolesHtml;
    return;
  }
}

window.toggleCategoryPublic = async function(id, current) { await updateCategory(id, { is_public: !current }); await loadCategories(); renderAdminPanel(); };
window.moveCategoryUp = async function(id) {
    var idx = categories.findIndex(function(c) { return c.id === id; });
    if (idx > 0) { await swapCategoryOrder(id, categories[idx - 1].id); await loadCategories(); renderAdminPanel(); }
};
window.moveCategoryDown = async function(id) {
    var idx = categories.findIndex(function(c) { return c.id === id; });
    if (idx < categories.length - 1) { await swapCategoryOrder(id, categories[idx + 1].id); await loadCategories(); renderAdminPanel(); }
};
window.deleteCategoryById = async function(id) {
    showConfirm('删除分类', '确定删除此分类？其下帖子将移入「未分类」', async function() { await deleteCategory(id); await loadCategories(); renderAdminPanel(); });
};
window.addNewCategory = async function() {
    var name = document.getElementById('newCatName').value.trim();
    if (!name) return showToast('请输入分类名');
    await addCategory(name, true);
    document.getElementById('newCatName').value = '';
    await loadCategories();
    renderAdminPanel();
};
window.banUserPrompt = function(userId, nickname) {
    showPrompt('封号设置', '为用户 "' + nickname + '" 设置解封时间', '选择解封时间', async function(until) {
        if (!until) return showToast('请选择解封时间');
        var banUntilISO = new Date(until).toISOString();
        await banUser(userId, '违规行为', banUntilISO);
        await window.pushNotification(userId, {
            type: 'ban', notification_type: 'ban', ban_until: banUntilISO,
            extra_text: '你的账号因违规被封禁，预计解封时间：' + new Date(banUntilISO).toLocaleString('zh-CN')
        });
        showToast('已封号，站内通知已发送');
        renderAdminPanel();
    }, 'datetime-local');
};
window.unbanUserById = async function(userId) {
    showConfirm('解封用户', '确定解封该用户吗？', async function() { await unbanUser(userId); showToast('已解封'); renderAdminPanel(); });
};
window.loginAsUser = async function(userId) {
    try {
        var res = await window.sb.from('users').select('*').eq('id', userId).single();
        if (res.error) throw res.error;
        if (!res.data) return showToast('用户不存在');
        var user = res.data;
        setSessionUser(user);
        currentUser = user;
        isAdmin = window.isAdmin(user);
        renderHeader('帖子广场', 'posts');
        renderFooter('posts');
        await loadCategories();
        await loadAllData();
        adminPanelOverlay.classList.remove('active');
        if (isAdmin) document.getElementById('adminPanelBtn').style.display = 'inline-flex';
        else document.getElementById('adminPanelBtn').style.display = 'none';
        showToast('已切换到 ' + user.nickname);
        if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
    } catch (err) { showToast('一键登录失败：' + err.message); }
};
window.assignRolePrompt = function(userId, nickname){
  showPrompt("发放身份", "给「"+nickname+"」发放身份（格式：名称#颜色，如 版主#2e7d32）", "如 版主#2e7d32", async function(val){
    if(!val) return;
    var parts = val.split("#");
    var nm = (parts[0]||"").trim(); var cl = (parts[1]||"#2e7d32").trim();
    if(!nm) return showToast("请输入身份名称");
    await assignRoleToUser(userId, nm, cl);
    await loadGlobalRoles();
    showToast("已发放身份"); renderAdminPanel();
  });
};
window.batchAssignRole = async function(){
  var nameEl = document.getElementById("newRoleName");
  var colorEl = document.getElementById("newRoleColor");
  var nm = nameEl ? nameEl.value.trim() : "";
  var cl = colorEl ? colorEl.value : "#2e7d32";
  if(!nm) return showToast("请先填写身份名称");
  var checked = Array.prototype.slice.call(document.querySelectorAll(".role-user-cb:checked"));
  if(!checked.length) return showToast("请至少勾选一个用户");
  for(var i=0;i<checked.length;i++){ await assignRoleToUser(checked[i].value, nm, cl); }
  await loadGlobalRoles();
  showToast("已给 "+checked.length+" 位用户发放身份");
  renderAdminPanel();
};
window.batchAssignByIds = async function(){
  var nameEl = document.getElementById("newRoleName");
  var colorEl = document.getElementById("newRoleColor");
  var nm = nameEl ? nameEl.value.trim() : "";
  var cl = colorEl ? colorEl.value : "#2e7d32";
  if(!nm) return showToast("请先填写身份名称");
  var ta = document.getElementById("roleIdsInput");
  var raw = ta ? ta.value : "";
  var ids = raw.split(/[,\s\n]+/).map(function(s){return s.trim();}).filter(function(s){return s;});
  if(!ids.length) return showToast("请输入用户ID");
  for(var i=0;i<ids.length;i++){ await assignRoleToUser(ids[i], nm, cl); }
  await loadGlobalRoles();
  showToast("已给 "+ids.length+" 个ID发放身份");
  renderAdminPanel();
};
window.removeRoleFromAll = function(roleName) {
    showConfirm('删除身份', '确定删除身份 "' + roleName + '"？', async function() { await removeRoleFromAll(roleName); showToast('身份已删除'); renderAdminPanel(); });
};
window.createRole = function() {
    var name = document.getElementById('newRoleName').value.trim();
    var color = document.getElementById('newRoleColor').value;
    if (!name) return showToast('请输入身份名称');
    showPrompt('分配身份', '请输入要分配该身份的用户ID', '用户UUID', async function(userId) {
        if (!userId) return showToast('请输入用户ID');
        await assignRoleToUser(userId, name, color);
        showToast('身份创建并分配');
        renderAdminPanel();
    });
};

async function loadCategories() {
    categories = await fetchCategories();
    renderCategoryFilter();
}
async function loadAllData() {
    posts = await fetchPosts();
    await fetchAllCommentCounts();
    await renderPosts();
}

(function init() {
    if (!currentUser || !currentUser.id) window.location.href = '/liuyanban/index.html';
    loadGlobalRoles().then(function(){ loadCategories().then(function(){
      loadAllData().then(function(){
        // 若带 ?post=xxx 参数，自动打开该帖子详情
        var p = new URLSearchParams(location.search).get('post');
        if (p) setTimeout(function(){ openPostDetail(p); }, 400);
      });
    }); });

    window.sb.channel('public-posts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, function() { loadAllData(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments' }, function() {
            fetchAllCommentCounts();
            if (currentDetailPostId) renderDetail(currentDetailPostId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, function() {
            if (currentDetailPostId) renderDetail(currentDetailPostId);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, async function(payload) {
            var newComment = payload.new;
            if (!newComment) return;
            var result = await window.sb.from('posts').select('user_id').eq('id', newComment.post_id).single();
            if (result.data && result.data.user_id === currentUser.id && newComment.user_id !== currentUser.id) {
                if (typeof getSoundEnabled === 'function' && getSoundEnabled() && typeof playReminderSound === 'function') playReminderSound();
                if (typeof showTopBanner === 'function') showTopBanner('你的帖子收到新评论');
                if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
            }
        })
        .subscribe();

    function syncUser() {
        var session = getSessionUser();
        if (session && session.id) {
            if (!currentUser || currentUser.id !== session.id || currentUser.avatar_url !== session.avatar_url || currentUser.nickname !== session.nickname) {
                currentUser = session;
                isAdmin = window.isAdmin(currentUser);
                renderHeader('帖子广场', 'posts');
                renderFooter('posts');
                if (isAdmin) document.getElementById('adminPanelBtn').style.display = 'inline-flex';
                else document.getElementById('adminPanelBtn').style.display = 'none';
                loadAllData();
                if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
            }
        }
    }
    window.addEventListener('focus', syncUser);
    document.addEventListener('visibilitychange', function() { if (!document.hidden) syncUser(); });
})();

document.addEventListener('gesturestart', function(e) { e.preventDefault(); });