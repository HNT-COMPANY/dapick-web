// ════════════════════════════════════════════════════
// site-banner.js — 카테고리 공용 상단 배너(캐러셀)
// 사용: <section class="sb" data-banner-category="INTERNET" hidden> ...스켈레톤... </section>
// GET /api/banners?category= → 활성 배너 주입. 0장이면 영역 숨김.
// 2장 이상이면 화살표/점/자동전환(5s)/hover정지/스와이프. 1장이면 컨트롤 숨김.
// 클릭 우선순위: linkUrl > 상세페이지(banner-detail.html?id=) > 무동작
// 의존: api.js(api.get, ApiResponse.data 언랩) — 페이지에서 먼저 로드.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function resolveClick(b) {
    if (b.linkUrl && String(b.linkUrl).trim()) return String(b.linkUrl).trim();
    if (b.hasDetail || (b.detailContent && String(b.detailContent).trim())) return 'banner-detail.html?id=' + b.id;
    return null;
  }

  function hide(el) { el.hidden = true; el.style.display = 'none'; }

  function fetchBanners(cat) {
    // 주의: 웹 api는 const 전역이라 window.api 로는 안 잡힘 → bare 참조를 typeof 로 가드
    if (typeof api !== 'undefined' && api && typeof api.get === 'function') {
      return api.get('/api/banners?category=' + encodeURIComponent(cat));
    }
    return Promise.reject(new Error('api.js 미로드'));
  }

  function initOne(el) {
    var cat = el.getAttribute('data-banner-category');
    if (!cat) return;
    fetchBanners(cat).then(function (d) {
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
      var inner = dest
        ? '<a class="sb__link" href="' + esc(dest) + '"' + (/^https?:/i.test(dest) ? ' target="_blank" rel="noopener"' : '') + '>' + img + '</a>'
        : img;
      return '<div class="sb__slide">' + inner + '</div>';
    }).join('');

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
    var list = document.querySelectorAll('.sb[data-banner-category]');
    for (var i = 0; i < list.length; i++) initOne(list[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
