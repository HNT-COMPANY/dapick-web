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
// ★ 진입 버튼 글자를 이 파일에 적지 않는다 (2026-08-08).
//   버튼 문구·말풍선은 어드민 2단계에서 정하고 엔진이 그린다.
//   여기 적으면 문구 하나 바꾸는 데 개발자와 배포가 필요해진다.
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

  function init() {
    if (typeof dpFinder === 'undefined') {
      console.warn('[water-finder-v2] finder.js 가 안 실렸다');
      return;
    }
    dpFinder.init({
      // ⚠ UUID 를 적지 않는다. 로컬과 운영의 값이 다르다.
      //   slug 로 먼저 찾고, 없으면 타입으로 찾는다(정수기는 최상위가 하나뿐이라 안전하다).
      categorySlug: 'water',
      categoryType: 'WATER',
      buttonSlot: 'waterFinder',   // 버튼은 엔진이 그린다. 문구는 어드민에 있다.
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

      // 결과 바닥의 '간편 신청'. 이름·전화만 받고 그 자리에서 접수한다.
      // ⚠ productId 를 안 넘긴다. 정수기는 products 표에 없는 카테고리라
      //   번호를 넘기면 서버가 이어 붙일 상품을 못 찾는다(simple-apply.js 머리말 참고).
      //
      // src — 엔진이 알려주는 출처 (2026-08-10). 메인 검색으로 들어왔으면 'ai_search' 다.
      //   안 주면 예전대로 'finder_result'. 어느 문이 돈이 되는지 세려고 나눈다.
      onSimple: function (p, src) {
        if (typeof window.openSimpleApply !== 'function') return;
        window.openSimpleApply('water', p ? p.name : '', '정수기',
          { productImageUrl: (p && p.imageUrl) || null, source: src || 'finder_result' });
      },
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
