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

  function feeHtml(v) {
    if (v == null || v === '') return '';
    var n = Number(v);
    if (!isFinite(n) || n <= 0) return '';
    return '<div class="dpreco-fee">월 <b>' + n.toLocaleString('ko-KR') + '</b>원</div>';
  }

  // 상세로 가는 주소. 기본은 관리자 카테고리 상품(product-detail)이다.
  // 정수기처럼 전용 화면이 있는 쪽은 opts.hrefOf 로 규칙을 넘긴다.
  function defaultHref(p) {
    return '/product-detail?id=' + encodeURIComponent(p.id);
  }

  function cardHtml(p, opts) {
    var href = (opts.hrefOf ? opts.hrefOf(p) : defaultHref(p)) || defaultHref(p);
    var src = opts.imageOf ? opts.imageOf(p) : p.imageUrl;
    var img = src
      ? '<img src="' + esc(src) + '" alt="' + esc(p.name) + '" loading="lazy"/>'
      : '<span class="dpreco-noimg">이미지 준비중</span>';

    // ⚠ 요금은 '확실할 때만' 보여준다.
    //   정수기처럼 약정에 따라 값이 달라지는 상품은 여기서 아무 숫자나 고르면
    //   목록과 상세의 금액이 달라진다. 그런 화면은 showFee 를 켜지 않는다.
    var fee = opts.showFee === false ? '' : feeHtml(opts.feeOf ? opts.feeOf(p) : p.monthlyFee);

    return (
      '<a class="dpreco-card" href="' + esc(href) + '">' +
      '<div class="dpreco-thumb">' + img + '</div>' +
      '<div class="dpreco-name">' + esc(p.name || '') + '</div>' +
      fee +
      '</a>'
    );
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
      '.dpreco-card{flex:0 0 calc((100% - 48px) / 5);min-width:150px;display:block;text-decoration:none;' +
        'color:inherit;border:1px solid #eeecf5;border-radius:12px;padding:12px;background:#fff;' +
        'transition:box-shadow .16s,transform .16s;}' +
      '.dpreco-card:hover{box-shadow:0 6px 18px rgba(30,27,46,.10);transform:translateY(-2px);}' +
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
      '@media(max-width:900px){.dpreco-card{flex:0 0 42%;}.dpreco-nav{display:none;}}';
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
