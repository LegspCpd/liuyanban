/* ============================================================================
 *  room/room-core.js —— 
 *  由 room.html 内联脚本逐行拆出，零改动。加载顺序见 room.html 的 script 串。
 * ============================================================================ */

var currentUser=getSessionUser();
if(!currentUser||!currentUser.id)window.location.href='/liuyanban/index.html';
var isAdminFlag=window.isAdmin(currentUser);
if(isAdminFlag)document.getElementById('createRoomBtn').style.display='inline-flex';

var rooms=[];
var state={room:null,messages:[],roomChannel:null,msgChannel:null,memberChannel:null,lastMsgId:null,spectating:false};
var gameTickInterval=null;
var offlineCheckTimer=null;

/* ============================================================
   视图切换
============================================================ */
function showList(){document.getElementById('listView').classList.remove('hidden');document.getElementById('detailView').classList.remove('open')}
function showDetail(){document.getElementById('listView').classList.add('hidden');document.getElementById('detailView').classList.add('open')}
document.getElementById('detailBackBtn').onclick=function(){
  if(state.room&&state.room.current_game){try{leaveGame()}catch(e){}}
  leaveRoomLocal();
  history.replaceState({},'',location.pathname);
  showList();loadRooms();
};

/* ============================================================
   房间列表
============================================================ */
async function loadRooms(){
  var grid=document.getElementById('roomGrid');
  grid.innerHTML='<div class="loading-state"><div class="spinner"></div>加载中…</div>';
  try{var res=await window.sb.from('rooms').select('*').order('created_at',{ascending:true});if(res.error)throw res.error;rooms=res.data||[];renderGrid()}
  catch(e){grid.innerHTML='<div class="empty-state"><div class="big"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg></div>房间功能尚未初始化'+(isAdminFlag?'<br><small>请先在 Supabase 创建 rooms 数据表</small>':'')+'</div>'}
}
function renderGrid(){
  var grid=document.getElementById('roomGrid');
  if(!rooms.length){grid.innerHTML='<div class="empty-state"><div class="big"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg></div>还没有房间'+(isAdminFlag?'<br><small>点击右上角创建第一个房间</small>':'')+'</div>';return}
  grid.innerHTML=rooms.map(function(r){
    var coIds=r.co_admin_ids||[],isCo=coIds.indexOf(currentUser.id)>=0;
    var badge=(isAdminFlag||isCo)?'<span class="room-card-badge">管理</span>':'';
    var editBtn=isAdminFlag?'<button class="room-edit-btn" data-edit="'+r.id+'"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>':'';
    var gameTag=r.current_game&&r.current_game.type?'<div class="room-card-meta" style="color:var(--primary);font-weight:700;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>游戏中</div>':'<div class="room-card-meta">'+(r.mic_mode==='host'?'主持人连麦':'自由连麦')+'</div>';
    return '<div class="room-card" data-id="'+r.id+'">'+badge+editBtn+'<div class="room-card-icon"><svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg></div><div class="room-card-name">'+escapeHtml(r.name)+'</div>'+gameTag+'</div>';
  }).join('');
  grid.querySelectorAll('.room-card').forEach(function(el){el.addEventListener('click',function(e){if(e.target.closest('.room-edit-btn'))return;enterRoom(this.dataset.id)})});
  grid.querySelectorAll('.room-edit-btn').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();enterRoom(this.dataset.edit,true)})});
}
document.getElementById('createRoomBtn').onclick=async function(){
  if(!isAdminFlag)return;
  var name=prompt('请输入房间名称：');if(name===null)return;name=name.trim();
  if(!name){showToast('名称不能为空');return}
  try{var res=await window.sb.from('rooms').insert([{name:name,creator_id:currentUser.id,co_admin_ids:[],co_admin_permissions:{},muted_user_ids:[],mic_enabled:true,mic_mode:'free',mic_speaking:[],mic_requests:[],game_disabled:false}]).select().single();if(res.error)throw res.error;showToast('房间已创建');await loadRooms()}catch(e){showToast('创建失败：'+e.message)}
};

/* ============================================================
   进入 / 离开房间
============================================================ */
async function enterRoom(roomId,openSettings){
  try{
    var res=await window.sb.from('rooms').select('*').eq('id',roomId).single();
    if(res.error)throw res.error;
    state.room=res.data;state.messages=[];state.lastMsgId=null;state.spectating=false;
    document.getElementById('roomTitle').textContent=state.room.name;
    history.replaceState({},'','?id='+roomId);
    showDetail();
    updateHeaderBtns();
    renderMic();renderGame();
    await loadMessages();
    subscribe();
    initRoomMembers();
    startGameTick();
    if(openSettings&&isAdminFlag)setTimeout(openRoomEditor,300);
  }catch(e){showToast('进入房间失败：'+e.message)}
}
function leaveRoomLocal(){
  if(state.room&&currentUser){try{
    var sp=(state.room.mic_speaking||[]).filter(function(m){return m.user_id!==currentUser.id});
    var rq=(state.room.mic_requests||[]).filter(function(m){return m.user_id!==currentUser.id});
    window.sb.from('rooms').update({mic_speaking:sp,mic_requests:rq}).eq('id',state.room.id);
  }catch(e){}}
  if(state.roomChannel){window.sb.removeChannel(state.roomChannel);state.roomChannel=null}
  if(state.msgChannel){window.sb.removeChannel(state.msgChannel);state.msgChannel=null}
  if(state.memberChannel){window.sb.removeChannel(state.memberChannel);state.memberChannel=null}
  if(gameTickInterval){clearInterval(gameTickInterval);gameTickInterval=null}
  stopOfflineCheck();
  state.room=null;state.messages=[];state.spectating=false;
}
function updateHeaderBtns(){
  var setBtn=document.getElementById('roomSettingsBtn');
  if(setBtn)setBtn.style.display=isAdminFlag?'inline-flex':'none';
}
async function freshRoom(){var r=await window.sb.from('rooms').select('*').eq('id',state.room.id).single();if(r.error)throw r.error;return r.data}
async function patchRoom(patch){var res=await window.sb.from('rooms').update(patch).eq('id',state.room.id).select().single();if(res.error)throw res.error;state.room=res.data;document.getElementById('roomTitle').textContent=state.room.name;renderMic();renderGame();return state.room}

/* ============================================================
   房间成员（Presence）
============================================================ */
function initRoomMembers(){
  if(state.memberChannel){window.sb.removeChannel(state.memberChannel);state.memberChannel=null}
  if(!state.room)return;
  state.memberChannel=window.sb.channel('sq-room-members-'+state.room.id,{config:{presence:{key:currentUser.id}}});
  state.memberChannel.on('presence',{event:'sync'},function(){
    var raw=state.memberChannel.presenceState();
    var arr=[];
    Object.keys(raw).forEach(function(k){
      var list=raw[k];if(!list||!list.length)return;
      var p=list[0];
      arr.push({id:k,nickname:p.nickname||'用户',avatar_url:p.avatar_url||'',joined_at:p.joined_at||''});
    });
    arr.sort(function(a,b){return (a.joined_at||'').localeCompare(b.joined_at||'')});
    renderMemberList(arr);
    var cnt=document.getElementById('memberBtnCount');if(cnt)cnt.textContent=arr.length;
    var cnt2=document.getElementById('memberCount');if(cnt2)cnt2.textContent=arr.length;
    var onlineIds=arr.map(function(u){return u.id});
    cleanupOfflineGamePlayers(onlineIds);
  });
  state.memberChannel.subscribe(function(status){
    if(status==='SUBSCRIBED'){
      state.memberChannel.track({user_id:currentUser.id,nickname:currentUser.nickname,avatar_url:currentUser.avatar_url||'',joined_at:new Date().toISOString()});
    }
  });
}
/* 兜底：处理游戏中已掉线（不在 Presence 中）的玩家 */
async function cleanupOfflineGamePlayers(onlineIds){
  try{
    if(!state.room)return;
    var room=await freshRoom();
    state.room=room;
    var game=room.current_game;
    if(!game||!game.players||!game.players.length)return;
    var gdef=GAMES.find(function(x){return x.id===game.type})||{min:2,max:2};
    var hostOnline=game.players.some(function(p){return p.user_id===game.host_id&&onlineIds.indexOf(p.user_id)>=0});
    var offline=game.players.filter(function(p){return onlineIds.indexOf(p.user_id)<0}).map(function(p){return p.user_id});
    var oldOffline=(game.state&&game.state.offlineIds)||[];
    var offlineChanged=(offline.length!==oldOffline.length)||offline.some(function(u){return oldOffline.indexOf(u)<0;});
    // 游戏已结束：直接把离线者从玩家列表移除（结算页不保留已退的人）
    if(game.status==='finished'){
      if(offline.length===0)return;
      var keptPlayers=game.players.filter(function(p){return onlineIds.indexOf(p.user_id)>=0});
      if(keptPlayers.length===game.players.length)return;
      var ngF=Object.assign({},game,{players:keptPlayers});
      await window.sb.from("rooms").update({current_game:ngF}).eq("id",room.id);
      state.room.current_game=ngF;renderMic();renderGame();
      return;
    }
    if(!offlineChanged){ renderGpmPlayers(game.players||[],game); return; }
    // 五子棋（双人）：有人掉线 或 房主掉线 → 直接结束整局
    if(game.type==="gomoku"){
      if(offline.length>0||!hostOnline){
        await window.sb.from("rooms").update({current_game:null}).eq("id",room.id);
        state.room.current_game=null;renderMic();renderGame();
        if(offline.length>0)showToast("对手已离线，对局结束");else showToast("房主已离线，对局结束");
        return;
      }
      return;
    }
    // 房主掉线（多人游戏）→ 结束整局
    if(!hostOnline){
      await window.sb.from("rooms").update({current_game:null}).eq("id",room.id);
      state.room.current_game=null;renderMic();renderGame();showToast("房主已离线，对局结束");
      return;
    }
    var stNow=Object.assign({},game.state||{},{offlineIds:offline});
    // 谁是卧底 / 狼人杀：掉线 = 出局
    if(game.type==="spy"){
      var elim=(stNow.eliminated||[]).slice();
      offline.forEach(function(u){if(elim.indexOf(u)<0)elim.push(u);});
      stNow.eliminated=elim;
    }else if(game.type==="werewolf"){
      var al=(stNow.alive||[]).slice();
      offline.forEach(function(u){var i=al.indexOf(u);if(i>=0)al.splice(i,1);});
      stNow.alive=al;
    }else if(game.type==="draw"){
      // 你画我猜：当前画手掉线 → 跳到下一轮
      var curDrawer=(stNow.order||[])[stNow.drawer_index];
      if(offline.indexOf(curDrawer)>=0)stNow.round_end=true;
    }
    var ng=Object.assign({},game,{state:stNow});
    await window.sb.from("rooms").update({current_game:ng}).eq("id",room.id);
    state.room.current_game=ng;renderMic();renderGame();
  }catch(e){}
}
function renderMemberList(arr){
  var el=document.getElementById('memberList');if(!el)return;
  if(!arr.length){el.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:30px 20px;font-size:.85em;">暂无成员</div>';return}
  var game=state.room&&state.room.current_game;
  var gamePlayers=(game&&game.players||[]).map(function(p){return p.user_id});
  var hostId=game&&game.host_id;
  var micList=(state.room.mic_speaking||[]).map(function(m){return m.user_id});
  var mutedIds=(state.room.muted_user_ids||[]);
  var _coIds=(state.room.co_admin_ids||[]);
  var _myPerms=(state.room.co_admin_permissions||{})[currentUser.id]||{};
  var canMute=isAdminFlag||(_coIds.indexOf(currentUser.id)>=0&&_myPerms.mute!==false);
  el.innerHTML=arr.map(function(u){
    var has=u.avatar_url&&String(u.avatar_url).indexOf('http')===0;
    var roles=[];
    if(u.id===hostId)roles.push('<span class="role host"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:2px;"><path d="M2 18h20l-2-9-4 4-4-7-4 7-4-4z"/></svg>房主</span>');
    if(gamePlayers.indexOf(u.id)>=0)roles.push('<span class="role game"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:2px;"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>游戏中</span>');
    if(micList.indexOf(u.id)>=0)roles.push('<span class="role"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:2px;"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>麦上</span>');
    if(u.id===currentUser.id)roles.push('<span class="role">（我）</span>');
    var isMuted=mutedIds.indexOf(u.id)>=0;
    if(isMuted)roles.push('<span class="role" style="color:var(--danger);">已禁言</span>');
    var actBtn='';
    if(canMute&&u.id!==currentUser.id&&u.id!==(state.room.creator_id||'')){
      actBtn='<button class="member-mute-btn'+(isMuted?' on':'')+'" onclick="toggleMuteUser(\''+u.id+'\')">'+(isMuted?'解除禁言':'禁言')+'</button>';
    }
    return '<div class="member-row"><div class="avatar" style="'+(has?'background-image:url('+escapeHtml(u.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(has?'':escapeHtml(String(u.nickname).charAt(0).toUpperCase()))+'</div><div class="info"><div class="name">'+escapeHtml(u.nickname)+'</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px;">'+roles.join('')+'</div></div>'+actBtn+'<span class="online-dot"></span></div>';
  }).join('');
}
async function toggleMuteUser(uid){
  try{
    if(!isAdminFlag){
      var _co=(state.room.co_admin_ids||[]);var _p=(state.room.co_admin_permissions||{})[currentUser.id]||{};
      if(_co.indexOf(currentUser.id)<0||_p.mute===false){showToast('没有权限');return}
    }
    var room=await freshRoom();
    var muted=(room.muted_user_ids||[]).slice();
    var idx=muted.indexOf(uid);
    if(idx>=0)muted.splice(idx,1);else muted.push(uid);
    var patch={muted_user_ids:muted};
    if(idx<0){
      patch.mic_speaking=(room.mic_speaking||[]).filter(function(m){return m.user_id!==uid});
      patch.mic_requests=(room.mic_requests||[]).filter(function(m){return m.user_id!==uid});
    }
    await patchRoom(patch);
    showToast(idx>=0?'已解除禁言':'已禁言');
    if(state.memberChannel){
      var raw=state.memberChannel.presenceState();var arr2=[];
      Object.keys(raw).forEach(function(k){var l=raw[k];if(!l||!l.length)return;var pr=l[0];arr2.push({id:k,nickname:pr.nickname||'用户',avatar_url:pr.avatar_url||'',joined_at:pr.joined_at||''})});
      arr2.sort(function(a,b){return (a.joined_at||'').localeCompare(b.joined_at||'')});
      renderMemberList(arr2);
    }
  }catch(e){showToast('操作失败：'+e.message)}
}
window.toggleMuteUser=toggleMuteUser;
document.getElementById('memberBtn').onclick=function(){document.getElementById('memberBackdrop').classList.add('open');document.getElementById('memberDrawer').classList.add('open')};
document.getElementById('closeMemberDrawer').onclick=function(){document.getElementById('memberBackdrop').classList.remove('open');document.getElementById('memberDrawer').classList.remove('open')};
document.getElementById('memberBackdrop').onclick=function(){document.getElementById('memberBackdrop').classList.remove('open');document.getElementById('memberDrawer').classList.remove('open')};

/* ============================================================
   麦位
============================================================ */
function renderMic(){
  var el=document.getElementById('micArea');var r=state.room;if(!r){el.innerHTML='';return}
  if(r.current_game){el.innerHTML='';return}
  var speaking=r.mic_speaking||[],requests=r.mic_requests||[];
  var iAmOn=speaking.some(function(m){return m.user_id===currentUser.id});
  var iAmWaiting=requests.some(function(m){return m.user_id===currentUser.id});
  var coIds=r.co_admin_ids||[],permsMap=r.co_admin_permissions||{};
  var myPerms=permsMap[currentUser.id]||{};
  var canManage=isAdminFlag||(coIds.indexOf(currentUser.id)>=0&&myPerms.mic!==false);
  var h='<div class="mic-panel">';
  h+='<div class="mic-head"><span class="mic-title"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>麦位 '+speaking.length+'/4</span><span class="mic-mode">'+(r.mic_mode==='host'?'主持人连麦':'自由连麦')+'</span></div>';
  if(r.mic_enabled===false){h+='<div class="mic-off">本房间连麦已被管理员关闭</div>'}
  else{
    h+='<div class="mic-seats">';
    for(var i=0;i<4;i++){var m=speaking[i];h+='<div class="mic-seat'+(m?' on':'')+'">';
      if(m){var has=m.avatar_url&&String(m.avatar_url).indexOf('http')===0;h+='<div class="mic-avatar" style="'+(has?'background-image:url('+escapeHtml(m.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(has?'':escapeHtml(String(m.nickname||'U').charAt(0).toUpperCase()))+'</div>';h+='<div class="mic-name">'+escapeHtml(m.nickname||'')+'</div>';if(canManage||m.user_id===currentUser.id)h+='<button class="mic-x" onclick="removeFromMic(\''+m.user_id+'\')" title="下麦">✕</button>'}
      else{h+='<div class="mic-avatar empty">+</div><div class="mic-name">空位</div>'}
      h+='</div>'}
    h+='</div><div class="mic-actions">';
    if(iAmOn)h+='<button class="mic-btn leave" onclick="removeFromMic(\''+currentUser.id+'\')">下麦</button>';
    else if(iAmWaiting)h+='<button class="mic-btn waiting" onclick="cancelMic()">排队中 · 点击取消</button>';
    else h+='<button class="mic-btn join" onclick="requestMic()">'+(r.mic_mode==='host'?'申请连麦':'排队上麦')+'</button>';
    h+='</div>';
    if(requests.length){h+='<div class="mic-queue"><div class="mic-queue-title">排队中（'+requests.length+'）</div>';requests.forEach(function(q){h+='<div class="mic-queue-item"><span>'+escapeHtml(q.nickname||'')+'</span>';if(canManage)h+='<button onclick="approveMic(\''+q.user_id+'\')">同意</button><button onclick="rejectMic(\''+q.user_id+'\')">拒绝</button>';h+='</div>'});h+='</div>'}
  }
  h+='</div>';el.innerHTML=h;
}
async function requestMic(){if(isUserBanned()){showToast('账号已被封禁');return}try{var r=await freshRoom();var speaking=r.mic_speaking||[],requests=r.mic_requests||[];if(requests.some(function(x){return x.user_id===currentUser.id}))return;if(speaking.some(function(x){return x.user_id===currentUser.id}))return;var me={user_id:currentUser.id,nickname:currentUser.nickname,avatar_url:currentUser.avatar_url||''};if(r.mic_mode!=='host'&&speaking.length<4){speaking.push(me);await patchRoom({mic_speaking:speaking});showToast('已上麦')}else{requests.push(me);await patchRoom({mic_requests:requests});showToast(r.mic_mode==='host'?'已申请，等待管理员同意':'已加入排队')}}catch(e){showToast('操作失败：'+e.message)}}
async function cancelMic(){try{var r=await freshRoom();var requests=(r.mic_requests||[]).filter(function(x){return x.user_id!==currentUser.id});await patchRoom({mic_requests:requests});showToast('已取消排队')}catch(e){showToast(e.message)}}
async function removeFromMic(userId){try{var r=await freshRoom();var speaking=(r.mic_speaking||[]).filter(function(m){return m.user_id!==userId});var requests=r.mic_requests||[];if(r.mic_mode!=='host'&&requests.length&&speaking.length<4)speaking.push(requests.shift());await patchRoom({mic_speaking:speaking,mic_requests:requests});if(userId===currentUser.id)showToast('已下麦')}catch(e){showToast(e.message)}}
async function approveMic(userId){try{var r=await freshRoom();var requests=r.mic_requests||[];var idx=-1;for(var i=0;i<requests.length;i++){if(requests[i].user_id===userId){idx=i;break}}if(idx<0)return;var m=requests.splice(idx,1)[0];var speaking=r.mic_speaking||[];if(speaking.length>=4){showToast('麦位已满');return}speaking.push(m);await patchRoom({mic_speaking:speaking,mic_requests:requests});showToast('已同意连麦')}catch(e){showToast(e.message)}}
async function rejectMic(userId){try{var r=await freshRoom();var requests=(r.mic_requests||[]).filter(function(x){return x.user_id!==userId});await patchRoom({mic_requests:requests});showToast('已拒绝')}catch(e){showToast(e.message)}}
window.requestMic=requestMic;window.cancelMic=cancelMic;window.removeFromMic=removeFromMic;window.approveMic=approveMic;window.rejectMic=rejectMic;

/* ============================================================
   游戏系统
============================================================ */
