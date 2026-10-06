/* ============================================================================
 *  room/game-werewolf.js —— 
 *  由 room.html 内联脚本逐行拆出，零改动。加载顺序见 room.html 的 script 串。
 * ============================================================================ */
/* ============================================================
   狼人杀（含再来一轮）
============================================================ */
function renderWerewolf(game,el){
  var st=game.state||{},players=game.players||[];
  var hostId=game.host_id;
  if(game.status==='finished'){
    var winner=st.winner||'';
    var h='<div class="ww-wrap"><div class="ww-role-card"><div class="ww-role-word">'+escapeHtml(winner)+' 获胜</div></div>';
    if(game.host_id===currentUser.id)h+='<button class="lobby-btn start" style="margin-top:16px;background:#ff5252;color:#fff;" onclick="restartGame()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>再来一轮</button>';
    else h+='<div style="font-size:.75em;opacity:.7;margin-top:14px;">等待房主重开…</div>';
    h+='</div>';
    el.innerHTML=h;return;
  }
  if(st.phase==='choose'){
    if(currentUser.id!==hostId){el.innerHTML='<div class="ww-wrap"><div class="ww-phase">等待房主选择游戏局数…</div></div>';return}
    var html='<div class="ww-wrap"><div class="ww-phase">你是房主，请选择游戏局数</div><div class="lobby-actions" style="margin-top:14px;">';
    html+='<button class="lobby-btn join" onclick="startWerewolf(6)">6人局</button>';
    if(players.length>=10)html+='<button class="lobby-btn start" onclick="startWerewolf(10)">10人局</button>';
    else html+='<button class="lobby-btn join" disabled>10人局（人数不足）</button>';
    html+='</div></div>';el.innerHTML=html;return;
  }
  var myRole=st.roles[currentUser.id]||'?';var alive=st.alive||[];
  var html='<div class="ww-wrap">';
  html+='<div class="ww-role-card"><div class="ww-role-label">你的身份</div><div class="ww-role-word">'+escapeHtml(myRole)+'</div><div class="ww-desc">第 '+st.day+' 天 · '+(st.phase==='night'?'夜晚':'白天')+'</div></div>';
  html+='<div class="ww-players">';
  players.forEach(function(p){
    var dead=alive.indexOf(p.user_id)<0;var has=p.avatar_url&&String(p.avatar_url).indexOf('http')===0;
    var actionBtn='';
    if(st.phase==='night'&&myRole==='狼人'&&!dead&&p.user_id!==currentUser.id)actionBtn='<button class="btn" onclick="nightKill(\''+p.user_id+'\')">击杀</button>';
    if(st.phase==='day'&&!dead&&p.user_id!==currentUser.id)actionBtn='<button class="btn" onclick="dayVote(\''+p.user_id+'\')">投票</button>';
    html+='<div class="ww-player'+(dead?' dead':'')+'"><div class="gpm-avatar" style="'+(has?'background-image:url('+escapeHtml(p.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(has?'':escapeHtml(String(p.nickname).charAt(0).toUpperCase()))+'</div><div class="name">'+escapeHtml(p.nickname)+'</div>'+actionBtn+'</div>';
  });
  html+='</div>';
  if(st.phase==='day')html+='<div style="text-align:center;margin-top:10px;"><button class="lobby-btn join" onclick="advanceWerewolfPhase()">天亮了，下一夜</button></div>';
  html+='</div>';el.innerHTML=html;
}
async function startWerewolf(mode){
  if(!state.room||!state.room.current_game)return;var game=state.room.current_game;
  if(game.host_id!==currentUser.id){showToast('只有房主能开始');return}
  var players=game.players||[];
  if(mode===6&&players.length<6){showToast('需要至少6人');return}
  if(mode===10&&players.length<10){showToast('需要至少10人');return}
  var roles={};var shuffled=players.slice().sort(function(){return Math.random()-.5});
  if(mode===6){shuffled.forEach(function(p,i){if(i<2)roles[p.user_id]='狼人';else if(i===2)roles[p.user_id]='预言家';else if(i===3)roles[p.user_id]='女巫';else roles[p.user_id]='平民'})}
  else{shuffled.forEach(function(p,i){if(i<3)roles[p.user_id]='狼人';else if(i===3)roles[p.user_id]='预言家';else if(i===4)roles[p.user_id]='女巫';else if(i===5)roles[p.user_id]='猎人';else roles[p.user_id]='平民'})}
  var ns=Object.assign({},game.state,{roles:roles,phase:'night',alive:players.map(function(p){return p.user_id}),night_action:null,votes:{},day:1,mode:mode});
  await updateGame(Object.assign({},game,{state:ns}));showToast('游戏开始');
}
window.startWerewolf=startWerewolf;
async function nightKill(targetId){if(!state.room||!state.room.current_game)return;var game=state.room.current_game;if(game.state.roles[currentUser.id]!=='狼人'){showToast('你无法操作');return}await updateGame(Object.assign({},game,{state:Object.assign({},game.state,{night_action:targetId})}))}
window.nightKill=nightKill;
async function dayVote(targetId){if(!state.room||!state.room.current_game)return;var game=state.room.current_game;var votes=Object.assign({},game.state.votes||{});votes[currentUser.id]=targetId;await updateGame(Object.assign({},game,{state:Object.assign({},game.state,{votes:votes})}))}
window.dayVote=dayVote;
async function advanceWerewolfPhase(){
  if(!state.room||!state.room.current_game)return;var game=state.room.current_game;
  var st=game.state;
  if(st.phase==='night'){
    var alive=(st.alive||[]).slice();var killed=st.night_action;
    if(killed)alive=alive.filter(function(id){return id!==killed});
    var wolves=alive.filter(function(id){return st.roles[id]==='狼人'});
    var others=alive.filter(function(id){return st.roles[id]!=='狼人'});
    if(!wolves.length){await updateGame(Object.assign({},game,{status:'finished',state:Object.assign({},st,{alive:alive,winner:'好人'})}));showToast('好人获胜');return}
    if(wolves.length>=others.length){await updateGame(Object.assign({},game,{status:'finished',state:Object.assign({},st,{alive:alive,winner:'狼人'})}));showToast('狼人获胜');return}
    var ns=Object.assign({},st,{alive:alive,phase:'day',votes:{},night_action:null});
    await updateGame(Object.assign({},game,{state:ns}));
  }else{
    var votes=st.votes||{};var tally={};Object.keys(votes).forEach(function(t){tally[votes[t]]=(tally[votes[t]]||0)+1});
    var maxId=null,maxV=0;Object.keys(tally).forEach(function(id){if(tally[id]>maxV){maxV=tally[id];maxId=id}});
    var alive2=(st.alive||[]).slice();
    if(maxId)alive2=alive2.filter(function(id){return id!==maxId});
    var ns2=Object.assign({},st,{alive:alive2,phase:'night',votes:{},day:(st.day||1)+1});
    await updateGame(Object.assign({},game,{state:ns2}));
  }
}
window.advanceWerewolfPhase=advanceWerewolfPhase;
