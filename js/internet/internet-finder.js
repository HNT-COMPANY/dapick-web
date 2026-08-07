// ════════════════════════════════════════════════════════════════════
// internet-finder.js — 인터넷·TV 화면을 공용 파인더 엔진에 연결한다 (2026-08-07)
//
// 정수기(water-finder-v2.js)와 같은 자리의 파일이다.
// 엔진(finder.js)은 질문·점수·결과 화면을 그리고, 이 파일은
// '인터넷·TV 화면의 사정' 만 알려준다 — 상품을 어떻게 가져오는지,
// 상세 주소가 어떻게 생겼는지, 요금을 어디서 읽는지.
//
// 질문과 선별 기준은 이 파일에 없다. 어드민 '상품 찾기' 에 있다.
//
// ⚠ 상품 목록을 그대로 주지 않고 dpExpandInternet 으로 펼쳐서 준다.
//   internet_tv_products 는 통신사 1행이라 그대로 주면 후보가 3개뿐이다.
//   자세한 이유는 internet-expand.js 머리말 참고.
//
// 의존: api.js, finder.js, internet-expand.js
//       (internet-calc.js 는 있으면 쓰고 없어도 된다)
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // 진입 버튼. 정수기는 water.css 에 .wf-cta 가 있지만 인터넷 화면은 그 CSS 를
  // 싣지 않는다. 새 CSS 파일을 만들지 않고 여기서 필요한 만큼만 넣는다.
  // (같은 버튼이 세 번째 카테고리에 필요해지면 그때 공용으로 뺀다)
  var CSS = [
    // 슬롯 폭은 아래 통신사 선택 바(.iu-carrier-bar)와 같은 규격으로 맞춘다.
    // 하나만 달라도 세로로 나란히 서는 두 덩어리의 좌우가 어긋나 바로 티가 난다.
    '.iu-finder-slot{max-width:var(--max-w,1080px);margin:20px auto 0;padding:0 40px}',
    '@media(max-width:640px){.iu-finder-slot{padding:0 16px;margin-top:14px}}',
    '.ifd-cta{display:flex;align-items:center;gap:14px;width:100%;padding:18px 22px;',
    'background:#fff;border:1px solid #e9e2f7;border-radius:16px;cursor:pointer;',
    'box-shadow:0 2px 16px rgba(108,63,197,.07);text-align:left;transition:border-color .15s}',
    '.ifd-cta:hover{border-color:#6c3fc5}',
    '.ifd-cta-ico{width:44px;height:44px;flex-shrink:0;border-radius:12px;background:#f3eeff;',
    'display:flex;align-items:center;justify-content:center;font-size:20px}',
    '.ifd-cta-txt{flex:1;min-width:0}',
    '.ifd-cta-txt b{display:block;font-size:16px;font-weight:700;color:#111827}',
    '.ifd-cta-txt em{display:block;margin-top:3px;font-size:13px;color:#6b7280;font-style:normal}',
    '.ifd-cta-go{flex-shrink:0;font-size:14px;font-weight:600;color:#6c3fc5}',
    '@media(max-width:640px){.ifd-cta{padding:15px 16px;gap:11px}',
    '.ifd-cta-txt b{font-size:15px}.ifd-cta-txt em{font-size:12px}.ifd-cta-go{font-size:13px}}',
  ].join('');

  function injectCss() {
    if (document.getElementById('ifdCtaCss')) return;
    var s = document.createElement('style');
    s.id = 'ifdCtaCss';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function mountButton() {
    var slot = document.getElementById('internetFinder');
    if (!slot) return null;
    injectCss();
    slot.innerHTML =
      '<button type="button" class="ifd-cta" id="ifdOpen">' +
      '<span class="ifd-cta-ico">🔎</span>' +
      '<span class="ifd-cta-txt">' +
      '<b>나만의 인터넷·TV 찾기</b>' +
      '<em>몇 가지만 답하면 맞는 요금제를 골라드려요</em>' +
      '</span>' +
      '<span class="ifd-cta-go">시작하기 ›</span>' +
      '</button>';
    return document.getElementById('ifdOpen');
  }

  // 통신사 목록을 받아 속도 옵션 단위로 펼친다.
  function loadProducts() {
    if (typeof dpExpandInternet !== 'function') {
      console.warn('[internet-finder] internet-expand.js 가 안 실렸다');
      return Promise.resolve([]);
    }
    return Promise.resolve(api.get('/api/internet-tv-products'))
      .then(function (rows) {
        return dpExpandInternet(Array.isArray(rows) ? rows : (rows && rows.content) || []);
      })
      .catch(function () { return []; });
  }

  // 펼친 줄에서 통신사 페이지로 보낸다.
  // ⚠ 고른 속도 옵션까지 자동 선택되지는 않는다 —
  //   통합 페이지(internet-unified.js)가 ?carrier= 만 읽기 때문이다.
  //   옵션까지 넘기려면 그쪽 빌더에 복원 코드가 필요하다(지금은 안 한다).
  function hrefOf(row) {
    return '/internet-unified.html?carrier=' + encodeURIComponent(row.carrier || '');
  }

  function init() {
    if (typeof dpFinder === 'undefined') {
      console.warn('[internet-finder] finder.js 가 안 실렸다');
      return;
    }
    var btn = mountButton();
    if (!btn) return;

    dpFinder.init({
      // ⚠ UUID 를 적지 않는다. 로컬과 운영의 값이 다르다.
      categorySlug: 'internet',
      categoryType: 'INTERNET_TV',
      buttonEl: btn,
      loadProducts: loadProducts,
      hrefOf: hrefOf,
      imageOf: function (row) { return row.imageUrl; },
      feeOf: function (row) { return Number(row.monthlyFee || 0); },
      // 결과 카드의 '신청하기' 는 상세로 보낸다.
      // 인터넷은 TV·공유기·약정을 골라야 접수가 되는데 파인더에는 그 자리가 없다.
      // 여기서 바로 받으면 고객이 무엇에 신청했는지 모르는 채로 접수된다.
      onApply: function (row) { window.location.href = hrefOf(row); },
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
