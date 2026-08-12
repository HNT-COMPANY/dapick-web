// ════════════════════════════════════════════════════
// site-banner.js — 카테고리 공용 상단 배너(캐러셀)
// 사용: <section class="sb" data-banner-category="INTERNET" hidden> ...스켈레톤... </section>
// GET /api/banners?category= → 활성 배너 주입. 0장이면 영역 숨김.
// 2장 이상이면 화살표/점/자동전환(5s)/hover정지/스와이프. 1장이면 컨트롤 숨김.
// 클릭 우선순위: linkUrl > 상세페이지(banner-detail.html?id=) > 무동작
// ★ linkUrl 에 약속값을 적으면 주소로 가지 않고 그 자리에서 무언가를 연다.
//   백엔드에 칸을 새로 만들지 않았다 — 이미 있는 링크 칸의 약속값 하나면 되는 일이다.
//     #finder:{카테고리}   상품 찾기 (2026-08-08)
//     #apply:{카테고리}    간편 신청 (2026-08-10) — 상세페이지를 거치지 않는다
//   창 제목은 배너마다 다르게 둘 수 있다(applyTitle 칸). 비우면 화면 기본 문구.
// 의존: api.js(api.get, ApiResponse.data 언랩) — 페이지에서 먼저 로드.
//       #apply 를 쓰려면 그 화면에 simple-apply.js 도 실려 있어야 한다.
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
  // 카테고리 이름을 부르는 다른 말들.
  // 관리자가 '인터넷TV' 를 떠올려 internet-tv 라 적어도 통하게 한다.
  // ⚠ 정본은 어드민 카테고리 관리의 주소(slug)다. 여기 것은 오타를 받아주는 그물이다.
  var SLUG_ALIAS = { 'internet-tv': 'internet', 'internettv': 'internet', 'itv': 'internet' };

  function normSlug(s) {
    var k = String(s || '').trim().toLowerCase();
    return SLUG_ALIAS[k] || k;
  }

  // '#동작:카테고리' 를 읽는다. 카테고리를 안 적으면 '' (이 페이지) 를 준다.
  //
  // ★ 왜 콜론으로 가르는가 (2026-08-10)
  //   카테고리 이름에 하이픈이 들어간다(internet-tv). 'internet-tv-apply' 처럼 붙여 쓰면
  //   기계가 internet + tv-apply 인지 internet-tv + apply 인지 모른다.
  //   콜론 앞은 무조건 동작, 뒤는 무조건 카테고리다. 하이픈이 몇 개든 상관없다.
  function hashTarget(dest, verb) {
    var re = new RegExp('^#' + verb + '(?::([a-z0-9_-]+))?$', 'i');
    var m = String(dest || '').trim().match(re);
    if (!m) return null;
    return normSlug(m[1] || '');   // '' = 이 페이지
  }

  function finderTarget(dest) { return hashTarget(dest, 'finder'); }
  function applyTarget(dest) { return hashTarget(dest, 'apply'); }

  // 카테고리별 전용 페이지. 없는 카테고리는 공용 주소(/c/{slug})로 간다.
  // ⚠ 이 목록은 '전용 페이지가 따로 있는 카테고리' 라는 사이트 구조 사실이다.
  //   전용 페이지를 새로 만들 때만 한 줄 는다.
  var FINDER_PAGES = { water: '/water', internet: '/internet' };

  function finderPageOf(slug) {
    return FINDER_PAGES[slug] || '/c/' + encodeURIComponent(slug);
  }

  // 이 배너에 관리자가 쓴 상세 글이 있는가.
  function hasDetail(b) {
    return !!(b && (b.hasDetail || (b.detailContent && String(b.detailContent).trim())));
  }

  // 지금 이 화면에서 간편 신청 창을 열 수 있는가.
  // ⚠ simple-apply.js 는 주소로 카테고리를 정하고, 모르는 주소에서는 스스로 꺼진다.
  //   그래서 그 파일이 실려 있어도 여기서 열 수 있다는 보장이 없다.
  function canApplyHere(slug) {
    return isHere(slug) && typeof window.openSimpleApply === 'function';
  }

  // 지금 보고 있는 페이지가 그 카테고리인가. 맞으면 이동하지 않고 그 자리에서 연다.
  function isHere(slug) {
    if (!slug) return true;
    var path = String(location.pathname || '').replace(/\.html$/, '');
    return path === finderPageOf(slug) || path === '/c/' + slug;
  }

  function resolveClick(b) {
    if (b.linkUrl && String(b.linkUrl).trim()) return String(b.linkUrl).trim();
    if (hasDetail(b)) return 'banner-detail.html?id=' + b.id;
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

  // 문구 그리기는 banner-overlay.js 가 맡는다 (어드민 미리보기와 같은 코드다).
  // 그 파일이 안 실린 화면에서도 배너는 그대로 나와야 하므로 없으면 조용히 건너뛴다.
  function OV() {
    return typeof DapickBannerOverlay !== 'undefined' ? DapickBannerOverlay : null;
  }
  function ovHtml(b) {
    var o = OV();
    if (!o || !b || !b.overlay || !o.has(b.overlay)) return '';
    o.injectStyles();
    return o.html(b.overlay);
  }

  // 지금 보이는 슬라이드에만 문구를 켠다.
  //
  // 켜지는 조건이 둘이다 —
  //   1) 배너 영역이 화면 안에 있다 (스크롤로 내렸다 다시 올리면 다시 재생)
  //   2) 그 슬라이드가 지금 보이는 장이다 (캐러셀이 넘어오면 재생)
  // 둘 다 만족해야 켠다. 안 보이는 장의 문구를 미리 켜 두면 넘어왔을 때 이미 끝나 있다.
  function paintOn(el) {
    var slides = el.querySelectorAll('.sb__slide');
    var on = el.__sbSeen === true;
    var cur = el.__sbIdx || 0;
    for (var i = 0; i < slides.length; i++) {
      slides[i].classList.toggle('is-on', on && i === cur);
    }
  }

  // 화면에 들어왔는가. 들어올 때마다 다시 재생하므로 한 번 보고 끝내지 않는다
  // (unobserve 하지 않는다).
  function watchSeen(el) {
    if (el.__sbWatch) return;
    if (typeof IntersectionObserver !== 'function') {
      // 옛 브라우저에서는 그냥 늘 켜 둔다. 안 움직일 뿐 글자는 보인다.
      el.__sbSeen = true;
      paintOn(el);
      return;
    }
    el.__sbWatch = new IntersectionObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        el.__sbSeen = list[i].isIntersecting;
      }
      paintOn(el);
    }, { threshold: 0.25 });
    el.__sbWatch.observe(el);
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
      } else if (applyTarget(dest) !== null) {
        // ★ 간편 신청 배너 (2026-08-10)
        //
        //   배너를 누르면 곧장 간편 신청 창이 열린다. 중간에 아무것도 끼우지 않는다.
        //
        //   ⚠ 상세 글이 있어도 상세 화면으로 보내지 않는다 (2026-08-10 바꿈).
        //     처음에는 '파는 글을 읽고 신청하는 편이 낫다' 고 보아 상세를 먼저 띄웠다.
        //     그런데 배너를 누른 사람은 이미 마음이 정해진 사람이다 —
        //     읽을거리를 내밀면 거기서 나간다. 이 동작은 상세 글을 안 쓰는 자리다.
        //     상세 글을 보여주고 싶으면 배너 동작을 '아무 동작 없음' 으로 두면 된다.
        var aslug = applyTarget(dest);
        // 배너 라벨(altText)을 실어 보낸다. 접수 내용 앞에 '(라벨) 인터넷 배너 클릭시 간편 신청 클릭' 로 남는다.
        var blabel = String(b.altText || '').slice(0, 120);
        // 배너마다 다른 신청 창 제목 (2026-08-11). 비어 있으면 화면 기본 문구가 나간다.
        var btitle = String(b.applyTitle || '').slice(0, 60);
        if (canApplyHere(aslug)) {
          inner = '<a class="sb__link" href="#" data-dpapply="1" data-dpblabel="' +
            esc(blabel) + '" data-dptitle="' + esc(btitle) + '">' + img + '</a>';
        } else if (aslug) {
          // 이 화면에서는 못 연다. 그 카테고리 화면으로 보내고 도착하면 스스로 열린다.
          // ⚠ 제목은 주소에 안 싣는다. 고객이 보는 주소창에 광고 문구가 그대로 찍히고,
          //   길어지면 잘린다. 넘어간 화면에서는 기본 문구로 연다.
          inner = '<a class="sb__link" href="' +
            esc(finderPageOf(aslug) + '?apply=1' + (blabel ? '&bl=' + encodeURIComponent(blabel) : '')) +
            '">' + img + '</a>';
        } else {
          // ⚠ 카테고리를 안 골랐는데 이 화면에서도 못 연다.
          //   아무 카테고리나 찍어 보내면 고객이 엉뚱한 곳에서 신청하게 된다.
          //   차라리 아무 일도 안 한다. 관리자가 화면을 고르면 풀린다.
          console.warn('[site-banner] #apply 인데 이 화면에서 못 연다. 배너에 카테고리를 골라라');
          inner = img;
        }
      } else {
        inner = '<a class="sb__link" href="' + esc(dest) + '"' +
          (/^https?:/i.test(dest) ? ' target="_blank" rel="noopener"' : '') + '>' + img + '</a>';
      }
      // 이미지 위에 얹는 문구 (2026-08-12). 없으면 빈 문자열이라 전과 똑같다.
      // ⚠ 문구를 링크(a) 밖에 두는 이유 — 안에 넣으면 글자를 드래그로 선택할 때
      //   링크가 딸려 열린다. 클릭은 문구가 pointer-events 를 꺼서 아래 이미지로 지나간다.
      return '<div class="sb__slide">' + inner + ovHtml(b) + '</div>';
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

      // 간편 신청 배너 클릭 (2026-08-10)
      track.addEventListener('click', function (e) {
        var a = e.target && e.target.closest && e.target.closest('[data-dpapply]');
        if (!a) return;
        e.preventDefault();
        if (typeof window.openSimpleApply !== 'function') {
          console.warn('[site-banner] 이 화면에 간편 신청(simple-apply.js)이 실려 있지 않다');
          return;
        }
        // 카테고리는 넘기지 않는다 — simple-apply.js 가 주소로 이미 정해 두었다.
        //
        // 문구와 관리자 표식은 simple-apply.js 가 내보낸 것을 쓴다 (2026-08-10).
        // 여기 따로 적으면 '그 자리에서 연 창' 과 '넘어가서 열린 창' 이 다른 말을 한다.
        var B = window.dpBannerApply || {};
        // 관리자가 이 배너에 적어 둔 제목이 있으면 그것이 이긴다 (2026-08-11).
        var t = (a.getAttribute('data-dptitle') || '').trim();
        window.openSimpleApply(null, '', null, {
          source: 'banner_lead',
          title: t || B.title,
          adminNote: typeof B.note === 'function'
            ? B.note(a.getAttribute('data-dpblabel') || '')
            : null,
        });
      });
    }

    var total = rows.length;
    var multi = total > 1;
    if (prev) prev.style.display = multi ? '' : 'none';
    if (next) next.style.display = multi ? '' : 'none';
    if (dotsWrap) dotsWrap.style.display = multi ? '' : 'none';

    el.hidden = false; el.style.display = '';
    el.__sbIdx = 0;
    watchSeen(el);
    paintOn(el);
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
      el.__sbIdx = idx;
      paintOn(el);   // 넘어온 장의 문구를 재생한다
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
