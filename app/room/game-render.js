/* ============================================================================
 *  room/game-render.js —— 
 *  由 room.html 内联脚本逐行拆出，零改动。加载顺序见 room.html 的 script 串。
 * ============================================================================ */
/* ============================================================
   游戏渲染
============================================================ */
function renderGame(){
  var r=state.room;var stage=document.getElementById('gameStage');var body=document.getElementById('roomBody');
  var sbar=document.getElementById('spectatorBar');
  if(!r||!r.current_game){stage.classList.remove('active');body.removeAttribute('data-theme');if(sbar)sbar.style.display='none';return}
  var game=r.current_game;body.setAttribute('data-theme',game.type);
  var g=GAMES.find(function(x){return x.id===game.type});
  if(!g)return;
  var players=game.players||[];
  var inGame=players.some(function(p){return p.user_id===currentUser.id});

  if(r.game_disabled){
    stage.classList.add('active');
    if(sbar)sbar.style.display='none';
    document.getElementById('gpmPlayers').innerHTML='';
    document.getElementById('gameContent').innerHTML='<div class="game-lobby"><div class="lobby-icon" style="color:var(--danger);"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div><div class="lobby-title">游戏已被管理员禁止</div></div>';
    return;
  }

  stage.classList.add('active');
  renderGpmPlayers(players,game);

  if(state.spectating&&!inGame){
    if(sbar)sbar.style.display='flex';
    var joinBtn=document.getElementById('joinFromSpectateBtn');
    if(joinBtn){
      if(players.length<g.max){joinBtn.disabled=false;joinBtn.textContent='加入游戏（'+players.length+'/'+g.max+'）';joinBtn.onclick=function(){stopSpectating();joinGame()}}
      else{joinBtn.disabled=true;joinBtn.textContent='人数已满'}
    }
    var exitBtn=document.getElementById('exitSpectateBtn');if(exitBtn)exitBtn.onclick=stopSpectating;
  }else{if(sbar)sbar.style.display='none'}

  renderGameContent(game,inGame);
}

function renderGpmPlayers(players,game){
  var el=document.getElementById('gpmPlayers');
  var currentTurnId=null;
  if(game.type==='gomoku'&&game.status==='playing'){
    var bId=players[0]?players[0].user_id:null,wId=players[1]?players[1].user_id:null;
    currentTurnId=game.state.turn==='black'?bId:wId;
  }
  if(game.type==='draw'&&game.status==='playing')currentTurnId=(game.state.order||[])[game.state.drawer_index];
  if(game.type==='doudizhu'&&game.status==='playing')currentTurnId=game.state.currentTurn;
  el.innerHTML=players.map(function(p){
    var has=p.avatar_url&&String(p.avatar_url).indexOf('http')===0;
    var isHost=p.user_id===game.host_id;
    var isOff=game.state&&game.state.offlineIds&&game.state.offlineIds.indexOf(p.user_id)>=0;
    return '<div class="gpm-player'+(currentTurnId===p.user_id?' gpm-turn':'')+(isOff?' gpm-offline':'')+'"><div class="gpm-avatar" style="'+(has?'background-image:url('+escapeHtml(p.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(has?'':escapeHtml(String(p.nickname||'U').charAt(0).toUpperCase()))+'</div><div class="gpm-name">'+escapeHtml(p.nickname||'')+(isHost?' <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#f0b429" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M2 18h20l-2-9-4 4-4-7-4 7-4-4z"/></svg>':'')+'</div></div>';
  }).join('');
}

function renderGameContent(game,inGame){
  var el=document.getElementById('gameContent');
  var g=GAMES.find(function(x){return x.id===game.type});
  var players=game.players||[];

  if(game.status==='lobby'){
    if(!inGame&&!state.spectating){
      var html='<div class="game-lobby"><div class="lobby-icon">'+g.icon+'</div><div class="lobby-title">'+g.name+'</div><div class="lobby-desc">'+g.desc+' · 需要 '+g.min+'-'+g.max+' 人，当前 '+players.length+' 人</div>';
      if(players.length){
        html+='<div class="lobby-players">'+players.map(function(p){
          var has=p.avatar_url&&String(p.avatar_url).indexOf('http')===0;
          var isHost=p.user_id===game.host_id;
          return '<div class="lobby-player'+(isHost?' host':'')+'"><div class="gpm-avatar" style="'+(has?'background-image:url('+escapeHtml(p.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(has?'':escapeHtml(String(p.nickname).charAt(0).toUpperCase()))+'</div>'+escapeHtml(p.nickname)+(isHost?' <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#f0b429" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M2 18h20l-2-9-4 4-4-7-4 7-4-4z"/></svg>':'')+'</div>';
        }).join('')+'</div>';
      }
      html+='<div class="lobby-count">'+players.length+' / '+g.max+' 人</div>';
      html+='<div class="lobby-actions">';
      if(players.length<g.max)html+='<button class="lobby-btn join" onclick="joinGame()">加入游戏</button>';
      else html+='<button class="lobby-btn join" disabled>人数已满</button>';
      html+='<button class="lobby-btn spectate" onclick="startSpectating()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>只观战</button>';
      html+='</div>';
      if(game.host_id===currentUser.id)html+='<div class="lobby-hint" style="color:var(--primary);font-weight:700;">你是房主</div>';
      else html+='<div class="lobby-hint">房主是 '+escapeHtml((players.find(function(p){return p.user_id===game.host_id})||{}).nickname||'')+'</div>';
      html+='</div>';
      el.innerHTML=html;return;
    }
    var canStart=players.length>=g.min;
    var isHost=game.host_id===currentUser.id;
    var h2='<div class="game-lobby"><div class="lobby-icon">'+g.icon+'</div><div class="lobby-title">'+g.name+'</div>';
    h2+='<div class="lobby-players">'+players.map(function(p){
      var has=p.avatar_url&&String(p.avatar_url).indexOf('http')===0;
      var isH=p.user_id===game.host_id;
      return '<div class="lobby-player'+(isH?' host':'')+'"><div class="gpm-avatar" style="'+(has?'background-image:url('+escapeHtml(p.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(has?'':escapeHtml(String(p.nickname).charAt(0).toUpperCase()))+'</div>'+escapeHtml(p.nickname)+(isH?' <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#f0b429" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M2 18h20l-2-9-4 4-4-7-4 7-4-4z"/></svg>':'')+'</div>';
    }).join('')+'</div>';
    h2+='<div class="lobby-count">'+players.length+' / '+g.max+' 人（至少 '+g.min+' 人）</div>';
    if(isHost){
      h2+='<div class="lobby-actions">';
      if(canStart)h2+='<button class="lobby-btn start" onclick="beginGame()">开始游戏</button>';
      else h2+='<button class="lobby-btn start" disabled>人数不足（'+players.length+'/'+g.min+'）</button>';
      h2+='</div>';
      h2+='<div class="lobby-hint" style="color:var(--primary);font-weight:700;">你是房主，人齐后点开始</div>';
    }else{
      h2+='<div class="lobby-hint">等待房主开始游戏…（'+players.length+'/'+g.min+'）</div>';
    }
    h2+='</div>';
    el.innerHTML=h2;return;
  }

  if(state.spectating&&game.status==='lobby'){
    var h3='<div class="game-lobby"><div class="lobby-icon">'+g.icon+'</div><div class="lobby-title">'+g.name+'</div><div class="lobby-desc">等待房主开始（'+players.length+'/'+g.min+'）</div>';
    h3+='<div class="lobby-players">'+players.map(function(p){
      var has=p.avatar_url&&String(p.avatar_url).indexOf('http')===0;
      return '<div class="lobby-player"><div class="gpm-avatar" style="'+(has?'background-image:url('+escapeHtml(p.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(has?'':escapeHtml(String(p.nickname).charAt(0).toUpperCase()))+'</div>'+escapeHtml(p.nickname)+'</div>';
    }).join('')+'</div></div>';
    el.innerHTML=h3;return;
  }

  if(game.status==='playing'||game.status==='finished'){
    if(game.type==='gomoku')renderGomoku(game,el);
    else if(game.type==='draw')renderDraw(game,el);
    else if(game.type==='spy')renderSpy(game,el);
    else if(game.type==='werewolf')renderWerewolf(game,el);
    else if(game.type==='doudizhu')renderDoudizhu(game,el);
    else el.innerHTML='<div style="text-align:center;padding:20px;opacity:.5;">加载中…</div>';
  }
}

/* ============================================================
   全屏
============================================================ */
document.getElementById("fsBtn").onclick=function(){
  var el=document.getElementById("gameStage");
  // iOS 等不支持全屏 API 时，用伪全屏（固定定位铺满）
  var canReal=!!(el.requestFullscreen||el.webkitRequestFullscreen);
  if(!canReal){
    document.body.classList.toggle("pseudo-fs");
    updateFsIcon(document.body.classList.contains("pseudo-fs"));
    return;
  }
  if(!document.fullscreenElement){
    if(el.requestFullscreen)el.requestFullscreen().catch(function(){});
    else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();
  }else{
    if(document.exitFullscreen)document.exitFullscreen();
    else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
  }
};
function updateFsIcon(on){
  var icon=document.getElementById("fsIcon");if(!icon)return;
  if(on)icon.innerHTML='<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>';
  else icon.innerHTML='<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>';
}
document.addEventListener("fullscreenchange",function(){
  updateFsIcon(!!document.fullscreenElement);
});
function pushDanmaku(user,text){
  if(!document.fullscreenElement)return;
  var layer=document.getElementById('danmakuLayer');if(!layer)return;
  var el=document.createElement('div');el.className='danmaku-item';el.textContent=user+'：'+String(text||'').substring(0,60);
  el.style.top=(8+Math.random()*70)+'%';el.style.animationDuration=(7+Math.random()*3)+'s';
  layer.appendChild(el);setTimeout(function(){el.remove()},12000);
}

