// ────────────────────────────────────────────────
// compare-button.js — 비교함 담기 버튼 (로컬 저장)
// 의존: 없음 (api.js 불필요 — 서버 비교함 API 가 아직 없다)
//
//   dpCompareInit(mount, productId, { snapshot: fn })
//   snapshot() → { category, name, model, image, label, monthlyFee }
//     category  'WATER' | 'RENTAL' … 서로 다른 카테고리는 섞어 담지 않는다.
//     label     지금 고른 조합 요약(찜의 label 과 같은 문자열을 쓰면 된다)
//
// 저장 위치: localStorage['dapick_compare']  (최대 3개)
// ※ 서버에 안 남는다 → 기기/브라우저를 바꾸면 목록이 사라진다.
//    비교함 화면(마이페이지 탭)이 아직 준비중이라 담기만 하고 볼 데가 없다.
//    화면을 붙일 때 이 저장소를 서버로 옮길지 다시 정한다.
//
// 반환값: { refresh: fn, isOn: fn }  (fav-button.js 와 같은 모양)
// ────────────────────────────────────────────────
(function () {
  var KEY = 'dapick_compare';
  var MAX = 3;

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  function injectStyle() {
    if (document.getElementById('dp-cmp-style')) return;
    // 찜 버튼(.dp-fav-btn)과 같은 뼈대. 색만 중립으로 둬서 찜(분홍)과 안 겹치게 한다.
    var css =
      '.dp-cmp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;' +
      'border:1.5px solid #e2ddf0;background:#fff;color:#6a6880;border-radius:12px;' +
      'padding:9px 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;' +
      'transition:border-color .15s,background .15s,color .15s;}' +
      '.dp-cmp-btn:hover{border-color:#c9bdf5;}' +
      '.dp-cmp-btn .dp-cmp-ico{font-size:15px;line-height:1;}' +
      '.dp-cmp-btn.is-on{background:#eef2fd;border-color:#b9c7f5;color:#3f56c4;}';
    var s = document.createElement('style');
    s.id = 'dp-cmp-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  window.dpCompareInit = function (mount, productId, config) {
    if (!mount || !productId) return null;
    injectStyle();

    var snap = config && typeof config.snapshot === 'function' ? config.snapshot : null;

    mount.innerHTML = '';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dp-cmp-btn';
    btn.setAttribute('aria-label', '비교함에 담기');
    mount.appendChild(btn);

    var on = false;

    function paint() {
      btn.classList.toggle('is-on', on);
      btn.innerHTML =
        '<span class="dp-cmp-ico">' + (on ? '✓' : '+') + '</span>' +
        '<span class="dp-cmp-txt">' + (on ? '비교함에 담김' : '비교하기') + '</span>';
    }

    function indexOf(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === productId) return i;
      }
      return -1;
    }

    function toggle() {
      var list = read();
      var at = indexOf(list);

      if (at >= 0) {
        list.splice(at, 1);
        write(list);
        on = false;
        paint();
        return;
      }

      var s = (snap && snap()) || {};
      var cat = s.category || '';

      // 정수기와 렌탈을 나란히 놓아봐야 비교할 항목이 안 맞는다 → 한 카테고리만 담는다.
      var other = list.filter(function (x) { return x && x.category && x.category !== cat; });
      if (other.length) {
        if (!confirm('비교함에 다른 카테고리 상품이 담겨 있습니다. 비우고 이 상품을 담을까요?')) return;
        list = [];
      }

      if (list.length >= MAX) {
        alert('비교는 최대 ' + MAX + '개까지 담을 수 있습니다.');
        return;
      }

      list.push({
        id: productId,
        category: cat,
        name: s.name || '',
        model: s.model || '',
        image: s.image || '',
        label: s.label || '',
        monthlyFee: (s.monthlyFee === 0 || s.monthlyFee) ? s.monthlyFee : null,
        url: location.pathname + location.search
      });
      write(list);
      on = true;
      paint();
    }

    function refresh() {
      on = indexOf(read()) >= 0;
      paint();
    }

    refresh();
    btn.addEventListener('click', toggle);

    return { refresh: refresh, isOn: function () { return on; } };
  };
})();
