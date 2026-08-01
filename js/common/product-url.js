// ────────────────────────────────────────────────
// product-url.js — 상품 URL 규칙의 '주인' 파일
// 의존: 없음
//
//   dpOptionQs(options)   조합 → 쿼리스트링
//   dpProductUrl(r)       { categoryType, productId, options } → 상세 URL | null
//   dpListUrl(category)   카테고리 → 목록 페이지 URL | null
//
// ★ 왜 따로 뺐나
//   이 규칙을 쓰는 화면이 셋이 됐다 — 마이페이지 찜/최근본, 마이페이지 비교표,
//   그리고 상세 하단 비교 트레이. 각자 만들면 CARRIER_MAP 처럼 사본이 늘어난다.
//   상세 페이지의 파라미터 이름이 바뀌는 날, 고칠 곳은 이 파일 하나여야 한다.
//
// 받는 쪽(키 이름이 어긋나면 조용히 다른 조합이 열린다):
//   internet-detail.js restoreSelection / water-detail.js WD_WANT /
//   rental-detail.js RD_WANT
// ────────────────────────────────────────────────
(function () {
  // 카테고리 → 목록 페이지. 비교 트레이의 '+' 카드가 여기로 보낸다.
  var LIST = {
    INTERNET_TV: 'internet.html',
    WATER: 'water.html',
    RENTAL: 'rental.html',
  };

  function optionQs(options) {
    if (!options) return '';
    var qs = [];
    for (var k in options) {
      if (!Object.prototype.hasOwnProperty.call(options, k)) continue;
      var v = options[k];
      if (v === null || v === undefined || v === '') continue;
      qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    }
    return qs.join('&');
  }

  function productUrl(r) {
    if (!r) return null;
    // 정수기·렌탈은 productId 하나가 화면 하나다. id 만으로도 열리지만,
    // 조합이 있으면 options 를 붙여 그 조합 그대로 열리게 한다.
    if (r.categoryType === 'WATER' || r.categoryType === 'RENTAL') {
      var page = r.categoryType === 'WATER' ? 'water-detail.html' : 'rental-detail.html';
      var q = optionQs(r.options);
      return page + '?id=' + encodeURIComponent(r.productId) + (q ? '&' + q : '');
    }
    // 관리자가 만든 카테고리의 상품(에어컨·안마의자 …). 2026-08-01 추가.
    // 화면이 하나뿐이라 정수기와 같은 방식이다 - id 로 열고, 조합이 있으면 붙인다.
    // 받는 쪽은 product-detail.js 의 pdWantMonths() 다. 키 이름(months)이 어긋나면
    // 링크는 열리는데 약정만 기본값으로 돌아간다 - 티가 안 나는 종류의 오류다.
    if (r.categoryType === 'GENERIC') {
      var qg = optionQs(r.options);
      return 'product-detail.html?id=' + encodeURIComponent(r.productId) + (qg ? '&' + qg : '');
    }
    // 인터넷·TV 는 productId 가 '통신사'라서 id 만으로는 화면을 못 만든다.
    // 조합(options.carrier)이 있을 때만 복원 링크가 생긴다.
    if (r.categoryType === 'INTERNET_TV' && r.options && r.options.carrier) {
      var qi = optionQs(r.options);
      if (qi) return 'internet-detail.html?' + qi;
    }
    return null; // 나머지 카테고리는 아직 단일 상세 링크 없음
  }

  function listUrl(category) {
    return LIST[category] || null;
  }

  window.dpOptionQs = optionQs;
  window.dpProductUrl = productUrl;
  window.dpListUrl = listUrl;
})();
