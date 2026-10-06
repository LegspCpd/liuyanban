/* ============================================================================
 *  room/game-shell.js —— 
 *  由 room.html 内联脚本逐行拆出，零改动。加载顺序见 room.html 的 script 串。
 * ============================================================================ */
var GAMES=[
  {id:'gomoku',name:'五子棋',desc:'2人对弈',min:2,max:2,icon:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="15" cy="15" r="1.4" fill="currentColor"/></svg>'},
  {id:'draw',name:'你画我猜',desc:'2-8人 · 3分钟一轮',min:2,max:8,icon:'<svg viewBox="0 0 24 24"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>'},
  {id:'spy',name:'谁是卧底',desc:'4-8人 · 推理社交',min:4,max:8,icon:'<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'},
  {id:'werewolf',name:'狼人杀',desc:'6/10人 · 角色扮演',min:6,max:10,icon:'<svg viewBox="0 0 24 24"><path d="M20.5 6.5c-1.5 1-2.5 2.5-2.5 4.5v8c0 1.5-1 2.5-2.5 2.5h-7C7 21.5 6 20.5 6 19v-8c0-2-1-3.5-2.5-4.5"/><circle cx="12" cy="9" r="4"/><circle cx="9.5" cy="8" r=".8" fill="currentColor"/><circle cx="14.5" cy="8" r=".8" fill="currentColor"/></svg>'},
  {id:'doudizhu',name:'斗地主',desc:'3人 · 经典扑克',min:3,max:3,icon:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="12" height="16" rx="2"/><path d="M8 7h5M8 11h5"/><path d="M18 6v13a2 2 0 0 1-2 2H8"/></svg>'}
];
var WORDS_DRAW=['苹果','雪人','雨伞','大象','房子','太阳','火箭','冰淇淋','篮球','蝴蝶','蛋糕','钢琴','火车','气球','熊猫','西瓜','月亮','星星','吉他','眼镜','咖啡','汉堡','风筝','螃蟹','企鹅'];
var WORDS_SPY=[['饺子','馄饨'],['火车','高铁'],['医生','护士'],['可乐','雪碧'],['蝴蝶','蜜蜂'],['面条','米粉'],['雨伞','阳伞'],['苹果','梨子'],['老虎','狮子'],['手机','平板'],['铅笔','钢笔'],['沙发','椅子']];
var DRAW_ROUND_MS=180000;

function pickWord(){return WORDS_DRAW[Math.floor(Math.random()*WORDS_DRAW.length)]}
function emptyBoard(){var b=[];for(var i=0;i<15;i++){var r=[];for(var j=0;j<15;j++)r.push(null);b.push(r)}return b}

function openGameDrawer(){
  if(state.room&&state.room.game_disabled){showToast('管理员已禁止本房间游戏');return}
  var game=state.room&&state.room.current_game;
  if(game&&game.host_id&&game.host_id!==currentUser.id){
    var hostStillIn=(game.players||[]).some(function(p){return p.user_id===game.host_id});
    if(hostStillIn){showToast('只有房主能切换游戏');return}
  }
  document.getElementById('drawerBackdrop').classList.add('open');
  document.getElementById('gameDrawer').classList.add('open');
  renderGameGrid();
}
function closeGameDrawer(){document.getElementById('drawerBackdrop').classList.remove('open');document.getElementById('gameDrawer').classList.remove('open')}
function renderGameGrid(){
  var cur=state.room&&state.room.current_game?state.room.current_game.type:null;
  document.getElementById('gameGrid').innerHTML=GAMES.map(function(g){
    return '<div class="game-card'+(cur===g.id?' active':'')+'" onclick="selectGame(\''+g.id+'\')"><div class="game-card-icon">'+g.icon+'</div><div class="game-card-name">'+g.name+'</div><div class="game-card-desc">'+g.desc+'</div></div>';
  }).join('');
}
document.getElementById('gameBtn').onclick=openGameDrawer;
document.getElementById('drawerBackdrop').onclick=closeGameDrawer;

async function updateGame(patch){
  var res=await window.sb.from('rooms').update({current_game:patch}).eq('id',state.room.id).select().single();
  if(res.error)throw res.error;state.room=res.data;renderMic();renderGame();
}

async function selectGame(gameId){
  var game=state.room&&state.room.current_game;
  if(game&&game.host_id&&game.host_id!==currentUser.id){
    var hostStillIn=(game.players||[]).some(function(p){return p.user_id===game.host_id});
    if(hostStillIn){showToast('只有房主能切换游戏');closeGameDrawer();return}
  }
  closeGameDrawer();
  if(game){showConfirm('切换游戏','当前有游戏进行中，确定要切换吗？',async function(){await startGame(gameId)})}
  else await startGame(gameId);
}

async function startGame(gameId){
  var g=GAMES.find(function(x){return x.id===gameId});if(!g)return;
  var newGame={
    type:gameId,
    status:'lobby',
    started_at:new Date().toISOString(),
    host_id:currentUser.id,
    players:[{user_id:currentUser.id,nickname:currentUser.nickname,avatar_url:currentUser.avatar_url||'',seat:0}],
    state:initGameState(gameId)
  };
  try{await updateGame(newGame);showToast('已创建「'+g.name+'」，等待玩家加入')}catch(e){showToast('启动失败：'+e.message)}
}
function initGameState(type){
  if(type==='gomoku')return{board:emptyBoard(),turn:'black',winner:null};
  if(type==='draw')return{order:[],drawer_index:0,word:'',strokes:[],correct:[],messages:[],scores:{},round_started_at:0,round_end:false};
  if(type==='spy')return{words:{},spy_ids:[],phase:'describe',descriptions:[],votes:{},eliminated:[],round:1};
  if(type==='werewolf')return{roles:{},phase:'choose',alive:[],night_action:null,day:1,votes:{},mode:0};
  if(type==='doudizhu')return{phase:'bid',order:[],hands:{},bottom:[],bids:{},bidTurn:0,bidCount:0,maxBid:0,maxBidder:null,landlord:null,currentTurn:null,lastPlay:null,passCount:0,winner:null,winnerSide:null,multiplier:1,bombCount:0};
  return{};
}

/* ★ 房主退出 → 游戏直接结束 */
async function leaveGame(){
  if(!state.room||!state.room.current_game)return;
  var game=state.room.current_game;
  if(game.host_id===currentUser.id){
    await updateGame(null);
    state.spectating=false;
    return;
  }
  var players=(game.players||[]).filter(function(p){return p.user_id!==currentUser.id});
  if(!players.length){await updateGame(null)}
  else{
    var ns=Object.assign({},game,{players:players});
    if(game.type==='gomoku')ns.state=Object.assign({},game.state,{board:emptyBoard(),turn:'black',winner:null});
    if(game.type==='draw'){ns.state=Object.assign({},game.state,{order:(game.state.order||[]).filter(function(id){return id!==currentUser.id}),strokes:[],correct:[]})}
    if(game.type==='doudizhu')ns.state=Object.assign({},game.state,{phase:'finished',aborted:true,winner:null});
    await updateGame(ns);
  }
  state.spectating=false;
}
window.leaveGame=leaveGame;

async function joinGame(){
  if(!state.room||!state.room.current_game)return;
  var game=state.room.current_game;var g=GAMES.find(function(x){return x.id===game.type});if(!g)return;
  var players=game.players||[];
  if(players.some(function(p){return p.user_id===currentUser.id})){showToast('你已经在游戏中了');return}
  if(players.length>=g.max){showToast('人数已满（'+g.max+'人）');return}
  players=players.concat([{user_id:currentUser.id,nickname:currentUser.nickname,avatar_url:currentUser.avatar_url||'',seat:players.length}]);
  var ng=Object.assign({},game,{players:players});
  try{await updateGame(ng);state.spectating=false;showToast('已加入，等待房主开始')}catch(e){showToast('加入失败：'+e.message)}
}
window.joinGame=joinGame;

function startSpectating(){state.spectating=true;showToast('已进入观战');renderGame()}
function stopSpectating(){state.spectating=false;renderGame()}
window.startSpectating=startSpectating;window.stopSpectating=stopSpectating;

async function beginGame(){
  if(!state.room||!state.room.current_game)return;
  var game=state.room.current_game;
  if(game.host_id!==currentUser.id){showToast('只有房主能开始游戏');return}
  var g=GAMES.find(function(x){return x.id===game.type});if(!g)return;
  var players=game.players||[];
  if(players.length<g.min){showToast('至少需要 '+g.min+' 人');return}
  var st=Object.assign({},game.state);
  if(game.type==='gomoku'){
    st=Object.assign({},st,{board:emptyBoard(),turn:'black',winner:null});
  }
  else if(game.type==='draw'){
    var ids=players.slice().sort(function(a,b){return a.seat-b.seat}).map(function(p){return p.user_id});
    st=Object.assign({},st,{order:ids,drawer_index:0,word:pickWord(),strokes:[],correct:[],messages:[],scores:{},round_started_at:Date.now(),round_end:false});
  }
  else if(game.type==='spy'){
    var n=players.length;var spyCount=n>=6?2:1;
    var pair=WORDS_SPY[Math.floor(Math.random()*WORDS_SPY.length)];
    var shuffled=players.slice().sort(function(){return Math.random()-.5});
    var spyIds=[],words={};
    shuffled.forEach(function(p,i){if(i<spyCount){spyIds.push(p.user_id);words[p.user_id]=pair[1]}else words[p.user_id]=pair[0]});
    st=Object.assign({},st,{words:words,spy_ids:spyIds,phase:'describe',descriptions:[],votes:{},eliminated:[],round:1});
  }
  else if(game.type==='werewolf'){
    st=Object.assign({},st,{roles:{},phase:'choose',alive:players.map(function(p){return p.user_id}),day:1,votes:{},night_action:null,mode:0});
  }
  else if(game.type==='doudizhu'){
    var dzIds=players.slice().sort(function(a,b){return a.seat-b.seat}).map(function(p){return p.user_id});
    var dzDeck=ddzShuffle(ddzNewDeck());
    var dzHands={};
    dzIds.forEach(function(uid,i){dzHands[uid]=ddzSort(dzDeck.slice(i*17,i*17+17))});
    st=Object.assign({},st,{phase:'bid',order:dzIds,hands:dzHands,bottom:dzDeck.slice(51,54),bids:{},bidTurn:0,bidCount:0,maxBid:0,maxBidder:null,landlord:null,currentTurn:null,lastPlay:null,passCount:0,winner:null,winnerSide:null,multiplier:1,bombCount:0});
  }
  var ng=Object.assign({},game,{status:'playing',state:st});
  try{await updateGame(ng);showToast('游戏开始！')}catch(e){showToast('开始失败：'+e.message)}
}
window.beginGame=beginGame;

/* ★ 再来一轮 */
async function restartGame(){
  if(!state.room||!state.room.current_game)return;
  var game=state.room.current_game;
  if(game.host_id!==currentUser.id){showToast('只有房主能重开');return}
  await beginGame();
}
window.restartGame=restartGame;

/* ============================================================
   你画我猜 tick
============================================================ */
function startGameTick(){
  if(gameTickInterval)clearInterval(gameTickInterval);
  gameTickInterval=setInterval(gameTick,1000);
  startOfflineCheck();
}
function startOfflineCheck(){
  if(offlineCheckTimer)clearInterval(offlineCheckTimer);
  offlineCheckTimer=setInterval(function(){
    if(!state.room)return;
    if(!state.memberChannel)return;
    try{
      var raw=state.memberChannel.presenceState();
      var ids=Object.keys(raw).filter(function(k){return raw[k]&&raw[k].length;});
      cleanupOfflineGamePlayers(ids);
    }catch(e){}
  },15000);
}
function stopOfflineCheck(){ if(offlineCheckTimer){clearInterval(offlineCheckTimer);offlineCheckTimer=null;} }
function gameTick(){
  if(!state.room||!state.room.current_game)return;
  var game=state.room.current_game;
  if(game.status!=='playing')return;
  if(game.type==='draw'){
    var st=game.state;
    if(!st.round_started_at||st.round_end)return;
    var elapsed=Date.now()-st.round_started_at;
    var remaining=Math.max(0,DRAW_ROUND_MS-elapsed);
    var drawerId=(st.order||[])[st.drawer_index];
    var players=game.players||[];
    var guessers=players.filter(function(p){return p.user_id!==drawerId});
    var allCorrect=guessers.length>0&&guessers.every(function(p){return (st.correct||[]).indexOf(p.user_id)>=0});
    var timerEl=document.getElementById('drawTimer');
    if(timerEl){
      var mm=Math.floor(remaining/60000),ss=Math.floor((remaining%60000)/1000);
      timerEl.textContent=mm+':'+(ss<10?'0':'')+ss;
      if(remaining<=30000)timerEl.classList.add('urgent');else timerEl.classList.remove('urgent');
    }
    if(remaining<=0||allCorrect){
      (async function(){
        try{
          var cur=state.room.current_game;
          if(!cur||cur.type!=='draw'||cur.state.round_end)return;
          var ns=Object.assign({},cur.state,{round_end:true});
          await updateGame(Object.assign({},cur,{state:ns}));
          setTimeout(advanceDrawRound,1500);
        }catch(e){}
      })();
    }
  }
}
async function advanceDrawRound(){
  if(!state.room||!state.room.current_game)return;
  var game=state.room.current_game;
  if(game.type!=='draw')return;
  var st=game.state;
  if(!st.round_end)return;
  var drawerId=(st.order||[])[st.drawer_index];
  var players=game.players||[];
  var guessers=players.filter(function(p){return p.user_id!==drawerId});
  var allCorrect=guessers.length>0&&guessers.every(function(p){return (st.correct||[]).indexOf(p.user_id)>=0});
  var scores=Object.assign({},st.scores||{});
  if(allCorrect&&drawerId)scores[drawerId]=(scores[drawerId]||0)+2;
  var nextIdx=(st.drawer_index||0)+1;
  var finished=nextIdx>=(st.order||[]).length;
  var ns;
  if(finished){
    ns=Object.assign({},st,{scores:scores,round_end:true,phase:'finished'});
  }else{
    ns=Object.assign({},st,{scores:scores,drawer_index:nextIdx,word:pickWord(),strokes:[],correct:[],messages:[],round_started_at:Date.now(),round_end:false});
  }
  try{await updateGame(Object.assign({},game,{state:ns}))}catch(e){}
}

