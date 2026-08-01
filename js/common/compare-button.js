// ────────────────────────────────────────────────
// compare-button.js — 비교함 담기 버튼 + 로컬 저장소
// 의존: 없음 (서버 비교함 API 가 아직 없다)
//
//   dpCompareInit(mount, productId, { snapshot: fn })
//   snapshot() → { category, name, model, image, label, monthlyFee, options }
//     category  'INTERNET_TV' | 'WATER' | 'RENTAL'
//     options   찜(favOptions/wdFavState)이 쓰는 것과 같은 객체
//     label     지금 고른 조합 요약(찜의 label 과 같은 문자열)
//
// ★ 담는 단위는 '조합'이다(상품 아님).
//   같은 정수기의 3년 vs 6년, 같은 통신사의 기가1G vs 기가500M 을
//   나란히 놓고 월 요금을 보는 게 이 기능의 목적이다.
//   그래서 항목 키 = productId + 옵션서명. 찜(option_key)과 같은 사고방식.
//
// ★ 카테고리는 완전히 분리된 서랍이다.
//   인터넷·TV / 정수기 / 렌탈은 비교할 항목 자체가 달라서 한 표에 못 올린다.
//   섞이지 않으니 "다른 카테고리를 비우시겠습니까" 같은 질문도 없다.
//
// 저장 위치: localStorage['dapick_compare']
//   { INTERNET_TV: [item...], WATER: [...], RENTAL: [...] }  카테고리당 최대 3
// ※ 서버에 안 남는다 → 기기/브라우저를 바꾸면 목록이 사라진다.
//    나중에 서버로 옮길 때 이 파일의 read/write 만 갈아끼우면 된다.
//
// 화면(하단 트레이·비교 시트·마이페이지 비교함 탭)은 compare-view.js 가 그린다.
// URL 은 여기서 안 만든다 — 만드는 곳은 product-url.js 한 곳뿐이다.
// 담기/빼기가 일어나면 window 에 'dp-compare-change' 를 쏜다(듣는 쪽: compare-view.js).
// ────────────────────────────────────────────────
(function () {
  var KEY = 'dapick_compare';
  var MAX = 3; // 카테고리당
  // GENERIC = 관리자가 만든 카테고리의 상품(에어컨·안마의자 …). 2026-08-01 추가.
  // 서랍을 하나 더 늘린 이유 - 에어컨과 정수기는 비교할 항목이 아예 달라서 한 표에 못 올린다.
  // 여기 없는 카테고리로 담으려 하면 addItem 이 reason:'bad' 로 조용히 거절한다.
  var CATS = ['INTERNET_TV', 'WATER', 'RENTAL', 'GENERIC'];

  function emptyBox() {
    return { INTERNET_TV: [], WATER: [], RENTAL: [], GENERIC: [] };
  }

  function read() {
    var box = emptyBox();
    var raw;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    if (!raw) return box;

    // 예전 형식(카테고리 구분 없는 배열) → 카테고리별로 나눠 담는다.
    if (Array.isArray(raw)) {
      raw.forEach(function (x) {
        if (x && box[x.category]) box[x.category].push(normalize(x));
      });
      write(box);
      return box;
    }
    CATS.forEach(function (c) {
      if (Array.isArray(raw[c])) {
        box[c] = raw[c].filter(Boolean).map(normalize).slice(0, MAX);
      }
    });
    return box;
  }

  function write(box) {
    try { localStorage.setItem(KEY, JSON.stringify(box)); } catch (e) {}
  }

  // 담기/빼기/비우기가 일어났다고 알린다 — 하단 트레이·비교표가 이걸 듣는다.
  // ★ write() 안에 넣으면 안 된다. read() 가 예전 형식을 옮기며 write() 를
  //   부르는데, 그 순간 알림이 나가면 듣는 쪽이 다시 read() → 재귀가 된다.
  //   그래서 '사용자가 바꾼 자리'에서만 쏜다.
  function notify() {
    try {
      var ev;
      if (typeof window.CustomEvent === 'function') ev = new window.CustomEvent('dp-compare-change');
      else { ev = document.createEvent('Event'); ev.initEvent('dp-compare-change', false, false); }
      window.dispatchEvent(ev);
    } catch (e) {}
  }

  // 옵션 서명 — 키 순서가 달라도 같은 조합이면 같은 문자열이 나와야 한다.
  function sigOf(options) {
    if (!options) return '';
    var keys = [];
    for (var k in options) {
      if (!Object.prototype.hasOwnProperty.call(options, k)) continue;
      var v = options[k];
      if (v === null || v === undefined || v === '') continue;
      keys.push(k);
    }
    keys.sort();
    return keys.map(function (k) { return k + '=' + options[k]; }).join('&');
  }

  function keyOf(productId, options) {
    return String(productId) + '|' + sigOf(options);
  }

  function normalize(x) {
    var opts = x.options && typeof x.options === 'object' ? x.options : {};
    return {
      key: x.key || keyOf(x.id, opts),
      id: x.id,
      category: x.category || '',
      name: x.name || '',
      model: x.model || '',
      image: x.image || '',
      label: x.label || '',
      monthlyFee: (x.monthlyFee === 0 || x.monthlyFee) ? x.monthlyFee : null,
      options: opts,
    };
  }

  function indexOf(list, key) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].key === key) return i;
    }
    return -1;
  }

  // 담는 길은 이 함수 하나다. 상세 버튼(toggle)도, 트레이의 '+' 고르기도
  // 전부 여기를 지난다 — 개수 제한/중복 검사가 두 벌이 되면 반드시 어긋난다.
  // 반환: { ok, reason } reason 은 'bad'(카테고리 없음) | 'dup' | 'full'
  function addItem(x) {
    var item = x && x.category ? normalize(x) : null;
    if (!item || !item.category) return { ok: false, reason: 'bad' };
    var box = read();
    var list = box[item.category];
    if (!list) return { ok: false, reason: 'bad' };
    if (indexOf(list, item.key) >= 0) return { ok: false, reason: 'dup', item: item };
    if (list.length >= MAX) return { ok: false, reason: 'full', item: item };
    list.push(item);
    write(box);
    notify();
    return { ok: true, item: item };
  }

  // ── 화면이 쓰는 읽기/담기/지우기 API ─────────────────
  window.dpCompareStore = {
    CATS: CATS,
    MAX: MAX,
    keyOf: keyOf,
    add: addItem,
    has: function (cat, key) { return indexOf(read()[cat] || [], key) >= 0; },
    all: function () { return read(); },
    list: function (cat) { return read()[cat] || []; },
    count: function (cat) { return (read()[cat] || []).length; },
    total: function () {
      var box = read(), n = 0;
      CATS.forEach(function (c) { n += box[c].length; });
      return n;
    },
    remove: function (cat, key) {
      var box = read();
      if (!box[cat]) return;
      var at = indexOf(box[cat], key);
      if (at < 0) return;
      box[cat].splice(at, 1);
      write(box);
      notify();
    },
    clear: function (cat) {
      var box = read();
      if (cat) box[cat] = []; else box = emptyBox();
      write(box);
      notify();
    },
  };

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
      '.dp-cmp-btn.is-on{background:#eef2fd;border-color:#b9c7f5;color:#3f56c4;}' +
      '.dp-cmp-btn--block{display:flex;width:100%;padding:12px 16px;font-size:15px;}';
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
    btn.className = 'dp-cmp-btn' + (config && config.variant === 'block' ? ' dp-cmp-btn--block' : '');
    btn.setAttribute('aria-label', '비교함에 담기');
    mount.appendChild(btn);

    var on = false;

    function paint() {
      btn.classList.toggle('is-on', on);
      btn.innerHTML =
        '<span class="dp-cmp-ico">' + (on ? '✓' : '+') + '</span>' +
        '<span class="dp-cmp-txt">' + (on ? '비교함에 담김' : '비교하기') + '</span>';
    }

    // 지금 화면의 조합으로 항목을 만든다. category 가 없으면 담을 서랍이 없다.
    function current() {
      var s = (snap && snap()) || {};
      var cat = s.category || '';
      if (!cat) return null;
      var opts = s.options && typeof s.options === 'object' ? s.options : {};
      return normalize({
        key: keyOf(productId, opts),
        id: productId, category: cat, name: s.name, model: s.model,
        image: s.image, label: s.label, monthlyFee: s.monthlyFee, options: opts,
      });
    }

    function toggle() {
      var item = current();
      if (!item) return;
      // 이미 담겨 있으면 빼기, 아니면 담기 — 둘 다 저장소의 한 길로 보낸다.
      if (indexOf(read()[item.category] || [], item.key) >= 0) {
        window.dpCompareStore.remove(item.category, item.key);
        on = false;
        paint();
        return;
      }
      var r = addItem(item);
      if (!r.ok) {
        if (r.reason === 'full') {
          alert('비교는 ' + MAX + '개까지 담을 수 있습니다.\n비교함에서 하나를 빼고 다시 담아주세요.');
        }
        return;
      }
      on = true;
      paint();
    }

    // 하단 3칸 트레이는 '이 페이지의 카테고리' 로만 띄운다.
    // → 인터넷·TV 상세에서는 인터넷·TV 서랍만 보인다(카테고리 잠금).
    // 마이페이지는 dpCompareInit 을 안 부르므로 트레이가 생기지 않는다.
    var trayCat = null;
    function mountTray(cat) {
      if (!cat || cat === trayCat) return;
      if (!window.dpCompareView || typeof window.dpCompareView.mountTray !== 'function') return;
      trayCat = cat;
      window.dpCompareView.mountTray(cat);
    }

    // 조합이 바뀌면 버튼 상태도 따라가야 한다(같은 상품이라도 다른 조합은 다른 항목).
    function refresh() {
      var item = current();
      on = !!item && indexOf(read()[item.category] || [], item.key) >= 0;
      paint();
      if (item) mountTray(item.category);
    }

    refresh();
    btn.addEventListener('click', toggle);
    // 트레이에서 빼도 이 버튼이 '담김' 으로 남아 있으면 안 된다.
    window.addEventListener('dp-compare-change', refresh);

    return { refresh: refresh, isOn: function () { return on; } };
  };
})();
