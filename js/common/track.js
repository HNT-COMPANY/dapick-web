// ════════════════════════════════════════════════════
// track.js — 버튼/CTA 클릭을 GTM dataLayer로 전송 (버튼마다 행동 추적)
//   · 위임 방식: 버튼/[role=button]/CTA성 링크/[data-track] 클릭 시 이벤트 push
//   · 이름 지정: 요소에 data-track="이벤트명" 붙이면 그 이름으로, 없으면 button_click
//   · 수동: window.dpTrack('이벤트명', {키:값})
//   GTM(GTM-P28QTWQD)에서 dataLayer 이벤트로 수집 → GA4 태그 연결
// ════════════════════════════════════════════════════
(function () {
  'use strict';
  window.dataLayer = window.dataLayer || [];
  function push(o) { try { window.dataLayer.push(o); } catch (e) {} }

  window.dpTrack = function (name, params) {
    push(Object.assign({ event: name || 'custom_event' }, params || {}));
  };

  function label(el) {
    var t = el.getAttribute('data-track-label') || el.getAttribute('aria-label') || el.textContent || '';
    return t.replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  var SEL = '[data-track], button, [role="button"], a[class*="btn"], a[class*="cta"], a[class*="apply"], a[class*="sapply"]';
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest(SEL);
    if (!el) return;
    push({
      event: el.getAttribute('data-track') || 'button_click',
      click_label: label(el),
      click_id: el.id || undefined,
      click_class: (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : undefined,
      page_path: location.pathname
    });
  }, true);
})();
