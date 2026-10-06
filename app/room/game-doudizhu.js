/* ============================================================================
 *  room/game-doudizhu.js —— 
 *  由 room.html 内联脚本逐行拆出，零改动。加载顺序见 room.html 的 script 串。
 * ============================================================================ */
/* ============================================================
   斗地主 —— 核心逻辑
============================================================ */
var ddzSuits=['♠','♥','♣','♦'];
function ddzVal(id){return id<52?(Math.floor(id/4))+3:(id===52?16:17);}
function ddzSuit(id){return id<52?id%4:-1;}
function ddzNewDeck(){var d=[];for(var i=0;i<54;i++)d.push(i);return d;}
function ddzShuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function ddzSort(c){return c.slice().sort(function(a,b){return ddzVal(a)-ddzVal(b)||ddzSuit(a)-ddzSuit(b);});}
function ddzValName(v){return v===16?'小王':v===17?'大王':v===15?'2':v===14?'A':v===13?'K':v===12?'Q':v===11?'J':String(v);}
function ddzCardHTML(id,opts){
  opts=opts||{};
  var v=ddzVal(id);
  var cls='ddz-card'+(opts.mini?' mini':'')+(opts.sel?' sel':'');
  if(v>=16){
    cls+=' red';
    return '<div class="'+cls+'" data-id="'+id+'"><div class="rk">'+(v===17?'大':'小')+'</div><div class="su">王</div></div>';
  }
  var suit=ddzSuit(id);
  var red=(suit===1||suit===3);
  cls+=red?' red':' black';
  return '<div class="'+cls+'" data-id="'+id+'"><div class="rk">'+ddzValName(v)+'</div><div class="su">'+ddzSuits[suit]+'</div></div>';
}
function ddzCheckPlane(cnt,keys,n){
  var trioVals=keys.filter(function(k){return cnt[k]>=3&&k<=14;}).sort(function(a,b){return a-b;});
  var segs=[],cur=[];
  for(var i=0;i<trioVals.length;i++){
    if(!cur.length||trioVals[i]===cur[cur.length-1]+1)cur.push(trioVals[i]);
    else{if(cur.length>=2)segs.push(cur);cur=[trioVals[i]];}
  }
  if(cur.length>=2)segs.push(cur);
  for(var s=0;s<segs.length;s++){
    var seg=segs[s];
    for(var L=seg.length;L>=2;L--){
      for(var st=0;st+L<=seg.length;st++){
        var sub=seg.slice(st,st+L);
        var remain=n-3*L;
        if(remain===L){
          var rc=Object.assign({},cnt);sub.forEach(function(v){rc[v]-=3;});
          var tot=0;Object.keys(rc).forEach(function(k){tot+=rc[k];});
          if(tot===L)return{type:'plane_single',len:L,value:sub[sub.length-1]};
        }
        if(remain===2*L){
          var rc2=Object.assign({},cnt);sub.forEach(function(v){rc2[v]-=3;});
          var tot2=0,okp=true;Object.keys(rc2).forEach(function(k){var c=rc2[k];tot2+=c;if(c!==0&&c!==2)okp=false;});
          if(tot2===2*L&&okp)return{type:'plane_pair',len:L,value:sub[sub.length-1]};
        }
      }
    }
  }
  return null;
}
function ddzAnalyze(cards){
  if(!cards||!cards.length)return null;
  var vals=cards.map(ddzVal).sort(function(a,b){return a-b;});
  var n=vals.length;
  var cnt={};vals.forEach(function(v){cnt[v]=(cnt[v]||0)+1;});
  var keys=Object.keys(cnt).map(Number).sort(function(a,b){return a-b;});
  var counts=keys.map(function(k){return cnt[k];});
  var maxCnt=Math.max.apply(null,counts);
  if(n===2&&vals[0]===16&&vals[1]===17)return{type:'rocket',len:1,value:100};
  if(n===4&&keys.length===1)return{type:'bomb',len:1,value:keys[0]};
  if(n===1)return{type:'single',len:1,value:vals[0]};
  if(n===2&&keys.length===1)return{type:'pair',len:1,value:keys[0]};
  if(n===3&&keys.length===1)return{type:'trio',len:1,value:keys[0]};
  if(n===4&&maxCnt===3){var tv=keys.filter(function(k){return cnt[k]===3})[0];return{type:'trio_single',len:1,value:tv};}
  if(n===5&&maxCnt===3&&keys.length===2){var tv2=keys.filter(function(k){return cnt[k]===3})[0];return{type:'trio_pair',len:1,value:tv2};}
  if(n>=5&&keys.length===n&&vals[n-1]<=14){
    var ok=true;for(var i=1;i<n;i++){if(vals[i]!==vals[i-1]+1){ok=false;break;}}
    if(ok)return{type:'straight',len:n,value:vals[n-1]};
  }
  if(n>=6&&n%2===0&&keys.length===n/2&&counts.every(function(c){return c===2;})&&vals[n-1]<=14){
    var ok2=true;for(var i=1;i<keys.length;i++){if(keys[i]!==keys[i-1]+1){ok2=false;break;}}
    if(ok2)return{type:'straight_pair',len:keys.length,value:keys[keys.length-1]};
  }
  if(n>=6&&n%3===0&&keys.length===n/3&&counts.every(function(c){return c===3;})&&vals[n-1]<=14){
    var ok3=true;for(var i=1;i<keys.length;i++){if(keys[i]!==keys[i-1]+1){ok3=false;break;}}
    if(ok3)return{type:'plane',len:keys.length,value:keys[keys.length-1]};
  }
  return ddzCheckPlane(cnt,keys,n);
}
function ddzCanBeat(play,last){
  if(!play)return false;
  if(!last)return true;
  if(play.type==='rocket')return true;
  if(last.type==='rocket')return false;
  if(play.type==='bomb'&&last.type!=='bomb')return true;
  if(play.type==='bomb'&&last.type==='bomb')return play.value>last.value;
  if(last.type==='bomb')return false;
  if(play.type!==last.type)return false;
  if(play.len!==last.len)return false;
  return play.value>last.value;
}
function renderDoudizhu(game,el){
  var st=game.state||{},players=game.players||[];
  var order=st.order||[];
  var myHand=st.hands?st.hands[currentUser.id]:null;
  var isAdminNow=window.isAdmin(currentUser);
  if(st.phase==="finished"){
    var msg=st.aborted?"游戏已中止":(st.winnerSide==="landlord"?"地主获胜":"农民获胜");
    var h1='<div class="ddz-result"><div class="big">'+msg+"</div>";
    if(st.multiplier&&st.multiplier>1)h1+='<div style="font-size:.8em;opacity:.8;">倍数 x'+st.multiplier+"</div>";
    if(game.host_id===currentUser.id)h1+='<button class="lobby-btn start" style="margin-top:16px;" onclick="restartGame()">再来一轮</button>';
    else h1+='<div style="font-size:.75em;opacity:.7;margin-top:14px;">等待房主重开…</div>';
    h1+="</div>";el.innerHTML=h1;return;
  }
  var myIdx=order.indexOf(currentUser.id);
  var rightUid=order[(myIdx+1)%order.length];
  var leftUid=order[(myIdx+2)%order.length];
  function pby(uid){return players.find(function(p){return p.user_id===uid})||{};}
  function lpOf(uid){return st.lastPlays?st.lastPlays[uid]:null;}
  function oppBlock(uid){
    var p=pby(uid);
    var isTurn=(st.phase==="bid"&&order[st.bidTurn]===uid)||(st.phase==="play"&&st.currentTurn===uid);
    var isLL=st.landlord===uid;
    var cnt=st.hands&&st.hands[uid]?st.hands[uid].length:0;
    var bid=st.bids?st.bids[uid]:undefined;
    var lp=lpOf(uid);
    var has=p.avatar_url&&String(p.avatar_url).indexOf("http")===0;
    var h='<div class="ddz-opp'+(isTurn?" turn":"")+(isLL?" landlord":"")+'">';
    h+='<div class="ddz-opp-head"'+(isAdminNow?' onclick="ddzPeek(\''+uid+'\')" title="查看手牌"':"")+'>';
    h+='<div class="avatar" style="'+(has?"background-image:url("+escapeHtml(p.avatar_url)+");":"")+'">'+(has?"":escapeHtml(String(p.nickname||"U").charAt(0)))+'</div>';
    h+='<div class="nm">'+escapeHtml(p.nickname||"")+(isLL?" · 地主":"")+'</div>';
    h+='<div class="cnt">'+cnt+"张"+(isAdminNow?' <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>':"")+"</div>";
    if(isLL)h+='<span class="crown"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f0b429" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M2 18h20l-2-9-4 4-4-7-4 7-4-4z"/></svg></span>';
    h+="</div>";
    if(st.phase==="bid"&&bid!==undefined&&bid!==null){h+='<div class="ddz-bubble '+(bid?"yes":"no")+'">'+(bid?"叫地主！":"不叫")+"</div>";}
    if(lp){if(lp.pass)h+='<div class="ddz-opp-play"><span class="ddz-pass-tag">不要</span></div>';else h+='<div class="ddz-opp-play">'+lp.cards.map(function(c){return ddzCardHTML(c,{mini:true})}).join("")+"</div>";}
    h+="</div>";return h;
  }
  var h='<div class="ddz-board">';
  h+='<div class="ddz-opps">'+oppBlock(leftUid)+oppBlock(rightUid)+"</div>";
  h+='<div class="ddz-center">';
  if(st.landlord){h+='<div style="display:flex;gap:4px;align-items:center;font-size:.7em;opacity:.9;"><span style="color:#ffd54f;font-weight:700;">底牌</span>'+(st.bottom||[]).map(function(c){return ddzCardHTML(c,{mini:true})}).join("")+"</div>";}
  if(st.phase==="bid"){var curBidUid=order[st.bidTurn];h+='<div class="ddz-status">'+(curBidUid===currentUser.id?"轮到你叫地主":"等待 "+(pby(curBidUid).nickname||"")+" 叫地主…")+"</div>";}
  else{h+='<div class="ddz-status">'+(st.currentTurn===currentUser.id?"轮到你出牌":"等待 "+(pby(st.currentTurn).nickname||"")+" 出牌…")+"</div>";}
  h+="</div>";
  var myLp=lpOf(currentUser.id);
  h+='<div class="ddz-my-play">';
  if(myLp){if(myLp.pass)h+='<span class="ddz-pass-tag">不要</span>';else h+=myLp.cards.map(function(c){return ddzCardHTML(c,{mini:true})}).join("");}
  h+="</div>";
  h+='<div class="ddz-hand" id="ddzHand">'+(myHand?ddzSort(myHand).map(function(c){return ddzCardHTML(c)}).join(""):"")+"</div>";
  if(st.phase==="bid"&&order[st.bidTurn]===currentUser.id){h+='<div class="ddz-actions"><button class="ddz-btn" onclick="ddzBid(true)">叫地主</button><button class="ddz-btn pass" onclick="ddzBid(false)">不叫</button></div>';}
  else if(st.phase==="play"&&st.currentTurn===currentUser.id){h+='<div class="ddz-actions"><button class="ddz-btn" onclick="ddzPlay()">出牌</button>'+(st.lastPlay&&st.lastPlay.uid!==currentUser.id?'<button class="ddz-btn pass" onclick="ddzPass()">不要</button>':"")+"</div>";}
  h+="</div>";
  el.innerHTML=h;
  var handEl=document.getElementById("ddzHand");
  if(handEl){handEl.querySelectorAll(".ddz-card").forEach(function(c){c.onclick=function(){this.classList.toggle("sel");};});}
}
function ddzPeek(uid){
  if(!currentUser||!window.isAdmin(currentUser)){showToast("无权查看");return;}
  var game=state.room&&state.room.current_game;
  if(!game||game.type!=="doudizhu")return;
  var st=game.state||{};var hand=(st.hands&&st.hands[uid])||[];
  var p=(game.players||[]).find(function(x){return x.user_id===uid})||{};
  var old=document.getElementById("ddzPeekOverlay");if(old)old.remove();
  var ov=document.createElement("div");ov.id="ddzPeekOverlay";
  ov.style.cssText="position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:20px;";
  var box=document.createElement("div");
  box.style.cssText="background:linear-gradient(160deg,#155c33,#0a2e18);border:2px solid rgba(255,213,79,.5);border-radius:16px;padding:16px;max-width:92vw;max-height:80vh;overflow:auto;";
  var title=document.createElement("div");
  title.style.cssText="font-size:.9em;font-weight:800;color:#ffd54f;margin-bottom:10px;text-align:center;";
  title.textContent=(p.nickname||"")+" 的手牌（"+hand.length+"张）";
  box.appendChild(title);
  var handWrap=document.createElement("div");
  handWrap.style.cssText="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;";
  handWrap.innerHTML=ddzSort(hand).map(function(c){return ddzCardHTML(c)}).join("");
  box.appendChild(handWrap);
  var closeBtn=document.createElement("button");
  closeBtn.textContent="关闭";
  closeBtn.style.cssText="display:block;margin:14px auto 0;padding:9px 24px;border:none;border-radius:10px;background:#ffd54f;color:#3e2723;font-weight:800;cursor:pointer;font-family:inherit;";
  closeBtn.onclick=function(){ov.remove();};
  box.appendChild(closeBtn);
  ov.appendChild(box);
  ov.addEventListener("click",function(e){if(e.target===ov)ov.remove();});
  document.body.appendChild(ov);
}
window.ddzPeek=ddzPeek;
async function ddzBid(want){
  var game=state.room&&state.room.current_game;
  if(!game||game.type!=='doudizhu')return;
  var st=game.state;
  if(st.phase!=='bid')return;
  if(st.order[st.bidTurn]!==currentUser.id){showToast('还没轮到你');return}
  var ns=Object.assign({},st);
  ns.bids=Object.assign({},st.bids||{});
  ns.bids[currentUser.id]=want;
  if(want){
    ns.landlord=currentUser.id;ns.phase='play';ns.currentTurn=currentUser.id;
    var hands=Object.assign({},st.hands);
    hands[currentUser.id]=ddzSort((hands[currentUser.id]||[]).concat(st.bottom||[]));
    ns.hands=hands;ns.lastPlay=null;ns.lastPlays={};ns.passCount=0;
  }else{
    ns.bidCount=(st.bidCount||0)+1;ns.bidTurn=(st.bidTurn||0)+1;
    if(ns.bidCount>=3){
      var ids=st.order;var deck=ddzShuffle(ddzNewDeck());var hands2={};
      ids.forEach(function(uid,i){hands2[uid]=ddzSort(deck.slice(i*17,i*17+17))});
      ns.phase='bid';ns.hands=hands2;ns.bottom=deck.slice(51,54);ns.bidTurn=0;ns.bidCount=0;ns.bids={};
      showToast('三家都不叫，重新发牌');
    }
  }
  try{await updateGame(Object.assign({},game,{state:ns}))}catch(e){showToast('操作失败：'+e.message)}
}
window.ddzBid=ddzBid;
async function ddzPlay(){
  var game=state.room&&state.room.current_game;
  if(!game||game.type!=='doudizhu')return;
  var st=game.state;
  if(st.phase!=='play'||st.currentTurn!==currentUser.id)return;
  var handEl=document.getElementById('ddzHand');
  var sel=[];handEl.querySelectorAll('.ddz-card.sel').forEach(function(e){sel.push(parseInt(e.dataset.id,10))});
  if(!sel.length){showToast('请选择要出的牌');return}
  var type=ddzAnalyze(sel);
  if(!type){showToast('牌型不合法');return}
  var last=st.lastPlay;
  if(last&&last.uid!==currentUser.id&&!ddzCanBeat(type,last.typeInfo)){showToast('打不过上家');return}
  var ns=Object.assign({},st);
  var hands=Object.assign({},st.hands);
  var myHand=hands[currentUser.id]||[];
  var newHand=myHand.filter(function(c){return sel.indexOf(c)<0});
  hands[currentUser.id]=newHand;ns.hands=hands;
  ns.lastPlay={uid:currentUser.id,cards:ddzSort(sel).slice(),typeInfo:type};
  ns.lastPlays=Object.assign({},st.lastPlays||{});
  if(st.newRound){ns.lastPlays={};ns.newRound=false;}
  ns.lastPlays[currentUser.id]={cards:ddzSort(sel).slice(),typeInfo:type};
  ns.passCount=0;
  if(type.type==='bomb'||type.type==='rocket'){ns.multiplier=(st.multiplier||1)*2;}
  var order=st.order;var myIdx=order.indexOf(currentUser.id);
  ns.currentTurn=order[(myIdx+1)%order.length];
  if(newHand.length===0){
    ns.phase='finished';ns.winner=currentUser.id;
    ns.winnerSide=(currentUser.id===st.landlord)?'landlord':'farmer';
  }
  try{await updateGame(Object.assign({},game,{state:ns}))}catch(e){showToast('出牌失败：'+e.message)}
}
window.ddzPlay=ddzPlay;
async function ddzPass(){
  var game=state.room&&state.room.current_game;
  if(!game||game.type!=='doudizhu')return;
  var st=game.state;
  if(st.phase!=='play'||st.currentTurn!==currentUser.id)return;
  if(!st.lastPlay||st.lastPlay.uid===currentUser.id){showToast('你必须出牌');return}
  var ns=Object.assign({},st);
  var order=st.order;var myIdx=order.indexOf(currentUser.id);
  var nextUid=order[(myIdx+1)%order.length];
  ns.currentTurn=nextUid;ns.passCount=(st.passCount||0)+1;
  ns.lastPlays=Object.assign({},st.lastPlays||{});
  ns.lastPlays[currentUser.id]={pass:true};
  if(nextUid===st.lastPlay.uid){ns.lastPlay=null;ns.passCount=0;ns.newRound=true;}
  try{await updateGame(Object.assign({},game,{state:ns}))}catch(e){showToast('操作失败：'+e.message)}
}
window.ddzPass=ddzPass;



