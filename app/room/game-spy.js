/* ============================================================================
 *  room/game-spy.js —— 
 *  由 room.html 内联脚本逐行拆出，零改动。加载顺序见 room.html 的 script 串。
 * ============================================================================ */
/* ============================================================
   谁是卧底（含再来一轮）
============================================================ */
function renderSpy(game,el){
  var st=game.state||{},players=game.players||[];
  var myWord=st.words[currentUser.id]||'?';
  var eliminated=st.eliminated||[];var descriptions=st.descriptions||[];
  var alive=players.filter(function(p){return eliminated.indexOf(p.user_id)<0});
  var spyAlive=(st.spy_ids||[]).filter(function(id){return eliminated.indexOf(id)<0});
  if(spyAlive.length===0){
    var h='<div class="spy-wrap"><div class="spy-result"><div class="big" style="color:#a78bfa;">平民获胜！</div><div>所有卧底已被淘汰</div>';
    if(game.host_id===currentUser.id)h+='<button class="lobby-btn start" style="margin-top:16px;background:#8b5cf6;" onclick="restartGame()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>再来一轮</button>';
    else h+='<div style="font-size:.75em;opacity:.7;margin-top:14px;">等待房主重开…</div>';
    h+='</div></div>';el.innerHTML=h;return;
  }
  var aliveCount=alive.length;var spiesLeft=spyAlive.length;var citizensLeft=aliveCount-spiesLeft;
  if(spiesLeft>=citizensLeft){
    var h2='<div class="spy-wrap"><div class="spy-result"><div class="big" style="color:#ff5252;">卧底获胜！</div><div>卧底人数已不少于平民</div>';
    if(game.host_id===currentUser.id)h2+='<button class="lobby-btn start" style="margin-top:16px;background:#8b5cf6;" onclick="restartGame()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>再来一轮</button>';
    else h2+='<div style="font-size:.75em;opacity:.7;margin-top:14px;">等待房主重开…</div>';
    h2+='</div></div>';el.innerHTML=h2;return;
  }
  var html='<div class="spy-wrap">';
  html+='<div class="spy-role-card"><div class="spy-role-label">你的词语</div><div class="spy-role-word">'+escapeHtml(myWord)+'</div><div class="spy-desc">描述你的词，不能直接说出来！</div></div>';
  html+='<div style="font-size:.78em;font-weight:700;">第 '+st.round+' 轮 · '+(st.phase==='describe'?'描述阶段':'投票阶段')+'</div>';
  html+='<div class="spy-players">';
  players.forEach(function(p){
    var isElim=eliminated.indexOf(p.user_id)>=0;
    var desc=descriptions.find(function(d){return d.user_id===p.user_id});
    var has=p.avatar_url&&String(p.avatar_url).indexOf('http')===0;
    html+='<div class="spy-player'+(isElim?' eliminated':'')+'"><div class="gpm-avatar" style="'+(has?'background-image:url('+escapeHtml(p.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(has?'':escapeHtml(String(p.nickname).charAt(0).toUpperCase()))+'</div><div class="name">'+escapeHtml(p.nickname)+'</div>'+(desc?'<div style="font-size:.72em;opacity:.8;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escapeHtml(desc.text)+'</div>':'')+(!desc&&!isElim&&p.user_id!==currentUser.id?'<span style="font-size:.7em;opacity:.5;">等待…</span>':'')+'</div>';
  });
  html+='</div>';
  if(st.phase==='describe'){
    var myDesc=descriptions.find(function(d){return d.user_id===currentUser.id});
    if(!myDesc&&eliminated.indexOf(currentUser.id)<0){
      html+='<div class="spy-desc-input"><input id="spyDescInput" maxlength="30" placeholder="输入你的描述…" onkeydown="if(event.key===\'Enter\')submitSpyDesc()" /><button onclick="submitSpyDesc()">发送</button></div>';
    }else{
      var allDescribed=alive.every(function(p){return descriptions.find(function(d){return d.user_id===p.user_id})});
      if(allDescribed)html+='<div style="text-align:center;margin-top:8px;"><button style="padding:10px 24px;background:#8b5cf6;color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;" onclick="startSpyVote()">进入投票</button></div>';
      else html+='<div style="font-size:.72em;opacity:.6;text-align:center;margin-top:8px;">等待其他玩家描述…</div>';
    }
  }
  if(st.phase==='vote'){
    var votes=st.votes||{};var myVoted=votes[currentUser.id];
    if(!myVoted){
      html+='<div style="font-size:.78em;font-weight:700;margin-top:8px;">投票淘汰</div><div class="spy-players">';
      players.forEach(function(p){
        if(eliminated.indexOf(p.user_id)>=0||p.user_id===currentUser.id)return;
        var has=p.avatar_url&&String(p.avatar_url).indexOf('http')===0;
        html+='<div class="spy-player"><div class="gpm-avatar" style="'+(has?'background-image:url('+escapeHtml(p.avatar_url)+');background-size:cover;background-position:center;':'')+'">'+(has?'':escapeHtml(String(p.nickname).charAt(0).toUpperCase()))+'</div><div class="name">'+escapeHtml(p.nickname)+'</div><button class="vote-btn" onclick="castSpyVote(\''+p.user_id+'\')">投票</button></div>';
      });
      html+='</div>';
    }else{html+='<div style="text-align:center;padding:14px;opacity:.8;">已投票，等待其他玩家…</div>'}
  }
  if(st.lastVote){var lv=st.lastVote;var votedPlayer=players.find(function(p){return p.user_id===lv.out_id});html+='<div class="spy-timeline"><div class="spy-line">'+escapeHtml(votedPlayer?votedPlayer.nickname:'?')+' 被淘汰（'+(lv.is_spy?'卧底':'平民')+'）</div></div>'}
  html+='</div>';el.innerHTML=html;
}
async function submitSpyDesc(){if(!state.room||!state.room.current_game)return;var game=state.room.current_game;var input=document.getElementById('spyDescInput');var text=(input.value||'').trim();if(!text)return;var descs=(game.state.descriptions||[]).slice();descs.push({user_id:currentUser.id,nickname:currentUser.nickname,text:text});await updateGame(Object.assign({},game,{state:Object.assign({},game.state,{descriptions:descs})}))}
window.submitSpyDesc=submitSpyDesc;
async function startSpyVote(){if(!state.room||!state.room.current_game)return;var game=state.room.current_game;await updateGame(Object.assign({},game,{state:Object.assign({},game.state,{phase:'vote'})}))}
window.startSpyVote=startSpyVote;
async function castSpyVote(targetId){
  if(!state.room||!state.room.current_game)return;var game=state.room.current_game;
  if((game.state.eliminated||[]).indexOf(currentUser.id)>=0){showToast('你已被淘汰');return}
  var votes=Object.assign({},game.state.votes||{});votes[currentUser.id]=targetId;
  var players=game.players||[];var alivePlayers=players.filter(function(p){return (game.state.eliminated||[]).indexOf(p.user_id)<0});
  var allVoted=alivePlayers.every(function(p){return votes[p.user_id]});
  var ns=Object.assign({},game.state,{votes:votes});
  if(allVoted){
    var tally={};Object.keys(votes).forEach(function(t){tally[votes[t]]=(tally[votes[t]]||0)+1});
    var maxId=null,maxV=0;Object.keys(tally).forEach(function(id){if(tally[id]>maxV){maxV=tally[id];maxId=id}});
    var elim=(ns.eliminated||[]).slice();elim.push(maxId);ns.eliminated=elim;
    ns.lastVote={out_id:maxId,is_spy:(ns.spy_ids||[]).indexOf(maxId)>=0};
    ns.phase='describe';ns.descriptions=[];ns.votes={};ns.round=(ns.round||1)+1;
  }
  await updateGame(Object.assign({},game,{state:ns}));
}
window.castSpyVote=castSpyVote;

