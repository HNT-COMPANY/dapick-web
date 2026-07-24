// ────────────────────────────────────────────────
// fav-button.js — 서버 즐겨찾기(찜) 버튼 (water/rental 상세 공용)
// 의존: api.js(api.get/post), auth.js(isLoggedIn)
// 사용: dpFavInit(mountEl, productId)   // productId = 상품 UUID
// ※ water.js 의 로컬 favorites(비교 선택용)와 무관한 별도 서버 찜.
// ────────────────────────────────────────────────
(function () {
  function authed() {
    try { if (typeof isLoggedIn === 'function') return isLoggedIn(); } catch (e) {}
    return !!localStorage.getItem('dapick_token');
  }
  function injectStyle() {
    if (document.getElementById('dp-fav-style')) return;
    var css =
      '.dp-fav-btn{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #e2ddf0;background:#fff;color:#6a6880;border-radius:12px;padding:9px 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s,color .15s;}' +
      '.dp-fav-btn:hover{border-color:#c9bdf5;}' +
      '.dp-fav-btn:disabled{opacity:.6;cursor:default;}' +
      '.dp-fav-btn .dp-fav-ico{font-size:16px;line-height:1;}' +
      '.dp-fav-btn.is-on{background:#fdeef2;border-color:#f4b8c8;color:#e2437a;}';
    var s = document.createElement('style');
    s.id = 'dp-fav-style'; s.textContent = css;
    document.head.appendChild(s);
  }
  window.dpFavInit = function (mount, productId) {
    if (!mount || !productId) return;
    if (typeof api === 'undefined' || !api.get || !api.post) return;
    injectStyle();
    mount.innerHTML = '';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dp-fav-btn';
    btn.setAttribute('aria-label', '즐겨찾기');
    mount.appendChild(btn);
    var on = false;
    function paint() {
      btn.classList.toggle('is-on', on);
      btn.innerHTML =
        '<span class="dp-fav-ico">' + (on ? '♥' : '♡') + '</span>' +
        '<span class="dp-fav-txt">' + (on ? '찜 완료' : '찜') + '</span>';
    }
    paint();
    if (authed()) {
      api.get('/api/favorites/' + productId + '/check')
        .then(function (res) { on = !!(res && res.favorited); paint(); })
        .catch(function () {});
    }
    btn.addEventListener('click', function () {
      if (!authed()) {
        if (confirm('로그인이 필요한 기능입니다. 로그인하시겠어요?')) location.href = '/login';
        return;
      }
      btn.disabled = true;
      api.post('/api/favorites/' + productId, {})
        .then(function (res) { on = !!(res && res.favorited); paint(); btn.disabled = false; })
        .catch(function (e) { btn.disabled = false; alert((e && e.message) || '처리에 실패했습니다.'); });
    });
  };
})();
