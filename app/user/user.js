/* 七戚 · user页模块，由 app/user.html 内联脚本拆分，DOM区未动 */

// ============================================================
// 用户主页
// ============================================================
var currentUser = getSessionUser();
if (!currentUser || !currentUser.id) window.location.href = '/liuyanban/index.html';

var viewingUser = null;   // 被查看的用户
var isSelf = false;
var iFollowed = false;
var myPosts = [];

function $(id){ return document.getElementById(id); }
// 从 URL 取目标用户（?u=user_no 或 ?id=uuid）
function getTargetParam(){
  var p = new URLSearchParams(location.search);
  return { no: p.get('u'), id: p.get('id') };
}

async function loadUser(){
  var t = getTargetParam();
  var q = window.sb.from('users').select('*');
  if (t.no) q = q.eq('user_no', t.no);
  else if (t.id) q = q.eq('id', t.id);
  else q = q.eq('id', currentUser.id);   // 默认看自己
  var res = await q.single();
  if (res.error || !res.data) { $('pageContent').innerHTML = '<div class="empty">用户不存在</div>'; return false; }
  viewingUser = res.data;
  isSelf = (viewingUser.id === currentUser.id);
  return true;
}

function calcAge(birthday){
  if(!birthday) return null;
  var b = new Date(birthday); var now = new Date();
  var age = now.getFullYear() - b.getFullYear();
  var m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return (age >= 0 && age < 150) ? age : null;
}

function avatarOf(u){
  if (u.avatar_url && String(u.avatar_url).indexOf('http') === 0)
    return '<div class="hero-avatar" style="background-image:url(' + escapeHtml(u.avatar_url) + ');background-size:cover;background-position:center;"></div>';
  return '<div class="hero-avatar">' + escapeHtml(String(u.nickname||'U').charAt(0).toUpperCase()) + '</div>';
}

async function loadFollow(){
  if (isSelf) return;
  var r = await window.sb.from('follows').select('id').eq('follower_id', currentUser.id).eq('following_id', viewingUser.id);
  iFollowed = !!(r.data && r.data.length);
}

async function loadCounts(){
  var f1 = await window.sb.from('follows').select('id', { count:'exact', head:true }).eq('following_id', viewingUser.id); // 粉丝
  var f2 = await window.sb.from('follows').select('id', { count:'exact', head:true }).eq('follower_id', viewingUser.id);   // 关注
  return { fans: f1.count || 0, following: f2.count || 0 };
}

async function loadPosts(){
  var r = await window.sb.from('posts').select('*').eq('user_id', viewingUser.id).order('created_at', { ascending:false });
  myPosts = r.data || [];
}

async function render(){
  if (!(await loadUser())) return;
  await loadFollow();
  await loadPosts();
  var counts = await loadCounts();
  var age = calcAge(viewingUser.birthday);

  var hero = '<div class="profile-hero">';

  hero += '<div class="hero-main">';
  hero += avatarOf(viewingUser);
  hero += '<div class="hero-info">';
  hero += '<div class="hero-name">' + escapeHtml(viewingUser.nickname || '用户') + '</div>';
  hero += '<div class="hero-stats">' +
    '<div class="hero-stat"><span class="num">' + myPosts.length + '</span><span class="lbl">帖子</span></div>' +
    '<div class="hero-stat"><span class="num">' + counts.fans + '</span><span class="lbl">粉丝</span></div>' +
    '<div class="hero-stat"><span class="num">' + counts.following + '</span><span class="lbl">关注</span></div>' +
    '</div>';
  var line2 = '<span class="hero-no">ID: ' + escapeHtml(viewingUser.user_no || viewingUser.id.slice(0,8)) + '</span>';
  if (viewingUser.gender === '男') {
    line2 += '<span class="hero-gender male" title="男"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="14" r="5"/><line x1="19" y1="5" x2="13.5" y2="10.5"/><polyline points="15 5 19 5 19 9"/></svg></span>';
  } else if (viewingUser.gender === '女') {
    line2 += '<span class="hero-gender female" title="女"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><line x1="12" y1="14" x2="12" y2="22"/><line x1="9" y1="19" x2="15" y2="19"/></svg></span>';
  }
  hero += '<div class="hero-line2">' + line2 + '</div>';
  hero += '</div></div>';
  hero += '<div class="hero-bio">' + (viewingUser.bio ? escapeHtml(viewingUser.bio) : '这个人很懒，没有写简介') + '</div>';
  // 操作按钮
  hero += '<div class="hero-actions">';
  if (isSelf) {
    hero += '<button class="btn-edit-profile" onclick="openEdit()">编辑资料</button>';
  } else {
    hero += '<button class="btn-follow' + (iFollowed?' following':'') + '" onclick="toggleFollow()">' + (iFollowed?'已关注':'+ 关注') + '</button>';
  }
  hero += '</div></div>';

  // 六宫格导航（仅看自己时）
  var navHtml = '';
  if (isSelf) {
    var isAdmin = window.isAdmin(currentUser);
    navHtml = '<div class="nav-grid">' +
      '<div class="nav-cell" onclick="location.href=\'/liuyanban/profile.html?view=messages\'"><div class="ic"><svg viewBox="0 0 24 24"><path d="M4 4h16v12H5.17L4 17.17V4z"/></svg></div><div class="tx">消息中心</div></div>' +
      '<div class="nav-cell" onclick="location.href=\'/liuyanban/profile.html?view=feedback\'"><div class="ic"><svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div class="tx">反馈 Bug</div></div>' +
      '<div class="nav-cell" onclick="location.href=\'/liuyanban/profile.html?view=about\'"><div class="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div><div class="tx">关于我们</div></div>' +
      (isAdmin ? '<div class="nav-cell" onclick="location.href=\'/liuyanban/profile.html?view=adminfeedback\'"><div class="ic"><svg viewBox="0 0 24 24"><path d="M3 3h18v14H5l-2 2V3z"/><path d="M8 8h8M8 12h5"/></svg></div><div class="tx">反馈管理</div></div>' : '') +
      (isAdmin ? '<div class="nav-cell" onclick="location.href=\'/liuyanban/profile.html?view=sites\'"><div class="ic"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></div><div class="tx">网站管理</div></div>' : '') +
      '</div>';
  }
  // 帖子列表
  var postsHtml = '<div class="tabs"><button class="tab active">' + (isSelf ? '我的帖子' : '他的帖子') + ' (' + myPosts.length + ')</button></div>';
  if (myPosts.length) {
    postsHtml += myPosts.map(function(p){
      return '<div class="post-card" onclick="goPost(\'' + p.id + '\')">' +
        (p.title ? '<div class="post-title">' + escapeHtml(p.title) + '</div>' : '') +
        '<div class="post-body">' + escapeHtml(String(p.content||'').replace(/<[^>]*>/g,'').substring(0,120)) + '</div>' +
        '<div class="post-foot"><span>' + new Date(p.created_at).toLocaleDateString('zh-CN') + '</span></div></div>';
    }).join('');
  } else {
    postsHtml += '<div class="empty">还没有发过帖子</div>';
  }

  $('pageContent').innerHTML = hero + navHtml + postsHtml;
}

function goPost(id){ location.href = '/liuyanban/posts.html?post=' + id; }
window.goPost = goPost;
async function toggleFollow(){
  if (isSelf) return;
  try{
    if (iFollowed) {
      await window.sb.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', viewingUser.id);
      iFollowed = false;
      showToast('已取消关注');
    } else {
      await window.sb.from('follows').insert([{ follower_id: currentUser.id, following_id: viewingUser.id }]);
      iFollowed = true;
      showToast('已关注');
    }
    await render();
  }catch(e){ showToast('操作失败：' + e.message); }
}

// ====== 编辑资料 ======
function openEdit(){
  var u = viewingUser;
  $('editNickname').value = u.nickname || '';
  $('editBio').value = u.bio || '';
  $('editGender').value = u.gender || '';
  $('editBirthday').value = u.birthday || '';
  var av = $('editAvatar');
  if (u.avatar_url && String(u.avatar_url).indexOf('http') === 0) {
    av.style.backgroundImage = 'url(' + u.avatar_url + ')'; av.textContent = '';
  } else {
    av.style.backgroundImage = ''; av.textContent = String(u.nickname||'U').charAt(0).toUpperCase();
  }
  $('editModal').classList.add('active');
}
function closeEdit(){ $('editModal').classList.remove('active'); }
window.openEdit = openEdit; window.closeEdit = closeEdit; window.toggleFollow = toggleFollow;

async function saveProfile(){
  var patch = {
    nickname: $('editNickname').value.trim(),
    bio: $('editBio').value.trim(),
    gender: $('editGender').value,
    birthday: $('editBirthday').value || null
  };
  if (!patch.nickname) return showToast('昵称不能为空');
  try{
    await window.sb.from('users').update(patch).eq('id', currentUser.id);
    // 更新本地 session
    var u = getSessionUser() || {};
    u.nickname = patch.nickname; u.bio = patch.bio; u.gender = patch.gender; u.birthday = patch.birthday;
    setSessionUser(u);
    currentUser = u;
    showToast('已保存');
    closeEdit();
    await render();
  }catch(e){ showToast('保存失败：' + e.message); }
}
window.saveProfile = saveProfile;
function doLogout(){
  if (typeof showConfirm === 'function') {
    showConfirm('退出登录', '确定要退出登录吗？', function(){
      try{ localStorage.removeItem('sq_user_session'); }catch(e){}
      location.href = '/liuyanban/index.html';
    });
  } else {
    if(confirm('确定要退出登录吗？')){
      try{ localStorage.removeItem('sq_user_session'); }catch(e){}
      location.href = '/liuyanban/index.html';
    }
  }
}
window.doLogout = doLogout;

// 头像上传
document.getElementById('editAvatarInput').onchange = async function(e){
  var file = e.target.files[0]; if (!file) return;
  if (file.size > 5*1024*1024) { showToast('图片不能超过 5MB'); this.value=''; return; }
  try{
    showToast('上传中...');
    var ext = (file.name.split('.').pop() || 'png').toLowerCase();
    var path = 'avatars/' + currentUser.id + '/profile_' + Date.now() + '.' + ext;
    var up = await window.sb.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) throw up.error;
    var url = window.sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    await window.sb.from('users').update({ avatar_url: url }).eq('id', currentUser.id);
    var u = getSessionUser() || {}; u.avatar_url = url; setSessionUser(u); currentUser = u;
    viewingUser.avatar_url = url;
    var av = $('editAvatar'); av.style.backgroundImage = 'url(' + url + ')'; av.textContent = '';
    showToast('头像已更新');
  }catch(err){ showToast('上传失败：' + err.message); }
};

// ====== 初始化 ======
(async function init(){
  // 先渲染顶部 + 底部导航（加载期间可见，避免导航栏闪烁/消失）
  if (typeof renderHeader === "function") renderHeader("用户主页", "profile");
  if (typeof renderFooter === "function") renderFooter("profile");
  await render();  // 再渲染内容，确定 isSelf
  if (isSelf) {
    // 看自己：保留底部导航 + 顶部头像
    if (typeof renderFooter === "function") renderFooter("profile");
    if (typeof renderHeader === "function") renderHeader("用户主页", "profile");
  } else {
    // 看别人：隐藏底部导航，顶部改为"返回按钮"（左）+ 无标题
    var fc = document.getElementById("footer-container");
    if (fc) fc.style.display = "none";
    var hc = document.getElementById("header-container");
    if (hc) {
      hc.innerHTML = '<div class="app-header" style="justify-content:flex-start;">' +
        '<button class="back-btn" onclick="goBackFromUser()" title="返回" style="background:none;border:none;cursor:pointer;padding:6px;color:var(--text);display:flex;border-radius:8px;">' +
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>' +
        '</button></div>';
    }
  }
})();
function goBackFromUser(){
  if (window.history.length > 1) window.history.back();
  else location.href = '/liuyanban/posts.html';
}
window.goBackFromUser = goBackFromUser;
