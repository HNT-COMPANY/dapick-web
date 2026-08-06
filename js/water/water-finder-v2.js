// ════════════════════════════════════════════════════════════════════
// water-finder-v2.js — 정수기 화면을 공용 파인더 엔진에 연결한다 (2026-08-06)
//
// 무엇이 바뀌었나
//   질문 7개와 점수 가중치가 water-finder.js 안에 박혀 있었다.
//   이제 그 정의는 DB(finders 표)에 있고 관리자가 어드민에서 고친다.
//   이 파일은 '정수기 화면의 사정' 만 엔진에 알려준다 —
//   상품 목록을 어떻게 가져오는지, 상세 주소가 어떻게 생겼는지, 요금을 어디서 읽는지.
//
// ★ water-finder.js 를 지우지 않았다.
//   되돌리려면 water.html 에서 <script> 두 줄을 옛 한 줄로 바꾸면 끝난다.
//   새 엔진이 실제 데이터로 도는 것을 며칠 보고 나서 지운다.
//
// ★ 버튼 모양은 그대로 쓴다.
//   .wf-cta 는 water.css 에 이미 있다. 새로 만들면 디자인이 두 벌이 된다.
//
// 의존: api.js, finder.js, water.js(getAllProductsFlat / loadWaterProducts)
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // 이 상품이 가질 수 있는 가장 싼 월 요금.
  // pricing 은 약정 → 관리주기 → 프로모션 3단 중첩이라 값이 여러 개다.
  // 아무거나 고르면 상세로 들어갔을 때 숫자가 달라지므로 최저가를 쓰고 '~' 를 붙인다.
  // (정수기 목록 화면 water.js 와 같은 규칙이다)
  function minMonthly(p) {
    var pr = p && p.pricing;
    if (!pr) return 0;
    var min = 0;
    Object.keys(pr).forEach(function (contract) {
      var cycles = pr[contract];
      if (!cycles) return;
      Object.keys(cycles).forEach(function (cycle) {
        var types = cycles[cycle];
        if (!types) return;
        Object.keys(types).forEach(function (t) {
          var d = types[t];
          var m = d && Number(d.monthly);
          if (m > 0 && (!min || m < min)) min = m;
        });
      });
    });
    return min;
  }

  // 상품 목록. water.js 가 이미 한 번 받아 두었으면 그걸 쓰고, 아니면 받아온다.
  // 파인더 때문에 같은 목록을 두 번 부르지 않게 한다.
  function loadProducts() {
    var flat = typeof getAllProductsFlat === 'function' ? getAllProductsFlat() : [];
    if (flat && flat.length) return Promise.resolve(flat);
    if (typeof loadWaterProducts === 'function') {
      return loadWaterProducts()
        .then(function () {
          return typeof getAllProductsFlat === 'function' ? getAllProductsFlat() : [];
        })
        .catch(function () { return []; });
    }
    return Promise.resolve([]);
  }

  function mountButton() {
    var slot = document.getElementById('waterFinder');
    if (!slot) return null;

    slot.innerHTML =
      '<button type="button" class="wf-cta" id="wfOpen">' +
      '<span class="wf-cta-ico">🔎</span>' +
      '<span class="wf-cta-txt">' +
      '<b>나만의 정수기 찾기</b>' +
      '<em>몇 가지만 답하면 맞는 정수기를 골라드려요</em>' +
      '</span>' +
      '<span class="wf-cta-go">시작하기 ›</span>' +
      '</button>';
    return document.getElementById('wfOpen');
  }

  function init() {
    if (typeof dpFinder === 'undefined') {
      console.warn('[water-finder-v2] finder.js 가 안 실렸다');
      return;
    }
    var btn = mountButton();
    if (!btn) return;

    dpFinder.init({
      // ⚠ UUID 를 적지 않는다. 로컬과 운영의 값이 다르다.
      //   slug 로 먼저 찾고, 없으면 타입으로 찾는다(정수기는 최상위가 하나뿐이라 안전하다).
      categorySlug: 'water',
      categoryType: 'WATER',
      buttonEl: btn,
      loadProducts: loadProducts,
      hrefOf: function (p) {
        return '/water-detail?id=' + encodeURIComponent(p.id);
      },
      imageOf: function (p) { return p.imageUrl; },
      feeOf: minMonthly,
      feeSuffix: '~',
      // 결과 카드의 '신청하기'. 상세로 보낸다 —
      // 정수기는 약정·관리주기·색을 골라야 접수가 되는데 파인더에는 그 자리가 없다.
      // 여기서 바로 접수를 받으면 고객이 무엇에 신청했는지 모르는 채로 접수된다.
      onApply: function (p) {
        window.location.href = '/water-detail?id=' + encodeURIComponent(p.id) + '&apply=1';
      },
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
