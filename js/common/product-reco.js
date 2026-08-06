// ════════════════════════════════════════════════════════════════════
// product-reco.js — '다픽이 추천하는 다른 상품' 가로 카드 (2026-08-06 신설)
//
// 무엇을 하나
//   지금 보고 있는 상품과 같은 카테고리의 다른 상품을 가로로 늘어놓는다.
//   카테고리가 늘어도 이 파일은 안 고친다 — 카테고리 id 만 받으면 된다.
//
// 왜 공용으로 뺐나
//   상품 상세가 화면마다 따로 있다(product-detail · water-detail · rental-detail …).
//   각자 만들면 카드 모양이 다섯 벌이 되고, 나중에 카드 디자인을 바꿀 때
//   어디를 고쳐야 하는지 아무도 모르게 된다. product-faq.js 와 같은 판단이다.
//
// 쓰는 법 — 빈 칸 하나와 <script> 한 줄
//   <div id="pd-reco"></div>
//   <script src="js/common/product-reco.js"></script>
//   dpProductReco.mount(document.getElementById('pd-reco'), {
//     categoryId: '최상위 카테고리 id',
//     subIds: ['품목 id', ...],     // 선택. 있으면 그 안의 상품도 함께 모은다
//     excludeId: '지금 보고 있는 상품 id',
//     limit: 10,
//   });
//   → 상품이 하나도 없으면 칸을 통째로 숨긴다(빈 제목만 남으면 고장으로 읽힌다).
//   → 성공하면 onDone(개수) 을 부른다. 부르는 쪽이 섹션/탭을 띄울 때 쓴다.
//
// ★ 왜 카테고리 id 를 코드에 안 박나
//   로컬 DB 와 운영 DB 의 UUID 가 다르다. 박아 두면 한쪽에서만 안 나오고
//   오류도 안 나서 원인을 찾는 데 한참 걸린다(product-faq.js 와 같은 이유).
//
// 의존: api.js 필수. product-url.js 있으면 링크 규칙을 빌려 쓴다.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var _styled = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function arr(d) {
    return Array.isArray(d) ? d : (d && (d.data || d.content)) || [];
  }

  // 요금 표기.
  // suffix '~' 는 정수기처럼 약정에 따라 값이 달라지는 상품에 쓴다.
  // 정수기 목록 화면(water.js:403)이 이미 '월 N원~' 으로 쓰고 있어 그대로 맞춘다.
  // 표기를 다르게 하면 같은 상품의 값이 화면마다 달라 보인다.
  function feeHtml(v, suffix) {
    if (v == null || v === '') return '';
    var n = Number(v);
    if (!isFinite(n) || n <= 0) return '';
    return (
      '<div class="dpreco-fee">월 <b>' + n.toLocaleString('ko-KR') + '</b>원' +
      (suffix || '') + '</div>'
    );
  }

  // 상세로 가는 주소. 기본은 관리자 카테고리 상품(product-detail)이다.
  // 정수기처럼 전용 화면이 있는 쪽은 opts.hrefOf 로 규칙을 넘긴다.
  function defaultHref(p) {
    return '/product-detail?id=' + encodeURIComponent(p.id);
  }

  // ★ 카드 전체를 <a> 로 감싸지 않는다.
  //   안에 찜·비교 버튼이 들어가는데, <a> 안의 button 을 누르면 링크도 함께 열린다.
  //   (preventDefault 로 막을 수도 있지만 그러면 두 모듈이 서로의 사정을 알아야 한다.)
  //   그래서 링크 영역과 버튼 영역을 형제로 둔다.
  function cardHtml(p, opts) {
    var href = (opts.hrefOf ? opts.hrefOf(p) : defaultHref(p)) || defaultHref(p);
    var src = opts.imageOf ? opts.imageOf(p) : p.imageUrl;
    var img = src
      ? '<img src="' + esc(src) + '" alt="' + esc(p.name) + '" loading="lazy"/>'
      : '<span class="dpreco-noimg">이미지 준비중</span>';

    var fee =
      opts.showFee === false
        ? ''
        : feeHtml(opts.feeOf ? opts.feeOf(p) : p.monthlyFee, opts.feeSuffix);

    // 찜·비교는 부르는 쪽이 snapshotOf 를 넘길 때만 붙인다.
    // 무엇을 담을지(카테고리·조합)는 화면마다 다르고, 여기서 짐작하면 틀린 값이 담긴다.
    var acts = opts.snapshotOf
      ? '<div class="dpreco-acts" data-reco-id="' + esc(p.id) + '">' +
        '<div class="dpreco-fav"></div><div class="dpreco-cmp"></div></div>'
      : '';

    return (
      '<div class="dpreco-card">' +
      '<a class="dpreco-link" href="' + esc(href) + '">' +
      '<div class="dpreco-thumb">' + img + '</div>' +
      '<div class="dpreco-name">' + esc(p.name || '') + '</div>' +
      fee +
      '</a>' +
      acts +
      '</div>'
    );
  }

  // 카드마다 찜·비교 버튼을 붙인다.
  // 두 모듈 다 (mount, productId, config) 를 받아 mount 안을 스스로 그린다.
  function bindActions(box, rows, opts) {
    if (!opts.snapshotOf) return;
    var byId = {};
    rows.forEach(function (p) { byId[p.id] = p; });

    box.querySelectorAll('.dpreco-acts').forEach(function (wrap) {
      var id = wrap.getAttribute('data-reco-id');
      var p = byId[id];
      if (!p) return;

      var favEl = wrap.querySelector('.dpreco-fav');
      var cmpEl = wrap.querySelector('.dpreco-cmp');

      // 카드에 적힌 값과 담기는 값이 같아야 한다. 그래서 스냅샷은 한 번만 만들어 둘이 나눠 쓴다.
      var snap = opts.snapshotOf(p) || {};

      if (favEl && typeof window.dpFavInit === 'function') {
        window.dpFavInit(favEl, p.id, {
          state: function () { return snap; },
        });
      }
      if (cmpEl && typeof window.dpCompareInit === 'function') {
        window.dpCompareInit(cmpEl, p.id, {
          snapshot: function () { return snap; },
        });
      }
    });
  }

  // ── 그리기 ───────────────────────────────────────────────────────
  function render(box, rows, opts) {
    if (!rows.length) {
      box.hidden = true;
      if (typeof opts.onDone === 'function') opts.onDone(0);
      return;
    }
    injectStyles();
    box.hidden = false;
    box.classList.add('dpreco-box');
    box.innerHTML =
      '<button type="button" class="dpreco-nav dpreco-prev" aria-label="이전" hidden>‹</button>' +
      '<div class="dpreco-viewport"><div class="dpreco-track">' +
      rows.map(function (p) { return cardHtml(p, opts); }).join('') +
      '</div></div>' +
      '<button type="button" class="dpreco-nav dpreco-next" aria-label="다음" hidden>›</button>';

    bindScroll(box);
    bindActions(box, rows, opts);
    if (typeof opts.onDone === 'function') opts.onDone(rows.length);
  }

  // 좌우 버튼. 카드가 화면에 다 들어가면 버튼을 숨긴다 — 눌러도 안 움직이는 버튼은 고장으로 읽힌다.
  function bindScroll(box) {
    var vp = box.querySelector('.dpreco-viewport');
    var prev = box.querySelector('.dpreco-prev');
    var next = box.querySelector('.dpreco-next');
    if (!vp) return;

    function step() {
      var c = vp.querySelector('.dpreco-card');
      return (c ? c.getBoundingClientRect().width : 200) + 12;
    }
    function update() {
      var max = vp.scrollWidth - vp.clientWidth - 2;
      var over = max > 2;
      if (prev) prev.hidden = !over || vp.scrollLeft <= 2;
      if (next) next.hidden = !over || vp.scrollLeft >= max;
    }
    if (next) next.addEventListener('click', function () {
      vp.scrollBy({ left: step() * 2, behavior: 'smooth' });
    });
    if (prev) prev.addEventListener('click', function () {
      vp.scrollBy({ left: -step() * 2, behavior: 'smooth' });
    });
    vp.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    setTimeout(update, 60);
  }

  // ── 스타일 ───────────────────────────────────────────────────────
  // 화면마다 CSS 파일을 고치게 하면 붙일 때마다 두 곳을 손대야 한다.
  // product-faq.js · internet-reviews.js 와 같은 방식으로 이 파일이 직접 넣는다.
  function injectStyles() {
    if (_styled) return;
    _styled = true;
    var css =
      '.dpreco-box{position:relative;}' +
      '.dpreco-box[hidden]{display:none;}' +
      '.dpreco-viewport{overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-ms-overflow-style:none;}' +
      '.dpreco-viewport::-webkit-scrollbar{display:none;}' +
      '.dpreco-track{display:flex;gap:12px;padding:4px 2px 8px;}' +
      // 5개가 한 화면에 들어가는 너비. 좁아지면 자연스럽게 옆으로 넘어간다.
      '.dpreco-card{flex:0 0 calc((100% - 48px) / 5);min-width:160px;display:flex;flex-direction:column;' +
        'border:1px solid #eeecf5;border-radius:12px;padding:12px;background:#fff;' +
        'transition:box-shadow .16s,transform .16s;}' +
      '.dpreco-card:hover{box-shadow:0 6px 18px rgba(30,27,46,.10);transform:translateY(-2px);}' +
      '.dpreco-link{display:block;text-decoration:none;color:inherit;flex:1 1 auto;}' +
      '.dpreco-thumb{aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;' +
        'background:#faf9fd;border-radius:8px;overflow:hidden;margin-bottom:10px;}' +
      '.dpreco-thumb img{width:100%;height:100%;object-fit:contain;}' +
      '.dpreco-noimg{font-size:12px;color:#a09dba;}' +
      '.dpreco-name{font-size:13.5px;font-weight:600;color:#221f38;line-height:1.45;' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:39px;}' +
      '.dpreco-fee{margin-top:6px;font-size:13px;color:#5b3fbe;}' +
      '.dpreco-fee b{font-weight:800;}' +
      '.dpreco-nav{position:absolute;top:38%;z-index:2;width:34px;height:34px;border-radius:50%;' +
        'border:1px solid #e5e2f0;background:#fff;color:#4a4762;font-size:18px;line-height:1;' +
        'cursor:pointer;box-shadow:0 2px 10px rgba(30,27,46,.12);}' +
      '.dpreco-nav[hidden]{display:none;}' +
      '.dpreco-prev{left:-14px;}' +
      '.dpreco-next{right:-14px;}' +
      // 찜·비교는 공용 버튼(dp-fav-btn / dp-cmp-btn)을 그대로 쓴다.
      // 다만 그 기본 크기는 상세 화면용이라 카드 안에서는 너무 크다. 여기서만 줄인다.
      // ⚠ 두 파일의 스타일을 고치면 안 된다 — 상세 화면 버튼이 같이 작아진다.
      '.dpreco-acts{display:flex;gap:6px;margin-top:10px;}' +
      '.dpreco-acts > div{flex:1 1 0;min-width:0;}' +
      '.dpreco-acts .dp-fav-btn,.dpreco-acts .dp-cmp-btn{width:100%;padding:8px 6px;font-size:12px;' +
        'border-radius:9px;gap:4px;}' +
      '.dpreco-acts .dp-fav-ico,.dpreco-acts .dp-cmp-ico{font-size:13px;}' +
      // 좁은 카드에서 '비교함에 담김' 같은 긴 글자는 줄바꿈돼 버튼 높이가 들쭉날쭉해진다.
      '.dpreco-acts .dp-cmp-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '@media(max-width:900px){.dpreco-card{flex:0 0 46%;}.dpreco-nav{display:none;}}';
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ── 진입 ─────────────────────────────────────────────────────────
  //
  // 카테고리 하나만 부르면 '품목(자식)에 달린 상품'이 빠진다.
  // category.js 가 쓰는 방식과 같게, 최상위 + 품목들을 함께 부른다.
  // ⚠ 서버에 '하위 포함' 옵션이 없어서 여러 번 부른다. 품목이 수십 개로 늘면
  //   그때는 서버에 옵션을 넣는 편이 낫다 — 지금은 감당된다(category.js 와 같은 판단).
  function mount(box, opts) {
    if (!box) return;
    opts = opts || {};
    box.hidden = true;
    if (typeof api === 'undefined' || !api.get) return;

    function done(n) {
      if (typeof opts.onDone === 'function') opts.onDone(n);
    }

    // 두 가지 방식을 받는다.
    //   (가) opts.source  — 주소 하나로 전부 받아 opts.match 로 거른다.
    //        정수기처럼 상품이 다른 표(water_products)에 있고 카테고리별 조회가
    //        따로 없는 경우에 쓴다.
    //   (나) categoryId + subIds — /api/products?categoryId= 를 id 마다 부른다.
    var calls;
    if (opts.source) {
      calls = [api.get(opts.source).catch(function () { return []; })];
    } else {
      var ids = [];
      if (opts.categoryId) ids.push(opts.categoryId);
      (opts.subIds || []).forEach(function (id) {
        if (id && ids.indexOf(id) < 0) ids.push(id);
      });
      if (!ids.length) {
        done(0);
        return;
      }
      calls = ids.map(function (id) {
        return api
          .get('/api/products?categoryId=' + encodeURIComponent(id))
          .catch(function () { return []; });
      });
    }

    Promise.all(calls)
      .then(function (lists) {
        var seen = {};
        var rows = [];
        lists.forEach(function (l) {
          arr(l).forEach(function (p) {
            if (!p || !p.id) return;
            if (String(p.id) === String(opts.excludeId)) return;  // 지금 보고 있는 상품은 뺀다
            if (seen[p.id]) return;                // 최상위와 품목 양쪽에서 나올 수 있다
            if (p.isActive === false) return;      // 내린 상품은 안 보여준다
            if (opts.match && !opts.match(p)) return;
            seen[p.id] = 1;
            rows.push(p);
          });
        });
        rows.sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
        render(box, rows.slice(0, opts.limit || 10), opts);
      })
      .catch(function (e) {
        // 추천 때문에 상품 화면이 죽으면 안 된다. 칸만 조용히 접는다.
        console.warn('[product-reco] 로드 실패', e && e.message);
        box.hidden = true;
        done(0);
      });
  }

  window.dpProductReco = { mount: mount };
})();
