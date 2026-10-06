/* ============================================================================
 *  room/game-gomoku.js —— 
 *  由 room.html 内联脚本逐行拆出，零改动。加载顺序见 room.html 的 script 串。
 * ============================================================================ */
/* ============================================================
   五子棋（含再来一轮）
============================================================ */
function renderGomoku(game,el){
  var st=game.state||{},board=st.board||emptyBoard(),players=game.players||[];
  var statusText='';
  var extraBtn='';
  if(game.status==='finished'){
    statusText='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f0b429" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;margin-right:2px;"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>'+(st.winner==='black'?escapeHtml(players[0]?players[0].nickname:'黑方'):escapeHtml(players[1]?players[1].nickname:'白方'))+' 获胜！';
    if(game.host_id===currentUser.id)extraBtn='<button class="lobby-btn start" style="margin-top:10px;" onclick="restartGame()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>再来一轮</button>';
    else extraBtn='<div style="font-size:.75em;opacity:.7;margin-top:8px;">等待房主重开…</div>';
  }
  else{
    var myColor=players[0]&&players[0].user_id===currentUser.id?'black':(players[1]&&players[1].user_id===currentUser.id?'white':null);
    if(myColor)statusText=st.turn===myColor?'轮到你落子':'等待对方…';
    else statusText=(st.turn==='black'?'黑方':'白方')+' 思考中…';
  }
  var sel=gomokuSel;
  var html='<div class="gomoku-wrap"><div class="gomoku-status">'+statusText+'</div>'+extraBtn+'<div class="gomoku-board" id="gmkBoard">';
  for(var rr=0;rr<15;rr++)for(var cc=0;cc<15;cc++){
    var v=(board[rr]&&board[rr][cc])||null;
    var cls=v==='b'?'black':(v==='w'?'white':'');
    var isSel=sel&&sel.r===rr&&sel.c===cc;
    html+='<div class="gmk-cell'+(isSel?' gmk-sel':'')+'" data-r="'+rr+'" data-c="'+cc+'">'+(v?'<span class="gmk-stone '+cls+'"></span>':'')+(isSel&&!v?'<span class="gmk-sel-mark"></span>':'')+'</div>';
  }
  html+='</div>';
  if(sel)html+='<button class="gomoku-place-btn" onclick="confirmPlaceStone()">下这里</button>';
  html+='</div>';
  el.innerHTML=html;
  el.querySelectorAll('.gmk-cell').forEach(function(cell){cell.onclick=function(){onCellClick(parseInt(this.dataset.r,10),parseInt(this.dataset.c,10))}});
}
var gomokuSel=null;
function confirmPlaceStone(){
  if(!gomokuSel)return;
  var game=state.room&&state.room.current_game;if(!game||game.type!=='gomoku')return;
  var st=game.state,players=game.players||[];
  var myColor=players[0]&&players[0].user_id===currentUser.id?'black':(players[1]&&players[1].user_id===currentUser.id?'white':null);
  if(!myColor||st.turn!==myColor)return;
  var r=gomokuSel.r,c=gomokuSel.c;gomokuSel=null;
  doPlaceStone(r,c,myColor);
}
function onCellClick(r,c){
  var game=state.room&&state.room.current_game;if(!game||game.type!=='gomoku')return;
  if(game.status!=='playing'){showToast('对局尚未开始');return}
  var st=game.state,players=game.players||[];
  var myColor=players[0]&&players[0].user_id===currentUser.id?'black':(players[1]&&players[1].user_id===currentUser.id?'white':null);
  if(!myColor){showToast('你不是本局玩家');return}
  if(st.turn!==myColor){showToast('还没轮到你');return}
  if(st.board[r][c])return;
  if(localStorage.getItem('gomoku_skip_confirm')==='1'){doPlaceStone(r,c,myColor);return;}
  gomokuSel={r:r,c:c};
  renderGomoku(game,document.getElementById('gameContent'));
}
async function doPlaceStone(r,c,myColor){
  var game=state.room&&state.room.current_game;if(!game||game.type!=='gomoku')return;
  var st=game.state;if(game.status!=='playing'||st.board[r][c])return;
  var players=game.players||[];
  var curColor=players[0]&&players[0].user_id===currentUser.id?'black':(players[1]&&players[1].user_id===currentUser.id?'white':null);
  if(curColor!==myColor||st.turn!==myColor)return;
  var board=st.board.map(function(row){return row.slice()});var stone=myColor==='black'?'b':'w';board[r][c]=stone;
  var won=checkWinGmk(board,r,c,stone);
  var ns={board:board,turn:myColor==='black'?'white':'black',winner:won?myColor:null};
  try{await updateGame(Object.assign({},game,{status:won?'finished':'playing',state:ns}))}catch(e){showToast('落子失败：'+e.message)}
}
function checkWinGmk(board,r,c,color){var dirs=[[0,1],[1,0],[1,1],[1,-1]];for(var d=0;d<dirs.length;d++){var dr=dirs[d][0],dc=dirs[d][1],cnt=1;for(var s=-1;s<=1;s+=2){var rr=r+dr*s,cc=c+dc*s;while(rr>=0&&rr<15&&cc>=0&&cc<15&&board[rr][cc]===color){cnt++;rr+=dr*s;cc+=dc*s}}if(cnt>=5)return true}return false}

