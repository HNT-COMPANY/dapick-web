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

  // ⚠ 진입 버튼 글자·모양을 이 파일에 적지 않는다 (2026-08-08).
  //   버튼 문구·말풍선은 어드민 2단계에서 정하고 엔진(finder.js)이 그린다.
  //   화면은 빈 칸(#internetFinder) 하나만 둔다.

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
    dpFinder.init({
      // ⚠ UUID 를 적지 않는다. 로컬과 운영의 값이 다르다.
      categorySlug: 'internet',
      categoryType: 'INTERNET_TV',
      buttonSlot: 'internetFinder',   // 버튼은 엔진이 그린다. 문구는 어드민에 있다.

      // 따라오는 버튼 (2026-08-11). 이 화면은 통신사 카드·요금 문의·후기·질문으로
      // 길어서, 맨 위 진입 버튼이 한 번만 내려도 화면 밖으로 사라진다.
      // 문구는 위 진입 버튼 것을 그대로 쓴다 — 엔진이 알아서 가져간다.
      sticky: true,

      loadProducts: loadProducts,
      hrefOf: hrefOf,
      imageOf: function (row) { return row.imageUrl; },
      feeOf: function (row) { return Number(row.monthlyFee || 0); },
      // 결과 카드의 '신청하기' 는 상세로 보낸다.
      // 인터넷은 TV·공유기·약정을 골라야 접수가 되는데 파인더에는 그 자리가 없다.
      // 여기서 바로 받으면 고객이 무엇에 신청했는지 모르는 채로 접수된다.
      onApply: function (row) { window.location.href = hrefOf(row); },

      // 결과 바닥의 '간편 신청'. 이름·전화만 받고 그 자리에서 접수한다.
      // ⚠ productId 를 안 넘긴다. 여기 id 는 'p-kt::500M' 처럼 펼치면서 만든 것이라
      //   서버에 그런 상품이 없다. 상품명으로 남기면 상담원이 알아본다.
      //
      // src — 엔진이 알려주는 출처 (2026-08-10). 메인 검색으로 들어왔으면 'ai_search' 다.
      //   안 주면 예전대로 'finder_result'. 어느 문이 돈이 되는지 세려고 나눈다.
      onSimple: function (row, src) {
        if (typeof window.openSimpleApply !== 'function') return;
        window.openSimpleApply('internet', row ? row.name : '', '인터넷',
          { productImageUrl: (row && row.imageUrl) || null, source: src || 'finder_result' });
      },
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
