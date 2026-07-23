// ════════════════════════════════════════════════════
// popup.js — 홈 팝업 (배너형 캐러셀)
//   · GET /api/popups(활성) 중 최대 5개를 팝업 하나에 몰아서 노출
//   · 좌/우 화살표 + 점 인디케이터 + 슬라이드 애니메이션 + 자동 넘김(마우스 올리면 멈춤)
//   · 이미지 클릭 → 상세페이지(또는 외부 URL). '오늘 하루 보지 않기' / '닫기'(전체 종료)
//   의존: api.js(api.get)
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  var MAX = 5;         // 팝업에 몰아서 볼 최대 개수
  var AUTO_MS = 4000;  // 자동 넘김 간격(ms)

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var HKEY = 'dapick_popup_hide';
  function hiddenToday() { try { return localStorage.getItem(HKEY) === today(); } catch (e) { return false; } }
  function hideToday() { try { localStorage.setItem(HKEY, today()); } catch (e) {} }
  function target(p) {
    if (p.buttonUrl && String(p.buttonUrl).trim()) return String(p.buttonUrl).trim();
    return '/popup-detail.html?id=' + p.id;
  }

  var _css = false;
  function injectStyles() {
    if (_css) return; _css = true;
    var css =
      '.dpop-overlay{position:fixed;inset:0;z-index:2000;background:rgba(20,18,35,.55);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto;}' +
      '.dpop-card{width:360px;max-width:92vw;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.3);display:flex;flex-direction:column;}' +
      '.dpop-viewport{position:relative;width:100%;overflow:hidden;}' +
      '.dpop-track{display:flex;transition:transform .35s ease;}' +
      '.dpop-slide{flex:0 0 100%;line-height:0;cursor:pointer;}' +
      '.dpop-slide img{width:100%;height:auto;display:block;}' +
      '.dpop-arrow{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border:none;border-radius:50%;background:rgba(0,0,0,.38);color:#fff;font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:3;padding:0;}' +
      '.dpop-arrow:hover{background:rgba(0,0,0,.62);}' +
      '.dpop-arrow.prev{left:8px;}.dpop-arrow.next{right:8px;}' +
      '.dpop-dots{display:flex;justify-content:center;gap:7px;padding:9px 0 4px;}' +
      '.dpop-dot{width:7px;height:7px;border-radius:50%;background:#d3d0e0;cursor:pointer;}' +
      '.dpop-dot.on{background:#5b3fbe;}' +
      '.dpop-bar{display:flex;align-items:center;justify-content:space-between;background:#18172b;}' +
      '.dpop-btn{flex:1;border:none;background:transparent;color:#fff;font-family:inherit;font-size:14px;padding:14px 10px;cursor:pointer;}' +
      '.dpop-btn:hover{background:rgba(255,255,255,.08);}' +
      '.dpop-btn.hide{color:#c9c6d8;border-right:1px solid rgba(255,255,255,.12);}' +
      '@media(max-width:520px){.dpop-card{width:100%;max-width:94vw;}}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  }

  function render(list) {
    list = (list || []).filter(function (p) { return p && p.imageUrl; }).slice(0, MAX);
    if (!list.length || hiddenToday()) return;
    injectStyles();

    var n = list.length;
    var slides = list.map(function (p) {
      return '<a class="dpop-slide" href="' + esc(target(p)) + '"><img src="' + esc(p.imageUrl) + '" alt="' + esc(p.title || '') + '" /></a>';
    }).join('');
    var arrows = n > 1
      ? '<button type="button" class="dpop-arrow prev" data-act="prev" aria-label="이전">‹</button>' +
        '<button type="button" class="dpop-arrow next" data-act="next" aria-label="다음">›</button>'
      : '';
    var dots = n > 1
      ? '<div class="dpop-dots">' + list.map(function (_, i) {
          return '<span class="dpop-dot' + (i === 0 ? ' on' : '') + '" data-i="' + i + '"></span>';
        }).join('') + '</div>'
      : '';

    var ov = document.createElement('div');
    ov.className = 'dpop-overlay';
    ov.innerHTML =
      '<div class="dpop-card">' +
        '<div class="dpop-viewport">' +
          '<div class="dpop-track">' + slides + '</div>' + arrows +
        '</div>' + dots +
        '<div class="dpop-bar">' +
          '<button type="button" class="dpop-btn hide" data-act="hide">오늘 하루 보지 않기</button>' +
          '<button type="button" class="dpop-btn" data-act="close">닫기</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';

    var track = ov.querySelector('.dpop-track');
    var dotsEl = ov.querySelectorAll('.dpop-dot');
    var idx = 0, timer = null;

    function go(i) {
      idx = (i + n) % n;
      track.style.transform = 'translateX(-' + (idx * 100) + '%)';
      for (var k = 0; k < dotsEl.length; k++) dotsEl[k].classList.toggle('on', k === idx);
    }
    function next() { go(idx + 1); }
    function prev() { go(idx - 1); }
    function start() { if (n > 1 && !timer) timer = setInterval(next, AUTO_MS); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function close() { stop(); if (ov.parentNode) ov.parentNode.removeChild(ov); document.documentElement.style.overflow = ''; }

    ov.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-act]');
      if (b) {
        var act = b.getAttribute('data-act');
        if (act === 'next') next();
        else if (act === 'prev') prev();
        else if (act === 'hide') { hideToday(); close(); }
        else if (act === 'close') close();
        return;
      }
      var dot = e.target.closest && e.target.closest('.dpop-dot');
      if (dot) go(parseInt(dot.getAttribute('data-i'), 10) || 0);
    });

    var card = ov.querySelector('.dpop-card');
    card.addEventListener('mouseenter', stop);
    card.addEventListener('mouseleave', start);
    start();
  }

  function ready(cb) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb);
    else cb();
  }
  ready(function () {
    if (typeof api === 'undefined' || !api.get) return;
    api.get('/api/popups').then(function (data) {
      var list = Array.isArray(data) ? data : (data && data.content) || [];
      render(list);
    }).catch(function () {});
  });
})();
