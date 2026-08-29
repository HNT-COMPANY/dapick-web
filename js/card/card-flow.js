//
// card-flow.js — 카드 페이지 진입 히어로: 카드사 로고 타일이 천천히 위로 흐름
// 로고: assets/card/{key}.png (투명 PNG). 없으면 브랜드명 텍스트로 폴백.
//
(function () {
  'use strict';

  // 카드사 (partner-section data-brand 와 동일 키)
  var BRANDS = [
    { key: 'hyundai', name: '현대카드', color: '#111111' },
    { key: 'shinhan', name: '신한카드', color: '#1a4fff' },
    { key: 'samsung', name: '삼성카드', color: '#1428a0' },
    { key: 'kb', name: '국민카드', color: '#8a6d0b' },
    { key: 'lotte', name: '롯데카드', color: '#222222' },
    { key: 'woori', name: '우리카드', color: '#0071bc' },
    { key: 'hana', name: '하나카드', color: '#00857a' },
  ];

  var COLS = 6; // 데스크톱 컬럼 수 (모바일은 CSS로 일부 숨김)

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function tileHtml(b) {
    return (
      '<div class="card-flow__tile">' +
      '<img src="assets/card/' + b.key + '.png" alt="' + esc(b.name) + '" ' +
      'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';" />' +
      '<span class="card-flow__label" style="display:none;color:' + b.color + '">' + esc(b.name) + '</span>' +
      '</div>'
    );
  }

  // 컬럼별로 브랜드 순서를 회전시켜 서로 다르게 보이도록
  function colBrands(colIdx) {
    var arr = [];
    for (var i = 0; i < BRANDS.length; i++) {
      arr.push(BRANDS[(i + colIdx * 2) % BRANDS.length]);
    }
    return arr;
  }

  function build() {
    var bg = document.getElementById('cardFlowBg');
    if (!bg) return;

    var html = '';
    for (var c = 0; c < COLS; c++) {
      var brands = colBrands(c);
      var tiles = brands.map(tileHtml).join('');
      // 2배 복제 → -50% 이동으로 무한 루프 이음새 없음
      var dur = 26 + (c % 3) * 6;      // 26 / 32 / 38 s (컬럼별 속도차 = 시차감)
      var delay = -(c * 3.5);          // 시작 오프셋
      html +=
        '<div class="card-flow__col" style="animation-duration:' + dur + 's;animation-delay:' + delay + 's;">' +
        tiles + tiles +
        '</div>';
    }
    bg.innerHTML = html;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
