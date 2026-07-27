// ────────────────────────────────────────────────
// fav-button.js — 서버 찜(즐겨찾기) 버튼
// 의존: api.js(api.get/api.post), auth.js(isLoggedIn)
//
// 모드가 두 개다.
//  1) 단순 모드  dpFavInit(mount, productId)
//     상품 하나 = 화면 하나(정수기·렌탈). 기존 호출부가 이 모양 그대로다.
//     → GET /api/favorites/{id}/check , POST /api/favorites/{id}
//
//  2) 조합 모드  dpFavInit(mount, productId, { state: fn, variant: 'block' })
//     한 상품 안에서 옵션을 조합하는 카테고리(인터넷·TV).
//     state() 는 지금 화면의 조합을 { options, label, monthlyFee } 로 돌려준다.
//     → POST /api/favorites/option/check , POST /api/favorites/option/toggle
//     조합이 바뀌면 호출부가 handle.refresh() 를 불러 하트를 다시 맞춘다.
//
// 반환값: { refresh: fn, isOn: fn }  (단순 모드도 같은 모양으로 돌려준다)
//
// ※ water.js 의 로컬 favorites(비교바 선택용)와 무관한 별도 서버 찜.
// ────────────────────────────────────────────────
(function () {
  function authed() {
    try { if (typeof isLoggedIn === 'function') return isLoggedIn(); } catch (e) {}
    return !!localStorage.getItem('dapick_token');
  }
  function injectStyle() {
    if (document.getElementById('dp-fav-style')) return;
    var css =
      '.dp-fav-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1.5px solid #e2ddf0;background:#fff;color:#6a6880;border-radius:12px;padding:9px 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s,color .15s;}' +
      '.dp-fav-btn:hover{border-color:#c9bdf5;}' +
      '.dp-fav-btn:disabled{opacity:.6;cursor:default;}' +
      '.dp-fav-btn .dp-fav-ico{font-size:16px;line-height:1;}' +
      '.dp-fav-btn.is-on{background:#fdeef2;border-color:#f4b8c8;color:#e2437a;}' +
      // block: 신청하기 버튼 바로 위에 같은 폭으로 얹을 때.
      // 여백은 0 — 붙일지 띄울지는 얹는 페이지가 정한다(여기서 8px 주면 페이지가 그걸 되돌려야 한다).
      '.dp-fav-btn--block{display:flex;width:100%;padding:12px 16px;font-size:15px;border-radius:12px;margin:0;}';
    var s = document.createElement('style');
    s.id = 'dp-fav-style'; s.textContent = css;
    document.head.appendChild(s);
  }

  // 조합 지문 — 화면에서만 쓰는 캐시 키다.
  // 저장에 쓰는 진짜 키는 서버가 만든다(프론트가 만들면 같은 조합이 다른 키로 저장된다).
  function sigOf(options) {
    if (!options) return '';
    var keys = [];
    for (var k in options) {
      if (!Object.prototype.hasOwnProperty.call(options, k)) continue;
      var v = options[k];
      if (v === null || v === undefined || String(v) === '') continue;
      keys.push(k);
    }
    keys.sort();
    return keys.map(function (k) { return k + '=' + options[k]; }).join('');
  }

  window.dpFavInit = function (mount, productId, config) {
    if (!mount || !productId) return null;
    if (typeof api === 'undefined' || !api.get || !api.post) return null;
    injectStyle();

    var combo = !!(config && typeof config.state === 'function');

    mount.innerHTML = '';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dp-fav-btn' + (config && config.variant === 'block' ? ' dp-fav-btn--block' : '');
    btn.setAttribute('aria-label', '찜하기');
    mount.appendChild(btn);

    var on = false;
    var lastSig = null;   // 마지막으로 서버에 물어본 조합
    var reqSeq = 0;       // 늦게 온 응답이 최신 상태를 덮어쓰지 못하게 하는 표

    function paint() {
      btn.classList.toggle('is-on', on);
      btn.innerHTML =
        '<span class="dp-fav-ico">' + (on ? '♥' : '♡') + '</span>' +
        '<span class="dp-fav-txt">' + (on ? '찜 완료' : '찜하기') + '</span>';
    }

    function currentState() {
      if (!combo) return { options: null, label: null, monthlyFee: null };
      var s = config.state() || {};
      return {
        options: s.options || null,
        label: s.label || null,
        monthlyFee: (s.monthlyFee === 0 || s.monthlyFee) ? s.monthlyFee : null
      };
    }

    function check(force) {
      if (!authed()) { on = false; lastSig = null; paint(); return; }

      if (!combo) {
        var seqA = ++reqSeq;
        api.get('/api/favorites/' + productId + '/check')
          .then(function (res) {
            if (seqA !== reqSeq) return;
            on = !!(res && res.favorited); paint();
          })
          .catch(function () {});
        return;
      }

      var st = currentState();
      var sig = sigOf(st.options);
      if (!force && sig === lastSig) return;   // 같은 조합이면 다시 안 묻는다
      lastSig = sig;

      var seq = ++reqSeq;
      api.post('/api/favorites/option/check', { productId: productId, options: st.options })
        .then(function (res) {
          if (seq !== reqSeq) return;          // 그 사이 조합이 또 바뀌었다
          on = !!(res && res.favorited); paint();
        })
        .catch(function () {});
    }

    function toggle() {
      if (!authed()) {
        if (confirm('로그인이 필요한 기능입니다. 로그인하시겠어요?')) {
          // 로그인 후 보던 상품으로 돌아오게 한다 (auth.js)
          if (typeof saveReturnUrl === 'function') saveReturnUrl();
          location.href = '/login';
        }
        return;
      }
      btn.disabled = true;

      var url, body;
      if (combo) {
        var st = currentState();
        url = '/api/favorites/option/toggle';
        body = {
          productId: productId,
          label: st.label,
          monthlyFee: st.monthlyFee,
          options: st.options
        };
        lastSig = sigOf(st.options);
      } else {
        url = '/api/favorites/' + productId;
        body = {};
      }

      var seq = ++reqSeq;
      api.post(url, body)
        .then(function (res) {
          btn.disabled = false;
          if (seq !== reqSeq) return;
          on = !!(res && res.favorited); paint();
        })
        .catch(function (e) {
          btn.disabled = false;
          alert((e && e.message) || '처리에 실패했습니다.');
        });
    }

    paint();
    check(true);
    btn.addEventListener('click', toggle);

    return {
      // 조합이 바뀐 뒤 호출한다. 같은 조합이면 요청을 안 보낸다.
      refresh: function () { check(false); },
      isOn: function () { return on; }
    };
  };
})();
