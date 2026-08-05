// ════════════════════════════════════════════════════════════════════
// /water 진입 화면 섹션 (2026-08-04 신설)
//
// 지금까지 정수기에 들어오면 "브랜드를 선택해주세요" 만 있었다.
// 브랜드를 모르는 사람은 고를 수가 없다. 브랜드와 상관없이 먼저 볼 것을 얹는다.
//
//   ① 이달의 특가   가로 4개   (isSpecial)
//   ② BEST 상품     가로 4개   (isPopular 우선 · 없으면 isBest, 순위 표기)
//   ③ 타사보상 | 슬림타입  각 가로 2개  (tradeIn / slimType)
//   ④ (기존) 브랜드 선택
//
// ★ 데이터
//   water.js 의 loadWaterProducts() 가 /api/water-products 로 전 상품을 한 번에
//   받아 두므로 여기서 따로 부르지 않는다. getAllProductsFlat() 로 평면 배열을 얻어
//   플래그로 거른다.
//   ⚠ 여기서 보는 플래그는 special·popular·best·tradeIn·slimType 이다 — 뱃지(badges)가 아니다.
//     카드에 붙는 딱지는 badges 로 그리고(water.js:201), 이 섹션에 뽑히느냐는 옛 플래그가 정한다.
//     둘은 별개다. 관리자가 딱지만 넣고 노출 설정을 안 켜면 여기 안 나온다(의도된 분리).
//
// ★ BEST 순위
//   isPopular·isBest 둘 다 켜기/끄기라 순위가 없다. sortOrder 로 줄 세워 1·2·3·4 를 붙인다.
//   따로 정하고 싶어지면 백엔드에 순위 칸을 만들면 되고, 그때 render() 만 고치면 된다.
//
// ★ 카드
//   renderProductCard() 를 그대로 쓴다. 목록과 진입 화면의 카드 모양이 갈라지면
//   한쪽만 고쳐지는 일이 반드시 생긴다. CSS 는 water.css 의 #boardView 스코프 참고.
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var ROOT_ID = 'waterHome';

  function el(id) {
    return document.getElementById(id);
  }

  // 섹션 하나. 상품이 없으면 통째로 숨긴다 — 빈 제목만 남으면 고장으로 보인다.
  function sectionHtml(id, title, sub, cols) {
    return (
      '<section class="wh-sec" id="' + id + '" hidden>' +
      '<div class="wh-head">' +
      '<h2 class="wh-title">' + title + '</h2>' +
      (sub ? '<p class="wh-sub">' + sub + '</p>' : '') +
      '</div>' +
      '<div class="wh-grid wh-grid--' + cols + '" data-body></div>' +
      '</section>'
    );
  }

  function paint(secId, rows, decorate) {
    var sec = el(secId);
    if (!sec) return;
    var body = sec.querySelector('[data-body]');
    if (!rows.length) {
      sec.hidden = true;
      return;
    }
    sec.hidden = false;
    body.innerHTML = rows
      .map(function (p, i) {
        var card = renderProductCard(p);
        return decorate ? decorate(card, p, i) : card;
      })
      .join('');
  }

  // 월 요금이 없는 상품은 앞에 두지 않는다 — "가격 문의" 만 줄줄이 나오면 볼 게 없다.
  function hasPrice(p) {
    var info = typeof getBestPriceInfo === 'function' ? getBestPriceInfo(p.pricing) : null;
    return !!(info && info.monthly);
  }

  function bySort(a, b) {
    return (a.sortOrder || 999) - (b.sortOrder || 999);
  }

  function render() {
    if (typeof getAllProductsFlat !== 'function') return;
    var all = getAllProductsFlat().filter(hasPrice);

    // ① 이달의 특가
    paint('whSpecial', all.filter(function (p) { return p.special; }).sort(bySort).slice(0, 4));

    // ② BEST — 통합 인기(popular) 우선, 없으면 브랜드 BEST(best)
    //
    // popular 는 백엔드 isPopular(전 브랜드 통합 TOP5)다. 이 자리는 브랜드를 가리지 않는
    // 통합 칸이라 개념상 popular 가 맞다. best 는 브랜드별 플래그여서, 한 브랜드가 best 를
    // 여러 개 켜 두면 sortOrder 로 잘랐을 때 네 칸이 그 브랜드로만 찰 수 있다.
    //
    // ⚠ 그래도 popular 로 갈아끼우기만 하면 안 된다 (2026-08-05).
    //   아직 아무 상품에도 isPopular 가 안 켜져 있으면 섹션이 통째로 빈다.
    //   그래서 0건이면 예전 동작(best)으로 조용히 내려간다.
    //   관리자가 isPopular 를 채우는 순간 손댈 것 없이 popular 기준으로 넘어간다.
    //   되돌리려면 popRows 를 [] 로 두면 예전과 똑같아진다.
    var popRows = all.filter(function (p) { return p.popular; });
    var bestBasis = popRows.length ? 'popular' : 'best';
    var bestRows = (popRows.length ? popRows : all.filter(function (p) { return p.best; }))
      .sort(bySort)
      .slice(0, 4);

    paint(
      'whBest',
      bestRows,
      function (card, p, i) {
        return (
          '<div class="wh-rankwrap"><span class="wh-rank">BEST ' + (i + 1) + '</span>' +
          card + '</div>'
        );
      },
    );

    // 화면만 봐서는 popular 로 뽑혔는지 best 로 뽑혔는지 알 수 없다.
    // 콘솔을 더럽히지 않으면서 DevTools 에서 확인할 수 있게 표시만 남긴다.
    var bestSec = el('whBest');
    if (bestSec) bestSec.dataset.basis = bestBasis;

    // ③ 타사보상 · 슬림타입 — 각 2개씩 좌우로
    paint('whTrade', all.filter(function (p) { return p.tradeIn; }).sort(bySort).slice(0, 2));
    paint('whSlim', all.filter(function (p) { return p.slimType; }).sort(bySort).slice(0, 2));

    // 셋 다 비면 두 칸짜리 줄 자체를 접는다
    var pair = el('whPair');
    if (pair) {
      var t = el('whTrade'), s = el('whSlim');
      pair.hidden = (!t || t.hidden) && (!s || s.hidden);
    }
  }

  function build() {
    var root = el(ROOT_ID);
    if (!root) return;
    root.innerHTML =
      sectionHtml('whSpecial', '이달의 특가', '이번 달만 이 가격으로 만나보세요', '4') +
      sectionHtml('whBest', 'BEST 상품', '고객이 가장 많이 고른 정수기', '4') +
      '<div class="wh-pair" id="whPair" hidden>' +
      sectionHtml('whTrade', '타사보상', '쓰던 제품 반납하고 더 저렴하게', '2') +
      sectionHtml('whSlim', '슬림타입', '좁은 주방에도 놓을 수 있어요', '2') +
      '</div>';
  }

  function init() {
    build();
    // water.js:1091 이 페이지 로드 때 미리 부른다. 그 약속을 다시 붙잡아 쓴다.
    if (typeof loadWaterProducts === 'function') {
      loadWaterProducts()
        .then(render)
        .catch(function (e) {
          // 상품을 못 받아도 브랜드 선택은 살아 있어야 한다. 섹션만 조용히 접는다.
          console.error('[water-home] 상품 로드 실패', e);
        });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
