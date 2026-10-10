
(function(){
  var currentUser = getSessionUser();
  if (!currentUser || !currentUser.id) { window.location.href = '/liuyanban/index.html'; return; }

  function fmtTime(t){
    var d = new Date(t);
    var now = new Date();
    var diff = (now - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff/60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff/3600) + ' 小时前';
    return d.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  async function loadBalance(){
    try {
      var r = await window.sb.from('users').select('coins').eq('id', currentUser.id).single();
      var c = (r.data && r.data.coins) || 0;
      document.getElementById('balanceNum').innerHTML = c + '<small>币</small>';
      // 同步本地缓存
      currentUser.coins = c;
      setSessionUser(currentUser);
    } catch(e){
      document.getElementById('balanceNum').innerHTML = '--<small>币</small>';
    }
  }

  async function loadTx(){
    var list = document.getElementById('txList');
    try {
      var r = await window.sb.from('coin_transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (r.error) throw r.error;
      var rows = r.data || [];
      if (!rows.length){
        list.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 10h8M8 14h5"/></svg><div>还没有任何收支记录</div></div>';
        return;
      }
      list.innerHTML = rows.map(function(t){
        var plus = t.amount >= 0;
        return '<div class="tx-item">' +
          '<div class="tx-info">' +
            '<div class="tx-reason">' + escapeHtml(t.reason || '调整') + '</div>' +
            '<div class="tx-time">' + fmtTime(t.created_at) + '</div>' +
          '</div>' +
          '<div class="tx-amount ' + (plus ? 'plus' : 'minus') + '">' + (plus ? '+' : '') + t.amount + '</div>' +
        '</div>';
      }).join('');
    } catch(e){
      list.innerHTML = '<div class="empty"><div>账单加载失败：' + escapeHtml(e.message) + '</div></div>';
    }
  }

  async function refreshAll(){ await loadBalance(); await loadTx(); }

  document.getElementById('refreshBtn').onclick = function(){ showToast('已刷新'); refreshAll(); };
  refreshAll();
})();
