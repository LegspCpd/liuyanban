
(function(){
  var currentUser = getSessionUser();
  if (!currentUser || !currentUser.id) { window.location.href = '/liuyanban/index.html'; return; }

  // 限时活动可选气泡（name + skin_id 对照）
  var GIFT_BUBBLES = [
    { id: 25, name: '流光边框' },
    { id: 26, name: '呼吸发光' },
    { id: 27, name: '渐变流动' },
    { id: 28, name: '微微浮动' },
    { id: 29, name: '闪光掠过' },
    { id: 30, name: '果冻弹跳' },
    { id: 8,  name: '烫金黑' },
    { id: 9,  name: '手写便签' },
    { id: 32, name: '液态流动' },
    { id: 34, name: '打字光标' },
    { id: 35, name: '猫爪' },
    { id: 36, name: '樱花' },
    { id: 37, name: '星星' },
    { id: 38, name: '兔耳' },
    { id: 17, name: '暗金' },
    { id: 40, name: '云朵' },
    { id: 41, name: '四叶草' },
    { id: 42, name: '月亮' },
    { id: 44, name: '彩虹云' }
  ];
  var GIFT_DEADLINE = new Date('2026-10-30T23:59:59+08:00');

  var dailyClaimed = false;   // 本次会话内是否已领过每日
  var bubbleClaimed = false;  // 是否已领过限时气泡
  var selectedBubble = null;

  function renderActivity(){
    var now = new Date();
    var giftEnded = now > GIFT_DEADLINE;
    var list = document.getElementById('actList');
    var html = '';

    // 每日登录（永久）
    html += '<div class="act-card">' +
      '<div class="ac-badge">永久</div>' +
      '<div class="ac-title"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>每日登录奖励</div>' +
      '<div class="ac-desc">每天登录即可随机获得 <b>1~8</b> 小七币，每个自然日限领一次。</div>' +
      '<button class="act-btn" id="dailyBtn" disabled>检测中…</button>' +
      '</div>';

    // 限时气泡（10/30 前）
    html += '<div class="act-card">' +
      '<div class="ac-badge' + (giftEnded ? ' ended' : '') + '">' + (giftEnded ? '已结束' : '限时') + '</div>' +
      '<div class="ac-title"><svg viewBox="0 0 24 24"><path d="M12 2l2.4 5.9 6.4.5-4.9 4.2 1.5 6.3L12 15.8 6.6 18.9l1.5-6.3L3.2 8.4l6.4-.5z"/></svg>限时·领取 30 天气泡</div>' +
      '<div class="ac-desc">' + (giftEnded ? '活动已结束，感谢参与～' : '在 <b>2026-10-30</b> 前，可从下方任选一款气泡，免费使用 <b>30 天</b>。每人限领一个。') + '</div>' +
      '<div class="ac-time">截止：2026-10-30 23:59</div>';
    if (!giftEnded && !bubbleClaimed) {
      html += '<div class="bubble-grid" id="bubbleGrid">' +
        GIFT_BUBBLES.map(function(b){
          return '<div class="bubble-item" data-id="' + b.id + '">' + b.name + '</div>';
        }).join('') +
        '</div>';
      html += '<button class="act-btn" id="giftBtn" disabled>请选择一款气泡</button>';
    } else if (bubbleClaimed) {
      html += '<button class="act-btn done" disabled>✓ 已领取</button>';
    }
    html += '</div>';

    list.innerHTML = html;

    // 每日按钮
    var dailyBtn = document.getElementById('dailyBtn');
    if (dailyClaimed) {
      dailyBtn.className = 'act-btn done';
      dailyBtn.textContent = '✓ 今日已领取';
      dailyBtn.disabled = true;
    } else {
      dailyBtn.disabled = false;
      dailyBtn.textContent = '领取今日奖励';
      dailyBtn.onclick = claimDaily;
    }

    // 气泡选择
    var grid = document.getElementById('bubbleGrid');
    if (grid) {
      grid.querySelectorAll('.bubble-item').forEach(function(el){
        el.onclick = function(){
          grid.querySelectorAll('.bubble-item').forEach(function(x){ x.classList.remove('selected'); });
          this.classList.add('selected');
          selectedBubble = parseInt(this.dataset.id, 10);
          var gb = document.getElementById('giftBtn');
          if (gb) { gb.disabled = false; gb.textContent = '领取该气泡'; }
        };
      });
      var gb = document.getElementById('giftBtn');
      if (gb) gb.onclick = claimBubble;
    }
  }

  async function claimDaily(){
    var btn = document.getElementById('dailyBtn');
    btn.disabled = true;
    try {
      var r = await window.sb.rpc('claim_daily_bonus', { p_user_id: currentUser.id });
      if (r.error) throw r.error;
      var d = r.data;
      if (d && d.ok) {
        dailyClaimed = true;
        showToast('恭喜获得 ' + d.amount + ' 小七币！');
        var u = await window.sb.from('users').select('coins').eq('id', currentUser.id).single();
        if (u.data) { currentUser.coins = u.data.coins; setSessionUser(currentUser); }
        renderActivity();
      } else if (d && d.already) {
        dailyClaimed = true;
        showToast('今天已经领过啦，明天再来～');
        renderActivity();
      } else {
        showToast((d && d.message) || '领取失败');
        btn.disabled = false;
      }
    } catch(e) { showToast('领取失败：' + e.message); btn.disabled = false; }
  }

  async function claimBubble(){
    if (!selectedBubble) { showToast('请先选择气泡'); return; }
    var btn = document.getElementById('giftBtn');
    btn.disabled = true;
    try {
      var r = await window.sb.rpc('claim_bubble_gift', { p_user_id: currentUser.id, p_skin_id: selectedBubble });
      if (r.error) throw r.error;
      var d = r.data;
      if (d && d.ok) {
        bubbleClaimed = true;
        var exp = new Date(d.expire_at).toLocaleDateString('zh-CN');
        showToast('领取成功！气泡有效至 ' + exp);
        renderActivity();
      } else {
        showToast((d && d.message) || '领取失败');
        btn.disabled = false;
      }
    } catch(e) { showToast('领取失败：' + e.message); btn.disabled = false; }
  }

  async function checkBubbleClaimed(){
    try {
      var r = await window.sb.from('bubble_gift_claims').select('id').eq('user_id', currentUser.id).limit(1);
      bubbleClaimed = (r.data && r.data.length > 0);
    } catch(e) { bubbleClaimed = false; }
  }

  async function init(){
    await checkBubbleClaimed();
    renderActivity();
    // 自动尝试领取每日（数据库时间判断，前端改时间无效）
    await claimDaily();
  }
  init();
})();
