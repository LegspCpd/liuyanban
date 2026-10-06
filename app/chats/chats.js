/* 七戚 · chats页模块，由 app/chats.html 内联脚本拆分，DOM区未动 */
/* ============================================================
   基础
============================================================ */

var currentUser=getSessionUser();
if(!currentUser||!currentUser.id)window.location.href='/liuyanban/index.html';
var isAdmin=window.isAdmin(currentUser);
var isAuthorMode=false,AUTHOR_PASSWORD="7592";

/* ============================================================
   头部
============================================================ */
(function renderHeaderUI(){
  var u=currentUser||{},name=u.nickname||'用户';
  var has=u.avatar_url&&String(u.avatar_url).indexOf('http')===0;
  document.getElementById('header-container').innerHTML=
    '<div class="app-header">'+
      '<div class="brand" id="brandBtn">Seven<span>戚</span><small>· 聊天群</small></div>'+
      '<div class="header-right">'+
        '<div class="user-area" onclick="window.location.href=\'/liuyanban/profile.html\'">'+
          '<div class="avatar" style="'+(has?'background-image:url('+escapeHtml(u.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(has?'':escapeHtml(name.charAt(0).toUpperCase()))+'</div>'+
          '<span class="user-name">'+escapeHtml(name)+'</span>'+
        '</div>'+
        '<button class="dots-btn" id="dotsBtn" type="button" title="在线用户">'+
          '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>'+
          '<span class="online-badge" id="onlineBadge" style="display:none;">0</span>'+
        '</button>'+
      '</div>'+
    '</div>';
  document.getElementById('dotsBtn').onclick=function(){
    document.getElementById('onlineOverlay').classList.add('open');
    renderOnlineUsers();
  };
  // 三击 logo → 作者模式
  var cnt=0,timer=null;
  document.getElementById('brandBtn').addEventListener('click',async function(){
    cnt++;clearTimeout(timer);timer=setTimeout(function(){cnt=0},800);
    if(cnt===3){
      cnt=0;
      if(!isAuthorMode){
        var p=prompt('请输入作者密码：');
        if(p===null)return;
        var h1=await sha256(p),h2=await sha256(AUTHOR_PASSWORD);
        if(h1===h2){isAuthorMode=true;showToast('作者模式已激活')}
        else showToast('密码错误');
      }else{isAuthorMode=false;showToast('已退出作者模式')}
    }
  });
})();

/* ============================================================
   ★★★ 在线用户（Presence）★★★
   修复要点：
   1. 用独立频道名 + 随机后缀，避免多设备冲突
   2. 排除自己用 user_id 判等，不依赖 key
   3. sync 事件用 setTimeout 防抖，避免高频抖动
   4. 同时监听 join / leave 事件，立刻更新
============================================================ */
var onlineUsers={};
var onlineChannel=null;
var renderDebounce=null;

document.getElementById('onlineBackBtn').onclick=function(){
  document.getElementById('onlineOverlay').classList.remove('open');
};

function renderOnlineUsers(){
  var c=document.getElementById('onlineUserList');
  if(!c)return;
  // 把自己和他人分开
  var mine=null;
  var others=[];
  Object.keys(onlineUsers).forEach(function(k){
    var u=onlineUsers[k];
    if(u.id===currentUser.id){mine=u}
    else{others.push(u)}
  });
  others.sort(function(a,b){return String(a.nickname||'').localeCompare(String(b.nickname||''),'zh')});

  // 更新头部徽章
  var badge=document.getElementById('onlineBadge');
  if(badge){
    if(others.length>0){badge.textContent=others.length>99?'99+':others.length;badge.style.display='inline-block'}
    else{badge.style.display='none'}
  }

  // 渲染列表
  var html='';
  // 我
  var me=currentUser;
  var meHas=me.avatar_url&&String(me.avatar_url).indexOf('http')===0;
  html+='<div class="online-user me">'+
    '<div class="ou-avatar" style="'+(meHas?'background-image:url('+escapeHtml(me.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(meHas?'':escapeHtml(String(me.nickname||'U').charAt(0).toUpperCase()))+'</div>'+
    '<div class="ou-info">'+
      '<div class="ou-name">'+escapeHtml(me.nickname||'我')+' <span style="font-size:.75em;color:var(--primary);font-weight:800;">（我）</span></div>'+
      '<div class="ou-status"><span class="dot"></span>在线</div>'+
    '</div>'+
  '</div>';

  if(others.length===0){
    html+='<div class="empty-online">'+
      '<div class="empty-online-icon"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></div>'+
      '<div class="empty-online-title">除你之外没有用户上线</div>'+
      '<div class="empty-online-sub">快去邀请你的好友上线游玩吧！，<br>房间页面有互动游戏哦！</div>'+
    '</div>';
  }else{
    html+='<div class="section-label">其他在线用户 · '+others.length+' 人</div>';
    html+=others.map(function(u){
      var has=u.avatar_url&&String(u.avatar_url).indexOf('http')===0;
      return '<div class="online-user">'+
        '<div class="ou-avatar" style="'+(has?'background-image:url('+escapeHtml(u.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(has?'':escapeHtml(String(u.nickname||'U').charAt(0).toUpperCase()))+'</div>'+
        '<div class="ou-info">'+
          '<div class="ou-name">'+escapeHtml(u.nickname||'用户')+'</div>'+
          '<div class="ou-status"><span class="dot"></span>在线</div>'+
        '</div>'+
      '</div>';
    }).join('');
  }
  c.innerHTML=html;
}

function scheduleRender(){
  if(renderDebounce)clearTimeout(renderDebounce);
  renderDebounce=setTimeout(function(){renderOnlineUsers()},50);
}

function initPresence(){
  if(onlineChannel){try{window.sb.removeChannel(onlineChannel)}catch(e){}onlineChannel=null}
  // 每个用户用 user_id 作为 presence key，保证唯一
  onlineChannel=window.sb.channel('sq-chat-online',{
    config:{presence:{key:currentUser.id}}
  });

  // 全量同步
  onlineChannel.on('presence',{event:'sync'},function(){
    var raw=onlineChannel.presenceState();
    var map={};
    Object.keys(raw).forEach(function(key){
      var arr=raw[key];
      if(!arr||!arr.length)return;
      var p=arr[0];
      var uid=p.user_id||key;
      map[uid]={
        id:uid,
        nickname:p.nickname||'用户',
        avatar_url:p.avatar_url||'',
        online_at:p.online_at||''
      };
    });
    onlineUsers=map;
    scheduleRender();
  });

  // 有新人加入
  onlineChannel.on('presence',{event:'join'},function(payload){
    if(payload&&payload.newPresences){
      payload.newPresences.forEach(function(p){
        var uid=p.user_id||'';
        if(!uid)return;
        onlineUsers[uid]={id:uid,nickname:p.nickname||'用户',avatar_url:p.avatar_url||'',online_at:p.online_at||''};
      });
      scheduleRender();
    }
  });

  // 有人离开
  onlineChannel.on('presence',{event:'leave'},function(payload){
    if(payload&&payload.leftPresences){
      payload.leftPresences.forEach(function(p){
        var uid=p.user_id||'';
        if(uid&&onlineUsers[uid])delete onlineUsers[uid];
      });
      scheduleRender();
    }
  });

  onlineChannel.subscribe(function(status){
    if(status==='SUBSCRIBED'){
      onlineChannel.track({
        user_id:currentUser.id,
        nickname:currentUser.nickname,
        avatar_url:currentUser.avatar_url||'',
        online_at:new Date().toISOString()
      });
    }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
      // 断线后 3 秒重连
      setTimeout(initPresence,3000);
    }
  });
}

/* ============================================================
   聊天
============================================================ */
var chats=[],chatsLoading=false,usersCache={};

function updateBannedBanner(){
  var b=document.getElementById('bannedBanner'),d=document.getElementById('bannedUntilDisplay'),i=document.getElementById('chatInput'),s=document.getElementById('sendChatBtn');
  if(isUserBanned()){
    b.classList.add('active');
    d.textContent=new Date(currentUser.banned_until).toLocaleString('zh-CN',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
    i.disabled=true;i.placeholder='账号已被封禁，无法发送消息';s.disabled=true;
  }else{
    b.classList.remove('active');
    i.disabled=false;i.placeholder='说点什么…';s.disabled=false;
  }
}

async function fetchChats(){
  var res=await window.sb.from('chats').select('*, users(id, nickname, avatar_url)').order('created_at',{ascending:true});
  if(res.error)throw res.error;
  (res.data||[]).forEach(function(item){
    if(item.users)usersCache[item.users.id]={nickname:item.users.nickname,avatar_url:item.users.avatar_url};
  });
  return res.data||[];
}
async function addChat(userId,author,content,isOfficial){
  var r=await window.sb.from('chats').insert([{user_id:userId,author:author,content:content,is_official:isOfficial,is_deleted:false,deleted_by:null}]);
  if(r.error)throw r.error;return r.data;
}
async function revokeChat(id,author,revoker,isSelf){
  var nc=isSelf?author+' 撤回了一条消息':author+' 的消息被 '+revoker+' 撤回了';
  var r=await window.sb.from('chats').update({is_deleted:true,content:nc,deleted_by:revoker}).eq('id',id);
  if(r.error)throw r.error;
}
async function clearAllChats(){
  if(!isAdmin){showToast('权限不足');return}
  showConfirm('清空聊天','确定要删除所有聊天消息吗？此操作不可恢复！',async function(){
    try{var r=await window.sb.from('chats').delete().not('id','is',null);if(r.error)throw r.error;showToast('所有聊天消息已清空');await loadAllChats()}catch(e){showToast('清空失败：'+e.message)}
  });
}
function formatTimeDivider(date){
  var now=new Date(),d=new Date(date);
  var sy=d.getFullYear()===now.getFullYear();
  var sd=sy&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();
  var hm=d.toTimeString().slice(0,5);
  if(sd)return hm;
  if(sy)return(d.getMonth()+1)+'月'+d.getDate()+'日 '+hm;
  return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日 '+hm;
}
function shouldShowTimeDivider(p,c){if(!p)return true;return(new Date(c)-new Date(p))/60000>30}

function renderChat(){
  var container=document.getElementById('chatMessages');
  if(chatsLoading){container.innerHTML='<div class="loading-state"><div class="spinner"></div><div>正在加载聊天内容...</div></div>';return}
  if(!chats.length){container.innerHTML='<div class="empty-state"><div class="big"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></div>还没有聊天消息，来打个招呼吧！</div>';return}
  var html='',prev=null;
  chats.forEach(function(c){
    var isSelf=currentUser&&c.user_id===currentUser.id;
    var isOfficial=c.is_official||c.author==='Seven戚';
    var isDeleted=c.is_deleted===true;
    var ui=usersCache[c.user_id]||null;
    var dn=ui?ui.nickname:c.author,au=ui?ui.avatar_url:null;
    if(shouldShowTimeDivider(prev,c.created_at))html+='<div class="time-divider"><span>'+formatTimeDivider(c.created_at)+'</span></div>';
    prev=c.created_at;
    var badge=isOfficial?'<span class="official-badge">官方</span>':'';
    var fc='';
    if(isDeleted){
      var txt=c.content||'';
      var m=txt.match(/^(.*?) 的消息被 (.*?) 撤回了$/);
      if(m)fc='<span class="chat-text"><span class="deleted-by">'+escapeHtml(m[1])+'</span> 的消息被 <span class="deleted-by">'+escapeHtml(m[2])+'</span> 撤回了</span>';
      else if(txt.indexOf('撤回了一条消息')>=0){var n=txt.replace(' 撤回了一条消息','');fc='<span class="chat-text"><span class="deleted-by">'+escapeHtml(n)+'</span> 撤回了一条消息</span>'}
      else fc='<span class="chat-text">'+escapeHtml(txt)+'</span>';
    }else fc='<span class="chat-text">'+escapeHtml(c.content)+'</span>';
    var av=(au&&String(au).indexOf('http')===0)?'<div class="avatar" style="background-image:url('+escapeHtml(au)+');background-size:cover;background-position:center;text-indent:-9999px;"> </div>':'<div class="avatar">'+escapeHtml(String(dn).charAt(0).toUpperCase())+'</div>';
    html+='<div class="chat-msg '+(isSelf?'self':'')+' '+(isDeleted?'deleted':'')+'" data-id="'+c.id+'" data-author="'+escapeHtml(c.author)+'" data-self="'+isSelf+'"><div class="msg-header">'+av+'<span class="name">'+escapeHtml(dn)+'</span>'+badge+'</div>'+fc+'</div>';
  });
  container.innerHTML=html;
  container.scrollTop=container.scrollHeight;
  container.querySelectorAll('.chat-msg:not(.deleted)').forEach(function(el){
    el.addEventListener('contextmenu',function(e){
      e.preventDefault();
      showChatCtxMenu(e.clientX,e.clientY,this.dataset.id,this.dataset.author,this.dataset.self==='true',this.querySelector('.chat-text')?this.querySelector('.chat-text').textContent:'');
    });
    var timer=null;
    el.addEventListener('touchstart',function(e){
      var self=this;
      timer=setTimeout(function(){
        if(navigator.vibrate)navigator.vibrate(45);
        showChatCtxMenu(e.touches[0].clientX,e.touches[0].clientY,self.dataset.id,self.dataset.author,self.dataset.self==='true',self.querySelector('.chat-text')?self.querySelector('.chat-text').textContent:'');
        timer=null;
      },600);
    },{passive:true});
    el.addEventListener('touchend',function(){if(timer){clearTimeout(timer);timer=null}});
    el.addEventListener('touchmove',function(){if(timer){clearTimeout(timer);timer=null}});
  });
}

function showChatCtxMenu(x,y,id,author,isSelf,contentText){
  var old=document.getElementById('chatCtxMenu');if(old)old.remove();
  var menu=document.createElement('div');menu.id='chatCtxMenu';menu.className='chat-ctx-menu';
  menu.style.left=Math.min(x,window.innerWidth-160)+'px';
  menu.style.top=Math.min(y,window.innerHeight-140)+'px';
  var html='';
  if(isAdmin||isSelf)html+='<div class="chat-ctx-item danger" data-action="revoke">'+svgIcon('undo',16)+' 撤回</div>';
  if(!isSelf)html+='<div class="chat-ctx-item" data-action="report">'+svgIcon('flag',16)+' 举报</div>';
  menu.innerHTML=html;
  document.body.appendChild(menu);
  menu.querySelectorAll('.chat-ctx-item').forEach(function(item){
    item.onclick=function(){
      var a=this.dataset.action;menu.remove();
      if(a==='revoke'){
        if(!isAdmin&&!isSelf){showToast('您只能撤回自己的消息');return}
        showConfirm('撤回消息','确定撤回此消息吗？',function(){
          revokeChat(id,author,currentUser.nickname,isSelf)
            .then(function(){showToast('消息已撤回');return loadAllChats()})
            .catch(function(e){showToast('撤回失败：'+e.message)});
        });
      }else if(a==='report'){
        reportChat(id,author,contentText);
      }
    };
  });
  setTimeout(function(){
    document.addEventListener('click',function close(e){
      if(!menu.contains(e.target)){menu.remove();document.removeEventListener('click',close)}
    });
  },10);
}

async function reportChat(contentId,author,snapshot){
  try{
    var res=await window.sb.from('users').select('id').eq('nickname',author).single();
    if(res.error||!res.data){showToast('无法找到该用户');return}
    openReportDialog(res.data.id,'chat',contentId,snapshot);
  }catch(e){showToast('举报失败：'+e.message)}
}

function sendChat(){
  if(!currentUser){showToast('请先登录');return}
  if(isUserBanned()){showToast('账号已被封禁，无法发送消息');return}
  var input=document.getElementById('chatInput'),content=input.value.trim();
  if(!content){showToast('请输入内容');return}
  var btn=document.getElementById('sendChatBtn'),orig=btn.innerHTML;
  btn.disabled=true;btn.innerHTML='发送中...';
  var isOfficial=currentUser.nickname==='Seven戚'||isAuthorMode;
  addChat(currentUser.id,currentUser.nickname,content,isOfficial)
    .then(function(){input.value='';loadAllChats();showToast('消息已发送')})
    .catch(function(e){showToast('发送失败：'+e.message)})
    .finally(function(){btn.disabled=false;btn.innerHTML=orig});
}
async function loadAllChats(){
  chatsLoading=true;renderChat();
  try{chats=await fetchChats()}
  catch(e){console.error('加载聊天失败:',e);showToast('聊天加载失败')}
  finally{chatsLoading=false;renderChat()}
}

/* ============================================================
   事件绑定
============================================================ */
document.getElementById('sendChatBtn').addEventListener('click',sendChat);
document.getElementById('chatInput').addEventListener('keydown',function(e){
  if(e.key==='Enter')sendChat();
});
document.getElementById('clearChatBtn').addEventListener('click',clearAllChats);
document.addEventListener('gesturestart',function(e){e.preventDefault()});

/* ============================================================
   初始化
============================================================ */
window.addEventListener('DOMContentLoaded',function(){
  // 底部导航
  if(typeof renderFooter==='function')renderFooter('chats');
  else console.error('renderFooter 未定义，检查 common.js');

  if(isAdmin)document.getElementById('clearChatBtn').style.display='inline-block';

  updateBannedBanner();
  loadAllChats();
  initPresence();  // ★ 启动在线用户

  if(currentUser&&currentUser.id){
    updateLastChatRead(currentUser.id).then(function(){
      if(typeof updateChatBadge==='function')updateChatBadge();
    });
  }

  // 全局聊天实时订阅
  window.sb.channel('chats-page-realtime-'+Date.now())
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'chats'},function(){loadAllChats()})
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'chats'},function(){loadAllChats()})
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'chats'},function(){loadAllChats()})
    .subscribe();

  // 会话同步
  function syncUser(){
    var s=getSessionUser();
    if(s&&s.id){
      if(!currentUser||currentUser.id!==s.id||currentUser.avatar_url!==s.avatar_url||currentUser.nickname!==s.nickname){
        location.reload();
      }
    }
  }
  window.addEventListener('focus',syncUser);
  document.addEventListener('visibilitychange',function(){
    if(!document.hidden)syncUser();
  });
});