
var SKINS = ["原版","经典圆角","暗夜霓虹","渐变紫","粉嫩","毛玻璃","新拟态","星空","烫金黑","手写便签","立体凸起","极光","莫兰迪","赛博绿","果冻","渐变描边","亚克力","暗金","泡泡渐变","樱桃红","黑白","微信绿","磨砂蓝","梦幻紫粉","霓虹白底","✨流光边框","✨呼吸发光","✨渐变流动","✨微微浮动","✨闪光掠过","✨果冻弹跳","✨星星闪烁","✨液态流动","✨霓虹脉冲","✨打字光标","🐱猫爪","🌸樱花","⭐星星","🐰兔耳","💗爱心","☁️云朵","🍀四叶草","🌙月亮","🎀蝴蝶结","🌈彩虹云"];

var currentUser = null;
var coinBalance = 0;
var currentSkin = 0;  // 当前装备的气泡 skin_id
var shopTab = 'all';  // 'all' | 'owned'
var prices = {};
var owned = {};
var buyingSkin = null;
var buyMode = 'buy';   // 'buy' | 'equip' | 'inuse'
var buySkinId = 0;

async function init(){
  currentUser = getSessionUser();
  if(!currentUser){
    document.getElementById('shopGrid').innerHTML = '<div class="loading-state">请先登录后查看皮肤商店</div>';
    return;
  }
  // 刷新余额（防止本地缓存旧值）
  try{
    var uq = await window.sb.from('users').select('coins, bubble_skin').eq('id', currentUser.id).limit(1);
    coinBalance = (uq.data && uq.data[0] && uq.data[0].coins) || 0;
    currentSkin = (uq.data && uq.data[0] && typeof uq.data[0].bubble_skin === 'number') ? uq.data[0].bubble_skin : 0;
  }catch(e){ coinBalance = currentUser.coins || 0; }
  document.getElementById('coinNum').textContent = coinBalance;

  await Promise.all([loadPrices(), loadOwned(), loadActivities()]);
  renderGrid();
}

var discount = 0;    // 当前活动折扣（几折），0 表示无折扣

async function loadPrices(){
  try{
    var r = await window.sb.from('skin_prices').select('*');
    if(r.error) throw r.error;
    (r.data||[]).forEach(function(p){ prices[p.skin_id] = p; });
  }catch(e){ console.warn('loadPrices failed', e); }
}
async function loadOwned(){
  try{
    var r = await window.sb.from('skin_purchases').select('skin_id,expire_at').eq('user_id', currentUser.id);
    if(r.error) throw r.error;
    (r.data||[]).forEach(function(p){
      var ms = new Date(p.expire_at).getTime();
      if(!owned[p.skin_id] || ms > owned[p.skin_id]) owned[p.skin_id] = ms;
    });
  }catch(e){ console.warn('loadOwned failed', e); }
}
async function loadActivities(){
  try{
    var r = await window.sb.from('shop_activities').select('*').eq('active', true).order('created_at', {ascending:false});
    if(r.error) throw r.error;
    var now = Date.now();
    var list = r.data || [];
    var a = null;
    for(var k=0;k<list.length;k++){
      var it = list[k];
      if(it.start_at && new Date(it.start_at).getTime() > now) continue;
      if(it.end_at && new Date(it.end_at).getTime() < now) continue;
      a = it; break;
    }
    if(!a) return;
    discount = (a.discount > 0 && a.discount < 10) ? a.discount : 0;
    var banner = document.getElementById('actBanner');
    banner.innerHTML = '<div class="act-title">'+escapeHtml(a.title)+'</div>'+
      (a.description ? '<div class="act-desc">'+escapeHtml(a.description)+'</div>' : '')+
      (discount ? '<span class="act-off">限时 '+discount+' 折</span>' : '');
    banner.classList.add('show');
  }catch(e){ console.warn('loadActivities failed', e); }
}

function finalPrice(base){
  if(discount > 0 && discount < 10) return Math.max(1, Math.round(base * discount / 10));
  return base;
}

function switchShopTab(t){
  shopTab = t;
  document.querySelectorAll('.shop-tab').forEach(function(b){ b.classList.toggle('active', b.dataset.tab === t); });
  renderGrid();
}
function renderGrid(){
  var grid = document.getElementById('shopGrid');
  var html = '';
  var now = Date.now();
  SKINS.forEach(function(name, i){
    var p = prices[i] || {price:100, duration_days:30};
    var isFree = (i === 0);
    var exp = owned[i];
    var isOwned = (isFree || (exp && exp > now));
    var isExpired = exp && exp <= now;
    var isInUse = (i === currentSkin);
    // 已拥有 tab 只显示已拥有（含原版）
    if(shopTab === 'owned' && !isOwned) return;
    var fp = finalPrice(p.price);
    var hasOff = fp < p.price;
    var priceLabel;
    if(isFree){
      priceLabel = '<span class="price-row free">免费</span>';
    } else if(hasOff){
      priceLabel = '<span class="price-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h5M9.5 14.5h5"/></svg><s style="opacity:.5;font-weight:600">'+p.price+'</s> '+fp+' 小七币</span>';
    } else {
      priceLabel = '<span class="price-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h5M9.5 14.5h5"/></svg>'+p.price+' 小七币</span>';
    }
    var tag = isInUse ? '<span class="state-tag inuse">使用中</span>' : (isOwned ? '<span class="state-tag owned">已拥有</span>' : (isExpired ? '<span class="state-tag expired">已过期</span>' : ''));
    var expText = (isOwned && !isFree) ? '<span class="expire-text">有效期至 '+fmtExpire(exp)+'</span>' : '';
    var ph = 56 + (i % 4) * 24;
    html += '<div class="shop-card b'+i+' '+(isOwned?'owned':'')+' '+(isInUse?'inuse':'')+'" data-skin="'+i+'" onclick="onCardClick('+i+')">'+
      tag +
      '<div class="preview" style="min-height:'+ph+'px"><span class="row self"><span class="bubble">选择你的气泡</span></span></div>'+
      '<div class="info">'+
        '<div class="name">'+escapeHtml(name)+'</div>'+
        priceLabel + expText +
      '</div>'+
      '</div>';
  });
  grid.innerHTML = html;
}

function onCardClick(i){
  var now = Date.now();
  var exp = owned[i];
  var isFree = (i === 0);
  var isOwned = (isFree || (exp && exp > now));
  var isInUse = (i === currentSkin);
  var p = prices[i] || {price:100, duration_days:30};
  var fp = finalPrice(p.price);
  var canBuy = !isFree && !isOwned && coinBalance >= fp;

  buyingSkin = (isFree || isOwned) ? null : i;
  buyMode = isInUse ? 'inuse' : (isOwned ? 'equip' : 'buy');
  buySkinId = i;

  // 预览舞台：左（对方）右（自己）双气泡
  var stage = document.getElementById('previewStage');
  stage.className = 'preview-stage b'+i+' '+(isOwned?'self':'');
  stage.innerHTML =
    '<span class="row other"><span class="bubble">在吗？</span></span>' +
    '<span class="row self"><span class="bubble">你好呀</span></span>';

  document.getElementById('buyTitle').textContent = SKINS[i];

  // 描述 + 按钮状态
  var okBtn = document.getElementById('buyOk');
  var desc = document.getElementById('buyDesc');
  if(isInUse){
    desc.innerHTML = '当前使用中';
    okBtn.textContent = '使用中'; okBtn.disabled = true;
  } else if(isFree){
    desc.innerHTML = '原版皮肤，免费使用';
    okBtn.textContent = '使用原版'; okBtn.disabled = false;
  } else if(isOwned){
    desc.innerHTML = '已拥有该皮肤<br><span style="color:var(--text-light);font-size:.9em">有效期至 '+fmtExpire(exp)+'</span>';
    okBtn.textContent = '使用'; okBtn.disabled = false;
  } else {
    var priceHtml = fp < p.price
      ? '价格：<b>'+fp+' 小七币</b>（原价 <s>'+p.price+'</s>）'
      : '价格：<b>'+fp+' 小七币</b>';
    var warn = coinBalance < fp
      ? '<br><span style="color:#c62828">小七币不足，还差 '+(fp-coinBalance)+' 币</span>'
      : '<br>购买后余额：'+(coinBalance-fp)+' 币';
    desc.innerHTML = priceHtml+'<br>有效期：'+p.duration_days+' 天'+warn;
    okBtn.textContent = coinBalance < fp ? '余额不足' : '购买';
    okBtn.disabled = !canBuy;
  }

  document.getElementById('buyModal').classList.add('active');
}
function closeBuy(){ document.getElementById('buyModal').classList.remove('active'); buyingSkin=null; }

document.getElementById('buyOk').addEventListener('click', async function(){
  var i = buySkinId;
  // 装备模式（原版 / 已拥有）
  if(buyMode === 'equip'){
    this.disabled = true; this.textContent = '处理中…';
    try{
      var er = await window.sb.rpc('equip_skin', { p_user_id: currentUser.id, p_skin_id: i });
      if(er.error) throw er.error;
      var eres = er.data || {};
      if(!eres.ok) throw new Error(eres.message || '切换失败');
      currentSkin = i;
      currentUser.bubble_skin = i;
      setSessionUser(currentUser);
      closeBuy(); renderGrid();
      showToast('已切换为「'+SKINS[i]+'」');
    }catch(e){ showToast('切换失败：'+(e.message||e)); }
    finally{ this.disabled = false; }
    return;
  }
  if(buyingSkin === null){ closeBuy(); return; }
  this.disabled = true; this.textContent = '处理中…';
  try{
    // 调用数据库原子函数：校验余额 + 扣币 + 写记录在一个事务内完成
    var r = await window.sb.rpc('buy_skin', { p_user_id: currentUser.id, p_skin_id: i });
    if(r.error) throw r.error;
    var res = r.data || {};
    if(!res.ok) throw new Error(res.message || '购买失败');
    coinBalance = res.balance;
    owned[i] = new Date(res.expire_at).getTime();
    if(typeof res.bubble_skin === 'number') currentSkin = res.bubble_skin;
    currentUser.bubble_skin = currentSkin;
    document.getElementById('coinNum').textContent = coinBalance;
    // 同步本地缓存
    currentUser.coins = coinBalance;
    setSessionUser(currentUser);
    closeBuy();
    renderGrid();
    showToast('购买成功！「'+SKINS[i]+'」已解锁');
  }catch(e){
    showToast('购买失败：'+(e.message||e));
  }finally{
    this.disabled = false; this.textContent = '确认购买';
  }
});

init();
