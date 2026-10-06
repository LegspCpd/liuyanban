/* 七戚 · posts页模块，由 app/posts.html 内联脚本拆分，DOM区未动，加载顺序即依赖顺序 */
// ====== 迷你资料卡 ======
var miniCardEl = document.getElementById("miniCard");
var miniTimer = null;
var isTouch = ("ontouchstart" in window);
var miniOpenFor = null;

function showMiniCard(anchor, uid, name, avatar){
  if(!uid) return;
  miniOpenFor = uid;
  var role = globalRoleMap[uid];
  var roleHtml = role ? '<span class="role-tag" style="background:'+role.role_color+'">'+escapeHtml(role.role_name)+'</span>' : "";
  var avStyle = (avatar && avatar.indexOf("http")===0) ? 'background-image:url('+avatar+');background-size:cover;background-position:center;' : "";
  var avText = (avatar && avatar.indexOf("http")===0) ? "" : escapeHtml(String(name||"U").charAt(0).toUpperCase());
  miniCardEl.innerHTML = '<div class="mc-top" data-uid="'+uid+'">'+
    '<div class="mc-avatar" style="'+avStyle+'">'+avText+'</div>'+
    '<div><div class="mc-name">'+escapeHtml(name||"")+roleHtml+'</div><div class="mc-no">加载中…</div></div></div>'+
    '<div class="mc-bio">加载中…</div>'+
    '<div class="mc-go">点击查看主页 ›</div>';
  miniCardEl.classList.add("show");
  // 定位（头像右边一点）
  var r = anchor.getBoundingClientRect();
  var left = r.right + 10;
  var top = r.top;
  if(left + 240 > window.innerWidth) left = r.left - 240;
  if(top + 200 > window.innerHeight) top = window.innerHeight - 210;
  if(top < 8) top = 8;
  miniCardEl.style.left = left + "px";
  miniCardEl.style.top = top + "px";
  // 加载资料
  window.sb.from("users").select("nickname,avatar_url,bio,user_no").eq("id", uid).single().then(function(res){
    if(res.data && miniOpenFor===uid){
      var d = res.data;
      var bioEl = miniCardEl.querySelector(".mc-bio");
      var noEl = miniCardEl.querySelector(".mc-no");
      if(bioEl) bioEl.textContent = d.bio || "这个人很懒，什么都没写~";
      if(noEl) noEl.textContent = "ID: " + (d.user_no || uid.slice(0,8));
    }
  }).catch(function(){});
  // 点卡片进主页
  miniCardEl.querySelector(".mc-top").onclick = function(){ goUser(uid); hideMiniCard(); };
  miniCardEl.querySelector(".mc-go").onclick = function(){ goUser(uid); hideMiniCard(); };
}
function hideMiniCard(){ miniCardEl.classList.remove("show"); miniOpenFor = null; }
window.hideMiniCard = hideMiniCard;

// 事件委托（滚动/点击时用）
document.addEventListener("click", function(e){
  var av = e.target.closest && e.target.closest(".author-avatar");
  if(av){
    var uid = av.dataset.uid;
    if(isTouch){
      // 手机：第一次点弹卡，再点进主页
      if(miniOpenFor === uid){ goUser(uid); hideMiniCard(); }
      else { e.stopPropagation(); showMiniCard(av, uid, av.dataset.name, av.dataset.avatar); }
    } else {
      goUser(uid);
    }
    return;
  }
  if(!e.target.closest || !e.target.closest(".mini-card")) hideMiniCard();
});
document.addEventListener("mouseover", function(e){
  if(isTouch) return;
  var av = e.target.closest && e.target.closest(".author-avatar");
  if(av){ clearTimeout(miniTimer); showMiniCard(av, av.dataset.uid, av.dataset.name, av.dataset.avatar); }
});
document.addEventListener("mouseout", function(e){
  if(isTouch) return;
  var av = e.target.closest && e.target.closest(".author-avatar");
  if(av){ clearTimeout(miniTimer); miniTimer = setTimeout(hideMiniCard, 220); }
});
miniCardEl.addEventListener("mouseenter", function(){ clearTimeout(miniTimer); });
miniCardEl.addEventListener("mouseleave", function(){ if(!isTouch) miniTimer = setTimeout(hideMiniCard, 180); });
window.addEventListener("scroll", hideMiniCard, true);
var globalRoleMap = {};  // user_id -> {role_name, role_color}
async function loadGlobalRoles(){
  try{
    var roles = await fetchUserRoles();
    globalRoleMap = {};
    roles.forEach(function(r){ globalRoleMap[r.user_id] = r; });
  }catch(e){ globalRoleMap = {}; }
}
function roleTagHTML(userId){
  var r = globalRoleMap[userId];
  if(!r) return '';
  return '<span class="role-tag" style="background:'+escapeHtml(r.role_color||'#2e7d32')+'">'+escapeHtml(r.role_name||'')+'</span>';
}
async function banUser(userId, reason, until) { await window.sb.from('users').update({ banned_reason: reason, banned_until: until }).eq('id', userId); }
async function unbanUser(userId) { await window.sb.from('users').update({ banned_until: null }).eq('id', userId); }
async function assignRoleToUser(userId, roleName, roleColor) {
    await window.sb.from('user_roles').delete().eq('user_id', userId);
    await window.sb.from('user_roles').insert([{ user_id: userId, role_name: roleName, role_color: roleColor }]);
}
async function removeRoleFromAll(roleName) {
    var roles = await fetchUserRoles();
    for (var i = 0; i < roles.length; i++) {
        if (roles[i].role_name === roleName) await window.sb.from('user_roles').delete().eq('id', roles[i].id);
    }
}
async function loadPollData(postId) {
    var res = await window.sb.from('post_polls').select('*, poll_options(*), poll_votes(option_id, user_id)').eq('post_id', postId).single();
    return res.data || null;
}
async function votePoll(optionId) {
    if (!currentUser) return showToast('请先登录');
    await window.sb.from('poll_votes').upsert([{ option_id: optionId, user_id: currentUser.id }], { onConflict: 'option_id,user_id' });
    showToast('投票成功');
    if (currentDetailPostId) renderDetail(currentDetailPostId);
}
window.votePoll = votePoll;

// 举报：接收 reportedUserId 而非 author
async function reportPost(contentId, reportedUserId, contentSnapshot) {
    if (!reportedUserId) { showToast('无法识别被举报用户'); return; }
    if (reportedUserId === currentUser.id) { showToast('不能举报自己'); return; }
    openReportDialog(reportedUserId, 'post', contentId, contentSnapshot);
}
window.reportPost = reportPost;
