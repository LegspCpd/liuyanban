/* ============================================================================
 *  room/room-rt.js —— 
 *  由 room.html 内联脚本逐行拆出，零改动。加载顺序见 room.html 的 script 串。
 * ============================================================================ */
/* ============================================================
   房间消息
============================================================ */
async function loadMessages(){
  try{var res=await window.sb.from('room_messages').select('*').eq('room_id',state.room.id).order('created_at',{ascending:true}).limit(200);if(res.error)throw res.error;state.messages=res.data||[];if(state.messages.length)state.lastMsgId=state.messages[state.messages.length-1].id}catch(e){state.messages=[]}
  renderMessages();
}
function renderMessages(){
  var c=document.getElementById('roomMessages');
  if(!state.messages.length){c.innerHTML='<div class="empty-state" style="padding:20px;font-size:.85em;color:var(--text-muted)">还没有人说话，来打个招呼吧</div>';return}
  c.innerHTML=state.messages.map(function(m){var self=m.user_id===currentUser.id;var has=m.avatar_url&&String(m.avatar_url).indexOf('http')===0;return '<div class="rm-msg'+(self?' self':'')+'"><div class="rm-avatar" style="'+(has?'background-image:url('+escapeHtml(m.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(has?'':escapeHtml(String(m.author||'U').charAt(0).toUpperCase()))+'</div><div class="rm-bubble"><div class="rm-name">'+escapeHtml(m.author||'')+'</div><div class="rm-text">'+escapeHtml(m.content||'')+'</div></div></div>'}).join('');
  c.scrollTop=c.scrollHeight;
}
async function clearRoomMessages(){
  if(!isAdminFlag){showToast('只有管理员能清空');return}
  showConfirm('清空房间消息','确定要清空本房间的所有聊天消息吗？此操作不可恢复！',async function(){
    try{
      var res=await window.sb.from('room_messages').delete().eq('room_id',state.room.id);
      if(res.error)throw res.error;
      state.messages=[];renderMessages();showToast('消息已清空');
    }catch(e){showToast('清空失败：'+e.message)}
  });
}
window.clearRoomMessages=clearRoomMessages;
async function disbandRoom(){
  if(!isAdminFlag){showToast('只有管理员能解散房间');return}
  if(!state.room)return;
  showConfirm('解散房间','确定要解散「'+state.room.name+'」吗？房间及所有消息将被永久删除！',async function(){
    try{
      var rid=state.room.id;
      await window.sb.from('room_messages').delete().eq('room_id',rid);
      var res=await window.sb.from('rooms').delete().eq('id',rid);
      if(res.error)throw res.error;
      showToast('房间已解散');
      leaveRoomLocal();
      history.replaceState({},'',location.pathname);
      showList();loadRooms();
    }catch(e){showToast('解散失败：'+e.message)}
  });
}
window.disbandRoom=disbandRoom;
async function clearCurrentGame(){
  if(!isAdminFlag){showToast("只有管理员能清空游戏");return}
  if(!state.room)return;
  showConfirm("清空游戏","确定要结束当前游戏吗？","", async function(){
    try{ await window.sb.from("rooms").update({current_game:null}).eq("id",state.room.id); state.room.current_game=null; renderMic(); renderGame(); showToast("游戏已清空"); }catch(e){showToast("操作失败："+e.message)}
  });
}
window.clearCurrentGame=clearCurrentGame;
async function toggleMuteAll(on){
  if(!isAdminFlag){showToast("只有管理员能操作");return}
  if(!state.room)return;
  try{ await window.sb.from("rooms").update({mute_all:on}).eq("id",state.room.id); state.room.mute_all=on; showToast(on?"已开启全员禁言":"已关闭全员禁言"); }catch(e){ if(/mute_all|column|schema cache/i.test(e.message||"")){ state.room.mute_all=on; showToast("已切换（本地生效，数据库需跑 compat 补丁持久化）"); } else showToast("操作失败："+e.message) }
}
window.toggleMuteAll=toggleMuteAll;
async function setRoomHost(uid){
  if(!isAdminFlag){showToast("只有管理员能更换房主");return}
  if(!state.room)return;
  var u=(state.room.current_game&&state.room.current_game.players||[]).find(function(p){return p.user_id===uid;});
  showConfirm("更改房主","确定把房主转让给该用户吗？","", async function(){
    try{
      await window.sb.from("rooms").update({creator_id:uid}).eq("id",state.room.id);
      state.room.creator_id=uid;
      // 若游戏进行中，同步换游戏房主
      if(state.room.current_game){ var ng=Object.assign({},state.room.current_game,{host_id:uid}); await window.sb.from("rooms").update({current_game:ng}).eq("id",state.room.id); state.room.current_game=ng; }
      renderMic(); renderGame(); showToast("房主已更换");
    }catch(e){showToast("操作失败："+e.message)}
  });
}
window.setRoomHost=setRoomHost;
async function sendMsg(){
  if(!state.room)return;if(isUserBanned()){showToast('账号已被封禁');return}
  var r=state.room,muted=r.muted_user_ids||[];if(!isAdminFlag&&muted.indexOf(currentUser.id)>=0){showToast('你已被禁言');return}
  if(!isAdminFlag&&r.mute_all){showToast('全员禁言中，暂时无法发言');return}
  var input=document.getElementById('roomInput'),text=input.value.trim();if(!text){showToast('请输入内容');return}input.value='';
  try{var res=await window.sb.from('room_messages').insert([{room_id:state.room.id,user_id:currentUser.id,author:currentUser.nickname,avatar_url:currentUser.avatar_url||'',content:text}]);if(res.error)throw res.error}catch(e){showToast('发送失败：'+e.message);input.value=text}
}

/* ============================================================
   实时订阅
============================================================ */
function subscribe(){
  if(state.roomChannel){window.sb.removeChannel(state.roomChannel);state.roomChannel=null}
  if(state.msgChannel){window.sb.removeChannel(state.msgChannel);state.msgChannel=null}
  var roomId=state.room.id;
  state.roomChannel=window.sb.channel('sq-room-'+roomId+'-'+Date.now())
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'rooms',filter:'id=eq.'+roomId},function(p){
      state.room=p.new;
      document.getElementById('roomTitle').textContent=state.room.name;
      renderMic();renderGame();
      if(state.memberChannel){
        var raw=state.memberChannel.presenceState();
        var arr=[];
        Object.keys(raw).forEach(function(k){var list=raw[k];if(!list||!list.length)return;var pr=list[0];arr.push({id:k,nickname:pr.nickname||'用户',avatar_url:pr.avatar_url||'',joined_at:pr.joined_at||''})});
        arr.sort(function(a,b){return (a.joined_at||'').localeCompare(b.joined_at||'')});
        renderMemberList(arr);
      }
    })
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'rooms',filter:'id=eq.'+roomId},function(){showToast('房间已被删除');leaveRoomLocal();history.replaceState({},'',location.pathname);showList();loadRooms()})
    .subscribe();
  state.msgChannel=window.sb.channel('sq-room-msg-'+roomId+'-'+Date.now())
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'room_messages',filter:'room_id=eq.'+roomId},function(p){if(state.messages.some(function(x){return x.id===p.new.id}))return;state.messages.push(p.new);state.lastMsgId=p.new.id;renderMessages();pushDanmaku(p.new.author||'',p.new.content||'')})
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'room_messages',filter:'room_id=eq.'+roomId},function(){loadMessages()})
    .subscribe();
}

/* ============================================================
   房间设置（管理员）
============================================================ */
async function fetchAllUsers(){var r=await window.sb.from('users').select('id, nickname, avatar_url, phone');return r.data||[]}
async function openRoomEditor(){
  if(!isAdminFlag||!state.room)return;
  var room=await freshRoom();var users=await fetchAllUsers();
  var coIds=room.co_admin_ids||[],permsMap=room.co_admin_permissions||{},mutedIds=room.muted_user_ids||[];
  var old=document.getElementById('roomEditorOverlay');if(old)old.remove();
  var overlay=document.createElement('div');overlay.className='re-overlay';overlay.id='roomEditorOverlay';
  var userRows=users.filter(function(u){return u.id!==currentUser.id}).map(function(u){
    var isCo=coIds.indexOf(u.id)>=0,isMuted=mutedIds.indexOf(u.id)>=0;var p=permsMap[u.id]||{};
    function chk(k,label){var checked=p[k]!==false;return '<label class="re-chk"><input type="checkbox" data-perm="'+k+'" data-uid="'+u.id+'" '+(checked?'checked':'')+'> '+label+'</label>'}
    var hostBtn=(u.id!==(room.creator_id||''))?'<button type="button" class="re-host-btn" onclick="setRoomHost(\''+u.id+'\')">设为房主</button>':'<span style="font-size:.7em;color:var(--text-muted);">当前房主</span>';
    return '<div class="re-user"><div class="re-user-top"><span class="re-name">'+escapeHtml(u.nickname)+'</span><label class="re-chk"><input type="checkbox" data-co="'+u.id+'" '+(isCo?'checked':'')+'> 协管</label><label class="re-chk"><input type="checkbox" data-mute="'+u.id+'" '+(isMuted?'checked':'')+'> 禁言</label>'+hostBtn+'</div><div class="re-perms'+(isCo?' on':'')+'" data-perms-for="'+u.id+'">'+chk('revoke','撤回消息')+chk('mute','禁言用户')+chk('mic','管理连麦')+chk('game','发起游戏')+'</div></div>';
  }).join('');
  overlay.innerHTML='<div class="re-panel"><div class="re-head"><h3><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:4px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>房间设置</h3><button id="reClose"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="re-body"><div class="re-field"><label>房间名称</label><input type="text" id="reName" maxlength="20" value="'+escapeHtml(room.name)+'" /></div><div class="re-field"><label>连麦模式</label><div class="re-radio-row"><label class="re-radio"><input type="radio" name="reMicMode" value="free" '+(room.mic_mode!=='host'?'checked':'')+'> 自由连麦</label><label class="re-radio"><input type="radio" name="reMicMode" value="host" '+(room.mic_mode==='host'?'checked':'')+'> 主持人连麦</label></div></div><div class="re-field"><label>连麦开关</label><label class="re-chk" style="font-size:.85em;"><input type="checkbox" id="reMicEnabled" '+(room.mic_enabled!==false?'checked':'')+'> 允许连麦</label></div><div class="re-field"><label>游戏设置</label><label class="re-chk" style="font-size:.85em;color:var(--danger);"><input type="checkbox" id="reGameDisabled" '+(room.game_disabled?'checked':'')+'> 禁止本房间所有游戏</label></div><div class="re-field"><label>协助管理员 &amp; 权限</label>'+(userRows||'<div style="font-size:.8em;color:var(--text-muted);padding:8px 0;">暂无其他用户</div>')+'</div></div><div class="re-foot"><button class="cancel" id="reCancel">取消</button><button class="ok" id="reSave">保存</button></div></div>';
  document.body.appendChild(overlay);
  // 把设置内容重构成 Tab 结构（基本设置 / 成员权限 / 危险操作）
  try{ restructureRoomEditor(overlay); }catch(e){}
  overlay.querySelectorAll('input[data-co]').forEach(function(cb){cb.onchange=function(){var uid=this.dataset.co;var box=overlay.querySelector('[data-perms-for="'+uid+'"]');if(box)box.classList.toggle('on',this.checked)}});
  overlay.querySelector('#reClose').onclick=function(){overlay.remove()};
  overlay.querySelector('#reCancel').onclick=function(){overlay.remove()};
  overlay.addEventListener('click',function(e){if(e.target===overlay)overlay.remove()});
  overlay.querySelector('#reSave').onclick=async function(){
    var name=overlay.querySelector('#reName').value.trim();if(!name){showToast('请输入房间名称');return}
    var modeEl=overlay.querySelector('input[name="reMicMode"]:checked');var micMode=modeEl?modeEl.value:'free';
    var micEnabled=overlay.querySelector('#reMicEnabled').checked;var gameDisabled=overlay.querySelector('#reGameDisabled').checked;
    var newCoIds=[],newPerms={},newMuted=[];
    overlay.querySelectorAll('input[data-co]').forEach(function(cb){if(cb.checked)newCoIds.push(cb.dataset.co)});
    overlay.querySelectorAll('input[data-mute]').forEach(function(cb){if(cb.checked)newMuted.push(cb.dataset.mute)});
    newCoIds.forEach(function(uid){newPerms[uid]={};overlay.querySelectorAll('input[data-perm][data-uid="'+uid+'"]').forEach(function(cb){newPerms[uid][cb.dataset.perm]=cb.checked})});
    var speaking=(room.mic_speaking||[]).filter(function(m){return newMuted.indexOf(m.user_id)<0});
    var requests=(room.mic_requests||[]).filter(function(m){return newMuted.indexOf(m.user_id)<0});
    try{var upd=await window.sb.from('rooms').update({name:name,mic_mode:micMode,mic_enabled:micEnabled,game_disabled:gameDisabled,co_admin_ids:newCoIds,co_admin_permissions:newPerms,muted_user_ids:newMuted,mic_speaking:speaking,mic_requests:requests}).eq('id',state.room.id).select().single();if(upd.error)throw upd.error;state.room=upd.data;document.getElementById('roomTitle').textContent=upd.data.name;renderMic();renderGame();overlay.remove();showToast('设置已保存')}catch(e){showToast('保存失败：'+e.message)}
  };
}
window.openRoomEditor=openRoomEditor;
function restructureRoomEditor(overlay){
  var body=overlay.querySelector(".re-body"); if(!body) return;
  var fields=Array.prototype.slice.call(body.querySelectorAll(":scope > .re-field"));
  if(!fields.length) return;
  // 分类：前几个字段=基本设置；含“协管/权限”的=成员权限
  var basicFields=[], memberFields=[];
  fields.forEach(function(f){
    var t=f.querySelector("label")?f.querySelector("label").textContent:"";
    if(/协管|权限|成员|管理/.test(t)) memberFields.push(f); else basicFields.push(f);
  });
  body.innerHTML="";
  body.classList.add("re-body-tabbed");
  // Tab 栏
  var tabs=document.createElement("div"); tabs.className="re-tabs";
  tabs.innerHTML='<button class="re-tab active" data-rtab="basic">基本设置</button><button class="re-tab" data-rtab="member">成员权限</button><button class="re-tab" data-rtab="danger">危险操作</button>';
  body.parentNode.insertBefore(tabs, body);
  // pane1 基本
  var p1=document.createElement("div"); p1.className="re-tabpane active"; p1.dataset.pane="basic";
  basicFields.forEach(function(f){p1.appendChild(f);});
  // pane2 成员
  var p2=document.createElement("div"); p2.className="re-tabpane"; p2.dataset.pane="member";
  if(memberFields.length){memberFields.forEach(function(f){p2.appendChild(f);});}
  else{p2.innerHTML='<div style="font-size:.8em;color:var(--text-muted);padding:8px 0;">暂无其他用户</div>';}
  // pane3 危险
  var p3=document.createElement("div"); p3.className="re-tabpane"; p3.dataset.pane="danger";
  p3.innerHTML='<div class="re-danger-body" id="reDangerBody"><button class="re-danger-btn" id="reClearMsgs">清空房间消息</button><button class="re-danger-btn" id="reClearGame">清空当前游戏</button><button class="re-danger-btn" id="reDisband">解散房间</button></div><label class="re-chk" style="margin-top:12px;display:flex;align-items:center;gap:8px;font-size:.85em;"><input type="checkbox" id="reMuteAll" '+(state.room.mute_all?"checked":"")+'> 全员禁言（管理员除外）</label>';
  body.appendChild(p1); body.appendChild(p2); body.appendChild(p3);
  // Tab 切换
  tabs.querySelectorAll(".re-tab").forEach(function(btn){
    btn.onclick=function(){
      var t=this.dataset.rtab;
      tabs.querySelectorAll(".re-tab").forEach(function(b){b.classList.toggle("active",b.dataset.rtab===t);});
      body.querySelectorAll(".re-tabpane").forEach(function(p){p.classList.toggle("active",p.dataset.pane===t);});
    };
  });
  // 绑定危险操作
  var cm=overlay.querySelector("#reClearMsgs"); if(cm) cm.onclick=clearRoomMessages;
  var cg=overlay.querySelector("#reClearGame"); if(cg) cg.onclick=function(){ overlay.remove(); clearCurrentGame(); };
  var db=overlay.querySelector("#reDisband"); if(db) db.onclick=function(){overlay.remove();disbandRoom();};
  var ma=overlay.querySelector("#reMuteAll"); if(ma) ma.onchange=function(){ toggleMuteAll(this.checked); };
}
window.switchReTab=function(){};

/* ============================================================
   事件
============================================================ */
document.getElementById('roomSendBtn').onclick=sendMsg;
document.getElementById('roomInput').addEventListener('keydown',function(e){if(e.key==='Enter')sendMsg()});
document.getElementById('roomSettingsBtn').onclick=openRoomEditor;
/* 游戏设置弹窗逻辑 */
document.getElementById("gamePrefsBtn").onclick=function(){
  var ov=document.getElementById("gamePrefsOverlay");if(!ov)return;
  var tg=document.getElementById("gomokuConfirmToggle");
  if(tg)tg.checked=(localStorage.getItem("gomoku_skip_confirm")!=="1");
  ov.classList.add("open");
};
document.getElementById("gamePrefsClose").onclick=function(){document.getElementById("gamePrefsOverlay").classList.remove("open");};
document.getElementById("gamePrefsOverlay").addEventListener("click",function(e){if(e.target===this)this.classList.remove("open");});
document.getElementById("gomokuConfirmToggle").onchange=function(){
  if(this.checked){localStorage.removeItem("gomoku_skip_confirm");showToast("已开启落子确认");}
  else{localStorage.setItem("gomoku_skip_confirm","1");showToast("已关闭落子确认");}
};

/* ★ 房主退出页面 → 游戏结束 */
window.addEventListener('beforeunload',function(){
  if(state.room&&currentUser){
    try{
      var sp=(state.room.mic_speaking||[]).filter(function(m){return m.user_id!==currentUser.id});
      var rq=(state.room.mic_requests||[]).filter(function(m){return m.user_id!==currentUser.id});
      window.sb.from('rooms').update({mic_speaking:sp,mic_requests:rq}).eq('id',state.room.id);
      if(state.room.current_game){
        var game=state.room.current_game;
        if(game.host_id===currentUser.id){
          window.sb.from('rooms').update({current_game:null}).eq('id',state.room.id);
        }else{
          var ps=(game.players||[]).filter(function(p){return p.user_id!==currentUser.id});
          if(!ps.length)window.sb.from('rooms').update({current_game:null}).eq('id',state.room.id);
          else{
            var ng=Object.assign({},game,{players:ps});
            if(game.type==='gomoku')ng.state=Object.assign({},game.state,{board:emptyBoard(),turn:'black',winner:null});
            window.sb.from('rooms').update({current_game:ng}).eq('id',state.room.id);
          }
        }
      }
    }catch(e){}
  }
});
document.addEventListener('gesturestart',function(e){e.preventDefault()});

/* ============================================================
   初始化
============================================================ */
(function init(){
  var params=new URLSearchParams(location.search);
  var roomId=params.get('id');var openSettings=params.get('settings')==='1';
  if(roomId)enterRoom(roomId,openSettings);else{showList();loadRooms()}
})();
