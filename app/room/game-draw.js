/* ============================================================================
 *  room/game-draw.js —— 
 *  由 room.html 内联脚本逐行拆出，零改动。加载顺序见 room.html 的 script 串。
 * ============================================================================ */
/* ============================================================
   你画我猜（含再来一轮）
============================================================ */
function renderDraw(game,el){
  var st=game.state||{},players=game.players||[];
  var order=st.order||[];
  if(!order.length){el.innerHTML='<div class="draw-intermission">准备中…</div>';return}
  if(st.phase==='finished'){
    var scores=st.scores||{};
    var rank=players.slice().sort(function(a,b){return (scores[b.user_id]||0)-(scores[a.user_id]||0)});
    var html='<div class="draw-intermission"><div class="big">游戏结束</div>';
    html+='<div class="draw-scoreboard" style="margin-top:14px;">'+rank.map(function(p,i){
      return '<div class="draw-score">'+(i===0?'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f0b429" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>':'')+' '+escapeHtml(p.nickname)+' <span class="pts">'+(scores[p.user_id]||0)+'分</span></div>';
    }).join('')+'</div>';
    if(game.host_id===currentUser.id)html+='<button class="lobby-btn start" style="margin-top:16px;" onclick="restartGame()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>再来一轮</button>';
    else html+='<div style="font-size:.75em;opacity:.7;margin-top:14px;">等待房主重开…</div>';
    html+='</div>';
    el.innerHTML=html;return;
  }
  if(st.round_end){el.innerHTML='<div class="draw-intermission"><div class="big">本轮结束</div><div>正在切换到下一位画手…</div></div>';return}
  var drawerId=order[st.drawer_index];
  var isDrawer=drawerId===currentUser.id;
  var scores=st.scores||{};
  var elapsed=st.round_started_at?Date.now()-st.round_started_at:0;
  var remaining=Math.max(0,DRAW_ROUND_MS-elapsed);
  var html='<div class="draw-wrap">';
  html+='<div class="draw-info">';
  html+='<span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'+(isDrawer?'轮到你画':escapeHtml((players.find(function(p){return p.user_id===drawerId})||{}).nickname||'')+' 画')+'</span>';
  html+='<span class="draw-timer'+(remaining<=30000?' urgent':'')+'" id="drawTimer">3:00</span>';
  html+='<span class="draw-word'+(isDrawer?'':' hidden-word')+'">'+(isDrawer?escapeHtml(st.word||''):'? ? ?')+'</span>';
  html+='</div>';
  html+='<div class="draw-scoreboard">'+players.map(function(p){
    var pts=scores[p.user_id]||0;
    return '<div class="draw-score'+(p.user_id===drawerId?' drawing':'')+'"><span style="font-weight:800;">'+escapeHtml(p.nickname)+'</span><span class="pts">'+pts+'分</span>'+(p.user_id===drawerId?' <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>':'')+'</div>';
  }).join('')+'</div>';
  html+='<div class="draw-canvas-wrap"><canvas class="draw-canvas" id="drawCanvas"></canvas></div>';
  if(isDrawer){
    html+='<div class="draw-tools" id="drawTools">';
    ['#000000','#e53935','#43a047','#1e88e5','#fb8c00','#8e24aa'].forEach(function(c){html+='<div class="draw-color" data-color="'+c+'" style="background:'+c+'" onclick="setDrawColor(this)"></div>'});
    ['2','5','10'].forEach(function(s,i){html+='<button class="draw-size'+(i===1?' active':'')+'" data-size="'+s+'" onclick="setDrawSize(this)">'+s+'px</button>'});
    html+='<button class="draw-size" onclick="clearDraw()">清空</button></div>';
  }
  if(!isDrawer&&remaining>0&&(st.correct||[]).indexOf(currentUser.id)<0){
    html+='<div class="draw-guess-box"><input id="drawGuessInput" maxlength="20" placeholder="输入你的猜测…" onkeydown="if(event.key===\'Enter\')submitDrawGuess()" /><button onclick="submitDrawGuess()">猜</button></div>';
  }
  var msgs=st.messages||[];
  html+='<div class="draw-messages">'+(msgs.length?msgs.map(function(m){return '<div class="draw-msg'+(m.correct?' correct':'')+'">'+escapeHtml(m.text)+'</div>'}).join(''):'<div style="opacity:.5;">还没有人猜…</div>')+'</div>';
  html+='</div>';
  el.innerHTML=html;
  initDrawCanvas(game,isDrawer);
  var timerEl=document.getElementById('drawTimer');
  if(timerEl){var mm=Math.floor(remaining/60000),ss=Math.floor((remaining%60000)/1000);timerEl.textContent=mm+':'+(ss<10?'0':'')+ss}
}
var drawState={color:'#000000',size:5,drawing:false,currentStroke:null,canvas:null,ctx:null,isDrawer:false};
function setDrawColor(el){drawState.color=el.dataset.color;document.querySelectorAll('.draw-color').forEach(function(x){x.classList.remove('active')});el.classList.add('active')}
function setDrawSize(el){drawState.size=parseInt(el.dataset.size,10);document.querySelectorAll('.draw-size').forEach(function(x){x.classList.remove('active')});el.classList.add('active')}
window.setDrawColor=setDrawColor;window.setDrawSize=setDrawSize;
function initDrawCanvas(game,isDrawer){
  var canvas=document.getElementById('drawCanvas');if(!canvas)return;
  var wrap=canvas.parentElement;
  // 用 requestAnimationFrame 等布局稳定后再取宽度
  var setup=function(){
    var w=wrap.clientWidth;if(!w||w<50){requestAnimationFrame(setup);return;}
    var h=Math.max(180,Math.min(w,300));
    canvas.width=w;canvas.height=h;canvas.style.height=h+'px';
    drawState.canvas=canvas;drawState.ctx=canvas.getContext('2d');drawState.isDrawer=isDrawer;
    redrawStrokes(game.state.strokes||[]);
  };
  requestAnimationFrame(setup);
  if(!isDrawer)return;
  canvas.addEventListener('mousedown',startDraw);canvas.addEventListener('mousemove',moveDraw);canvas.addEventListener('mouseup',endDraw);canvas.addEventListener('mouseleave',endDraw);
  canvas.addEventListener('touchstart',function(e){e.preventDefault();startDraw(e.touches[0])},{passive:false});
  canvas.addEventListener('touchmove',function(e){e.preventDefault();moveDraw(e.touches[0])},{passive:false});
  canvas.addEventListener('touchend',function(e){e.preventDefault();endDraw()},{passive:false});
}
function getPos(canvas,e){var r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}}
function startDraw(e){if(!drawState.isDrawer)return;drawState.drawing=true;drawState.currentStroke={color:drawState.color,size:drawState.size,points:[getPos(drawState.canvas,e)]}}
function moveDraw(e){if(!drawState.drawing)return;var p=getPos(drawState.canvas,e);var s=drawState.currentStroke;var last=s.points[s.points.length-1];s.points.push(p);var ctx=drawState.ctx;var W=drawState.canvas.width,H=drawState.canvas.height;ctx.strokeStyle=s.color;ctx.lineWidth=s.size;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(last.x*W,last.y*H);ctx.lineTo(p.x*W,p.y*H);ctx.stroke();clearTimeout(drawState._syncTimer);drawState._syncTimer=setTimeout(syncStrokes,150)}
function endDraw(){if(!drawState.drawing)return;drawState.drawing=false;if(drawState.currentStroke&&drawState.currentStroke.points.length<2)drawState.currentStroke.points.push(drawState.currentStroke.points[0]);syncStrokes()}
async function syncStrokes(){if(!state.room||!state.room.current_game)return;var game=state.room.current_game;var strokes=(game.state.strokes||[]).slice();if(drawState.currentStroke&&strokes.indexOf(drawState.currentStroke)<0)strokes.push(drawState.currentStroke);try{await updateGame(Object.assign({},game,{state:Object.assign({},game.state,{strokes:strokes})}))}catch(e){}}
function redrawStrokes(strokes){var ctx=drawState.ctx;if(!ctx)return;var W=drawState.canvas.width,H=drawState.canvas.height;ctx.clearRect(0,0,W,H);strokes.forEach(function(s){ctx.strokeStyle=s.color;ctx.lineWidth=s.size;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();s.points.forEach(function(p,i){if(i===0)ctx.moveTo(p.x*W,p.y*H);else ctx.lineTo(p.x*W,p.y*H)});ctx.stroke()})}
async function clearDraw(){if(!state.room||!state.room.current_game)return;var game=state.room.current_game;if((game.state.order||[])[game.state.drawer_index]!==currentUser.id)return;await updateGame(Object.assign({},game,{state:Object.assign({},game.state,{strokes:[]})}))}
window.clearDraw=clearDraw;
async function submitDrawGuess(){
  if(!state.room||!state.room.current_game)return;
  var game=state.room.current_game;if(game.type!=='draw')return;
  if(game.status!=='playing')return;
  var st=game.state;if(st.round_end)return;
  if((st.order||[])[st.drawer_index]===currentUser.id){showToast('你是画手');return}
  if((st.correct||[]).indexOf(currentUser.id)>=0){showToast('你已经猜对了');return}
  var input=document.getElementById('drawGuessInput');var guess=(input.value||'').trim();if(!guess)return;input.value='';
  var isCorrect=guess===st.word;
  var msgs=(st.messages||[]).slice();
  msgs.push({text:currentUser.nickname+'：'+guess,correct:isCorrect});
  if(msgs.length>50)msgs=msgs.slice(-50);
  var ns=Object.assign({},st,{messages:msgs});
  var scores=Object.assign({},st.scores||{});
  if(isCorrect){
    var corr=(ns.correct||[]).slice();
    if(corr.indexOf(currentUser.id)<0)corr.push(currentUser.id);
    ns.correct=corr;
    scores[currentUser.id]=(scores[currentUser.id]||0)+1;
    ns.scores=scores;
    ns.messages.push({text:currentUser.nickname+' 猜对了！',correct:true});
  }
  try{await updateGame(Object.assign({},game,{state:ns}))}catch(e){showToast('提交失败：'+e.message)}
}
window.submitDrawGuess=submitDrawGuess;

