// ════════════════════════════════════════════════════
// site-banner.js — 카테고리 공용 상단 배너(캐러셀)
// 사용: <section class="sb" data-banner-category="INTERNET" hidden> ...스켈레톤... </section>
// GET /api/banners?category= → 활성 배너 주입. 0장이면 영역 숨김.
// 2장 이상이면 화살표/점/자동전환(5s)/hover정지/스와이프. 1장이면 컨트롤 숨김.
// 클릭 우선순위: linkUrl > 상세페이지(banner-detail.html?id=) > 무동작
// ★ linkUrl 을 '#finder' 로 적으면 주소로 가지 않고 그 화면의 '상품 찾기' 를 연다 (2026-08-08).
//   백엔드에 칸을 새로 만들지 않았다 — 이미 있는 링크 칸의 약속값 하나면 되는 일이다.
// 의존: api.js(api.get, ApiResponse.data 언랩) — 페이지에서 먼저 로드.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 배너를 눌렀을 때 주소로 가는 대신 상품 찾기를 열 것인가.
  //
  // 관리자는 링크 칸에 이렇게만 적는다.
  //   #finder           이 페이지에 있는 상품 찾기를 그 자리에서 연다
  //   #finder:water     정수기 찾기로 보낸다 (어느 페이지 배너에서든)
  //   #finder:internet  인터넷·TV 찾기로 보낸다
  //
  // 뒤에 붙는 이름은 카테고리 주소(slug)다. 어드민 카테고리 관리에 /c/xxx 로 적혀 있다.
  function finderTarget(dest) {
    var m = String(dest || '').trim().match(/^#finder(?::([a-z0-9_-]+))?$/i);
    if (!m) return null;
    return (m[1] || '').toLowerCase();   // '' = 이 페이지
  }

  // 카테고리별 전용 페이지. 없는 카테고리는 공용 주소(/c/{slug})로 간다.
  // ⚠ 이 목록은 '전용 페이지가 따로 있는 카테고리' 라는 사이트 구조 사실이다.
  //   전용 페이지를 새로 만들 때만 한 줄 는다.
  var FINDER_PAGES = { water: '/water', internet: '/internet' };

  function finderPageOf(slug) {
    return FINDER_PAGES[slug] || '/c/' + encodeURIComponent(slug);
  }

  // 지금 보고 있는 페이지가 그 카테고리인가. 맞으면 이동하지 않고 그 자리에서 연다.
  function isHere(slug) {
    if (!slug) return true;
    var path = String(location.pathname || '').replace(/\.html$/, '');
    return path === finderPageOf(slug) || path === '/c/' + slug;
  }

  function resolveClick(b) {
    if (b.linkUrl && String(b.linkUrl).trim()) return String(b.linkUrl).trim();
    if (b.hasDetail || (b.detailContent && String(b.detailContent).trim())) return 'banner-detail.html?id=' + b.id;
    return null;
  }

  function hide(el) { el.hidden = true; el.style.display = 'none'; }

  // qs 예: 'category=WATER' 또는 'categoryId=uuid'
  function fetchBanners(qs) {
    // 주의: 웹 api는 const 전역이라 window.api 로는 안 잡힘 → bare 참조를 typeof 로 가드
    if (typeof api !== 'undefined' && api && typeof api.get === 'function') {
      return api.get('/api/banners?' + qs);
    }
    return Promise.reject(new Error('api.js 미로드'));
  }

  function initOne(el) {
    // 관리자가 만든 카테고리는 (구) enum 값이 없어서 id 로 부른다 (2026-07-30).
    // 기존 페이지는 계속 data-banner-category(enum)를 쓴다 — 서버가 둘 다 받는다.
    var catId = el.getAttribute('data-banner-category-id');
    var cat = el.getAttribute('data-banner-category');
    var qs = catId
      ? 'categoryId=' + encodeURIComponent(catId)
      : cat
        ? 'category=' + encodeURIComponent(cat)
        : null;
    if (!qs) return;
    fetchBanners(qs).then(function (d) {
      var rows = Array.isArray(d) ? d : (d && d.content) || [];
      if (!rows.length) { hide(el); return; }
      build(el, rows);
    }).catch(function () { hide(el); });
  }

  function build(el, rows) {
    var track = el.querySelector('.sb__track');
    var dotsWrap = el.querySelector('.sb__dots');
    var prev = el.querySelector('.sb__arrow.prev');
    var next = el.querySelector('.sb__arrow.next');
    if (!track) return;

    track.innerHTML = rows.map(function (b, i) {
      var dest = resolveClick(b);
      var img = '<img src="' + esc(b.imageUrl) + '" alt="' + esc(b.altText || '') + '" ' +
        (i === 0 ? 'loading="eager"' : 'loading="lazy"') + ' decoding="async" />';
      var inner;
      if (!dest) {
        inner = img;
      } else if (finderTarget(dest) !== null) {
        var slug = finderTarget(dest);
        if (isHere(slug)) {
          // 지금 이 페이지 것이다. 주소 이동 없이 그 자리에서 연다.
          inner = '<a class="sb__link" href="#" data-dpfinder="1">' + img + '</a>';
        } else {
          // 다른 카테고리다. 그 페이지로 보내고 도착하면 스스로 열린다(finder.js).
          inner = '<a class="sb__link" href="' + esc(finderPageOf(slug) + '?finder=1') + '">' + img + '</a>';
        }
      } else {
        inner = '<a class="sb__link" href="' + esc(dest) + '"' +
          (/^https?:/i.test(dest) ? ' target="_blank" rel="noopener"' : '') + '>' + img + '</a>';
      }
      return '<div class="sb__slide">' + inner + '</div>';
    }).join('');

    // #finder 배너 클릭. 슬라이드가 다시 그려져도 살아남게 묶음에 한 번만 건다.
    if (!track.dataset.dpfBound) {
      track.dataset.dpfBound = '1';
      track.addEventListener('click', function (e) {
        var a = e.target && e.target.closest && e.target.closest('[data-dpfinder]');
        if (!a) return;
        e.preventDefault();
        if (typeof dpFinder === 'undefined' || typeof dpFinder.open !== 'function') {
          console.warn('[site-banner] 이 화면에 상품 찾기(finder.js)가 실려 있지 않다');
          return;
        }
        // 그 카테고리에 파인더가 없으면 open 이 스스로 아무것도 안 한다(finder.js:212).
        dpFinder.open();
      });
    }

    var total = rows.length;
    var multi = total > 1;
    if (prev) prev.style.display = multi ? '' : 'none';
    if (next) next.style.display = multi ? '' : 'none';
    if (dotsWrap) dotsWrap.style.display = multi ? '' : 'none';

    el.hidden = false; el.style.display = '';
    if (!multi) { track.style.transform = 'translateX(0)'; return; }

    dotsWrap.innerHTML = '';
    for (var i = 0; i < total; i++) {
      (function (n) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'sb__dot' + (n === 0 ? ' active' : '');
        d.setAttribute('aria-label', (n + 1) + '번째 배너');
        d.onclick = function () { go(n); reset(); };
        dotsWrap.appendChild(d);
      })(i);
    }
    var dots = dotsWrap.children;
    var idx = 0, timer = null, DELAY = 5000;

    function render() {
      track.style.transform = 'translateX(-' + (idx * 100) + '%)';
      for (var k = 0; k < dots.length; k++) dots[k].className = 'sb__dot' + (k === idx ? ' active' : '');
    }
    function go(n) { idx = (n + total) % total; render(); }
    function nextf() { go(idx + 1); }
    function prevf() { go(idx - 1); }
    function play() { stop(); timer = setInterval(nextf, DELAY); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function reset() { play(); }

    if (next) next.onclick = function () { nextf(); reset(); };
    if (prev) prev.onclick = function () { prevf(); reset(); };
    el.addEventListener('mouseenter', stop);
    el.addEventListener('mouseleave', play);

    var sx = null;
    var vp = el.querySelector('.sb__viewport') || el;
    vp.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; stop(); }, { passive: true });
    vp.addEventListener('touchend', function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) { if (dx < 0) nextf(); else prevf(); }
      sx = null; play();
    }, { passive: true });

    render();
    play();
  }

  function init() {
    var list = document.querySelectorAll('.sb[data-banner-category], .sb[data-banner-category-id]');
    for (var i = 0; i < list.length; i++) initOne(list[i]);
  }
  // 카테고리 id 를 API 로 받아온 뒤에야 부를 수 있는 페이지(/c/{slug})용 수동 창구
  window.dpInitBanner = initOne;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
