//
// track.js — 버튼/CTA 클릭을 GA4(gtag.js)로 전송 (버튼마다 행동 추적)
//   · 위임 방식: 버튼/[role=button]/CTA성 링크/[data-track] 클릭 시 gtag 이벤트 전송
//   · 이름 지정: data-track="이벤트명" 있으면 그 이름, 없으면 button_click
//   · 수동: window.dpTrack('이벤트명', {키:값})
//   전제: 각 페이지 <head>에 gtag.js(G-741SL0QH2E) 로드됨(window.gtag 존재)
//
(function () {
  'use strict';

  window.dpTrack = function (name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name || 'custom_event', params || {});
  };

  function label(el) {
    var t = el.getAttribute('data-track-label') || el.getAttribute('aria-label') || el.textContent || '';
    return t.replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  var SEL = '[data-track], button, [role="button"], a[class*="btn"], a[class*="cta"], a[class*="apply"], a[class*="sapply"]';
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest(SEL);
    if (!el) return;
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', el.getAttribute('data-track') || 'button_click', {
      click_label: label(el),
      click_id: el.id || undefined,
      click_class: (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : undefined,
      page_path: location.pathname
    });
  }, true);
})();
